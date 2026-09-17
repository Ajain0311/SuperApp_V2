import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppColors } from '../../theme/colors';

interface RatingBadgeProps {
  rating: number;
  fontSize?: number;
  iconSize?: number;
}

export const RatingBadge: React.FC<RatingBadgeProps> = ({
  rating,
  fontSize = 12,
  iconSize = 13,
}) => {
  return (
    <View style={styles.badge}>
      <Ionicons name="star" size={iconSize} color="#FFFFFF" />
      <Text style={[styles.text, { fontSize }]}>{Number(rating).toFixed(1)}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.secondary,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  text: {
    color: '#FFFFFF',
    fontWeight: '700',
    marginLeft: 3,
  },
});
