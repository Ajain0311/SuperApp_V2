import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppColors } from '../../theme/colors';
import { AdminNavigator } from './AdminNavigator';

interface AdminPortalScreenProps {
  navigation?: any;
}

export const AdminPortalScreen: React.FC<AdminPortalScreenProps> = () => {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <AdminNavigator />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
});
