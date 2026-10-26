import React, { useEffect } from 'react';
import { Alert, Platform, Linking } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

interface GitHubReleaseResponse {
  tag_name: string;
  name: string;
  body: string;
  assets: Array<{
    name: string;
    browser_download_url: string;
  }>;
}

const GITHUB_REPO = 'Ajain0311/SuperApp_V2';
const DISMISSED_TAG_KEY = '@superapp_dismissed_update_tag';
const INSTALLED_TAG_KEY = '@superapp_installed_update_tag';

export function useAppUpdateChecker(): void {
  useEffect(() => {
    let isMounted = true;

    async function checkForUpdate() {
      try {
        const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
          headers: {
            Accept: 'application/vnd.github.v3+json',
          },
        });

        if (!response.ok) return;

        const data: GitHubReleaseResponse = await response.json();
        const latestTag = (data.tag_name || '').trim();

        if (!latestTag || !isMounted) return;

        // Current version from app config / manifest
        const currentVersion =
          Constants.expoConfig?.version ||
          (Constants.manifest as any)?.version ||
          (Constants.manifest2 as any)?.extra?.expoClient?.version ||
          '1.0.2';

        // Check if user already dismissed or installed this exact release tag
        const [dismissedTag, installedTag] = await Promise.all([
          AsyncStorage.getItem(DISMISSED_TAG_KEY),
          AsyncStorage.getItem(INSTALLED_TAG_KEY),
        ]);

        if (latestTag === dismissedTag || latestTag === installedTag) {
          // Already handled or dismissed
          return;
        }

        // Normalize version strings (e.g. "v1.0.2-577906c" -> "1.0.2")
        const cleanLatest = latestTag.replace(/^v/, '');
        const cleanCurrent = currentVersion.replace(/^v/, '');

        // If release tag matches or starts with the current version, app is up to date
        if (
          cleanLatest === cleanCurrent ||
          cleanLatest.startsWith(`${cleanCurrent}-`) ||
          cleanLatest.startsWith(cleanCurrent)
        ) {
          return;
        }

        const apkAsset = data.assets?.find((a) => a.name.endsWith('.apk'));
        if (!apkAsset) return;

        Alert.alert(
          'New Update Available! 🚀',
          `A new build (${data.name || latestTag}) is available. Update now to install the latest features!`,
          [
            {
              text: 'Later',
              style: 'cancel',
              onPress: () => {
                void AsyncStorage.setItem(DISMISSED_TAG_KEY, latestTag);
              },
            },
            {
              text: 'Update & Install Now',
              style: 'default',
              onPress: () => {
                void downloadAndInstallApk(apkAsset.browser_download_url, latestTag);
              },
            },
          ],
          { cancelable: true }
        );
      } catch (err) {
        // Silent on network failure
      }
    }

    const timer = setTimeout(() => {
      void checkForUpdate();
    }, 2500);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, []);
}

async function downloadAndInstallApk(downloadUrl: string, latestTag: string): Promise<void> {
  if (Platform.OS !== 'android') {
    void Linking.openURL(downloadUrl);
    return;
  }

  try {
    const fileUri = `${FileSystem.documentDirectory}update.apk`;

    Alert.alert('Downloading Update ⏳', 'Downloading the latest APK in the background. Please wait a moment...');

    const downloadResumable = FileSystem.createDownloadResumable(
      downloadUrl,
      fileUri,
      {},
      () => {}
    );

    const result = await downloadResumable.downloadAsync();

    if (result && result.uri) {
      // Mark as installed tag so it won't prompt repeatedly
      await AsyncStorage.setItem(INSTALLED_TAG_KEY, latestTag);

      // Get content URI using Android FileProvider
      const cUri = await FileSystem.getContentUriAsync(result.uri);

      // FLAG_GRANT_READ_URI_PERMISSION = 1, FLAG_ACTIVITY_NEW_TASK = 0x10000000 (268435456)
      // Combined flags = 268435457
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: cUri,
        flags: 268435457,
        type: 'application/vnd.android.package-archive',
      });
    }
  } catch (error: any) {
    console.warn('[AutoUpdate] In-app installer direct launch error, falling back to browser:', error);
    try {
      await Linking.openURL(downloadUrl);
    } catch {
      Alert.alert(
        'Installation Help',
        'Could not open installer directly. Please allow "Install unknown apps" for RJ09 SEWA in phone settings or download via browser.'
      );
    }
  }
}
