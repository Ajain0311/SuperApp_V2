import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AppColors } from '../../theme/colors';

interface VegBadgeProps {
  isVeg: boolean;
  size?: number;
}

export const VegBadge: React.FC<VegBadgeProps> = ({ isVeg, size = 16 }) => {
  const color = isVeg ? AppColors.vegBadge : AppColors.nonVegBadge;

  return (
    <View
      style={[
        styles.square,
        {
          width: size,
          height: size,
          borderColor: color,
        },
      ]}
    >
      <View
        style={[
          styles.circle,
          {
            width: size * 0.45,
            height: size * 0.45,
            backgroundColor: color,
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  square: {
    borderWidth: 1.5,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    borderRadius: 999,
  },
});
