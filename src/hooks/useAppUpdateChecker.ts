import React, { useEffect } from 'react';
import { Alert, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';

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
// Base tag matching initially installed release
const CURRENT_RELEASE_TAG = 'v1.0.0-apk';

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
        const latestTag = data.tag_name || '';

        // If new release detected on GitHub
        if (latestTag && latestTag !== CURRENT_RELEASE_TAG && isMounted) {
          const apkAsset = data.assets?.find((a) => a.name.endsWith('.apk'));
          if (!apkAsset) return;

          Alert.alert(
            'New Update Available! 🚀',
            `A new build (${data.name || latestTag}) is available. Update now to install the latest features directly!`,
            [
              { text: 'Later', style: 'cancel' },
              {
                text: 'Update & Install Now',
                style: 'default',
                onPress: () => {
                  void downloadAndInstallApk(apkAsset.browser_download_url);
                },
              },
            ],
            { cancelable: true }
          );
        }
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

async function downloadAndInstallApk(downloadUrl: string): Promise<void> {
  if (Platform.OS !== 'android') return;

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
      // Get content URI using Android FileProvider
      const cUri = await FileSystem.getContentUriAsync(result.uri);

      // Launch native Android Package Installer directly
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: cUri,
        flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
        type: 'application/vnd.android.package-archive',
      });
    }
  } catch (error: any) {
    console.warn('[AutoUpdate] In-app installer error:', error);
    Alert.alert('Installation Note', 'Please allow "Install Unknown Apps" permission if prompted to complete the update.');
  }
}
