import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNetworkStatus } from '../../services/networkService';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

interface OfflineBannerProps {
  onRetry?: () => void;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({ onRetry }) => {
  const status = useNetworkStatus();
  const isOffline = !status.isConnected || status.isInternetReachable === false;

  if (!isOffline) {
    return null;
  }

  return (
    <View style={styles.banner}>
      <MaterialIcons name="cloud-off" size={18} color="#FFFFFF" style={styles.icon} />
      <Text style={styles.message} numberOfLines={1}>
        You're offline. Reconnecting...
      </Text>
      {onRetry && (
        <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.warning || '#D97706',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    zIndex: 9999,
  },
  icon: {
    marginRight: spacing.sm,
  },
  message: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: typography.bodyMedium?.fontSize ?? 14,
    fontFamily: typography.bodyMedium?.fontFamily,
  },
  retryButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 4,
    marginLeft: spacing.sm,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: typography.caption?.fontSize ?? 12,
    fontWeight: 'bold',
  },
});
