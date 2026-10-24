import React, { useEffect } from 'react';
import { Alert, Linking } from 'react-native';
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
        const currentVersion = Constants.expoConfig?.version || '1.0.0';

        // Check if there's a newer version tag (e.g. v1.0.1 vs 1.0.0)
        const cleanLatest = latestTag.replace(/^v/, '').split('-')[0];
        const cleanCurrent = currentVersion.replace(/^v/, '').split('-')[0];

        const isNewer = compareVersions(cleanLatest, cleanCurrent) > 0;

        if (isNewer && isMounted) {
          const apkAsset = data.assets?.find((a) => a.name.endsWith('.apk'));
          const downloadUrl = apkAsset?.browser_download_url || `https://github.com/${GITHUB_REPO}/releases/latest`;

          Alert.alert(
            'New Update Available! 🚀',
            `A new version (${latestTag}) of RJ09 SEWA is available. Update now to get the latest features and bug fixes.`,
            [
              { text: 'Later', style: 'cancel' },
              {
                text: 'Update Now',
                style: 'default',
                onPress: () => {
                  Linking.openURL(downloadUrl);
                },
              },
            ]
          );
        }
      } catch (err) {
        // Non-intrusive: silent on network fail
      }
    }

    // Delay check slightly to not block initial render
    const timer = setTimeout(() => {
      void checkForUpdate();
    }, 2500);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, []);
}

function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map((p) => parseInt(p, 10) || 0);
  const parts2 = v2.split('.').map((p) => parseInt(p, 10) || 0);
  const len = Math.max(parts1.length, parts2.length);

  for (let i = 0; i < len; i++) {
    const num1 = parts1[i] || 0;
    const num2 = parts2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}
