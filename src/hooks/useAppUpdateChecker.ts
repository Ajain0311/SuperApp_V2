import React, { useEffect } from 'react';
import { Alert, Linking } from 'react-native';

interface GitHubReleaseResponse {
  tag_name: string;
  name: string;
  body: string;
  published_at?: string;
  assets: Array<{
    name: string;
    browser_download_url: string;
  }>;
}

const GITHUB_REPO = 'Ajain0311/SuperApp_V2';
// Current build timestamp identifier (matches initial release)
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

        // Agar GitHub par latest tag current installed tag se alag hai, to update popup trigger karo
        if (latestTag && latestTag !== CURRENT_RELEASE_TAG && isMounted) {
          const apkAsset = data.assets?.find((a) => a.name.endsWith('.apk'));
          const downloadUrl = apkAsset?.browser_download_url || `https://github.com/${GITHUB_REPO}/releases/latest`;

          Alert.alert(
            'New Update Available! 🚀',
            `A new build (${data.name || latestTag}) with recent UI & code updates is available. Download now to get the latest changes!`,
            [
              { text: 'Later', style: 'cancel' },
              {
                text: 'Update Now',
                style: 'default',
                onPress: () => {
                  Linking.openURL(downloadUrl);
                },
              },
            ],
            { cancelable: true }
          );
        }
      } catch (err) {
        // Silent on network error
      }
    }

    // Delay check 2s after app launch
    const timer = setTimeout(() => {
      void checkForUpdate();
    }, 2000);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, []);
}
