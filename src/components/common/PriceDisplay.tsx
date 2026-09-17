import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AppConstants } from '../../constants/app';
import { AppColors } from '../../theme/colors';

interface PriceDisplayProps {
  price: number;
  originalPrice?: number;
  fontSize?: number;
}

export const PriceDisplay: React.FC<PriceDisplayProps> = ({
  price,
  originalPrice,
  fontSize = 16,
}) => {
  const hasDiscount = originalPrice !== undefined && originalPrice > price;

  return (
    <View style={styles.container}>
      <Text style={[styles.price, { fontSize }]}>
        {AppConstants.currency}
        {Number(price).toFixed(0)}
      </Text>
      {hasDiscount && (
        <Text style={[styles.originalPrice, { fontSize: fontSize * 0.75 }]}>
          {AppConstants.currency}
          {Number(originalPrice).toFixed(0)}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  price: {
    fontWeight: '800',
    color: AppColors.primary,
  },
  originalPrice: {
    fontWeight: '400',
    color: AppColors.textTertiary,
    textDecorationLine: 'line-through',
    marginLeft: 6,
  },
});
