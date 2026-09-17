import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

interface DataSourceBadgeProps {
  isFallback: boolean;
  moduleName?: string;
}

export const DataSourceBadge: React.FC<DataSourceBadgeProps> = ({ isFallback, moduleName }) => {
  // Only display in development to make data provenance transparent
  const isDev = process.env.EXPO_PUBLIC_ENV !== 'production';
  if (!isDev) return null;

  return (
    <View style={[styles.container, isFallback ? styles.fallback : styles.live]}>
      <MaterialIcons
        name={isFallback ? 'cloud-off' : 'cloud-done'}
        size={11}
        color={isFallback ? colors.warning : colors.secondary}
      />
      <Text style={[styles.text, { color: isFallback ? colors.warning : colors.secondary }]}>
        {isFallback ? 'Demo Seed Data' : 'Live API Connected'}
        {moduleName ? ` • ${moduleName}` : ''}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    gap: 4,
    alignSelf: 'flex-start',
  },
  fallback: {
    backgroundColor: 'rgba(255, 215, 64, 0.1)',
    borderColor: 'rgba(255, 215, 64, 0.3)',
  },
  live: {
    backgroundColor: 'rgba(0, 200, 83, 0.1)',
    borderColor: 'rgba(0, 200, 83, 0.3)',
  },
  text: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
