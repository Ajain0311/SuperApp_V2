import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AppColors } from '../../theme/colors';

interface StatusBadgeProps {
  text?: string;
  status?: string;
  color?: string;
  textColor?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ text, status, color, textColor }) => {
  const label = text || status || '';
  const getStatusColor = (): string => {
    if (color) return color;
    switch (label.toUpperCase()) {
      case 'PENDING':
      case 'REQUESTED':
        return AppColors.yellow;
      case 'ACCEPTED':
      case 'ASSIGNED':
      case 'PREPARING':
      case 'ARRIVING':
        return AppColors.blue;
      case 'READY':
      case 'STARTED':
      case 'PICKED_UP':
        return AppColors.primary;
      case 'DELIVERED':
      case 'COMPLETED':
        return AppColors.success;
      case 'CANCELLED':
        return AppColors.error;
      case 'ACTIVE':
        return AppColors.success;
      case 'SOLD':
        return AppColors.primary;
      default:
        return AppColors.textSecondary;
    }
  };

  const statusColor = getStatusColor();

  return (
    <View style={[styles.badge, { backgroundColor: `${statusColor}26` }]}>
      <Text style={[styles.text, { color: textColor || statusColor }]}>
        {label.replace(/_/g, ' ')}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
