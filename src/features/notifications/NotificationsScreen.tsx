import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  time: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  color: string;
  isUnread: boolean;
}

const NOTIFICATIONS: NotificationItem[] = [
  {
    id: '1',
    title: 'Order Placed Successfully!',
    body: 'Your Meghana Foods biryani order #FO-1002 has been received.',
    time: '10 mins ago',
    icon: 'check-circle',
    color: colors.secondary,
    isUnread: true,
  },
  {
    id: '2',
    title: 'Ride Completed',
    body: 'You arrived at Terminal 3, IGI Airport. Total fare ₹45.',
    time: '2 hours ago',
    icon: 'directions-bike',
    color: colors.blue,
    isUnread: false,
  },
  {
    id: '3',
    title: '50% Weekend Food Discount',
    body: 'Use code WELCOME50 for up to ₹100 off on your next feast!',
    time: '1 day ago',
    icon: 'local-offer',
    color: colors.primary,
    isUnread: false,
  },
];

export const NotificationsScreen: React.FC = () => {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <MaterialIcons name="chevron-left" size={28} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 28 }} />
      </View>

      <FlatList
        data={NOTIFICATIONS}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View
            style={[
              styles.card,
              item.isUnread && { borderColor: `${item.color}66` },
            ]}
          >
            <View style={[styles.iconContainer, { backgroundColor: `${item.color}26` }]}>
              <MaterialIcons name={item.icon} size={22} color={item.color} />
            </View>

            <View style={styles.textContent}>
              <View style={styles.titleRow}>
                <Text style={styles.title}>{item.title}</Text>
                {item.isUnread && <View style={styles.unreadDot} />}
              </View>
              <Text style={styles.body}>{item.body}</Text>
              <Text style={styles.time}>{item.time}</Text>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  listContent: {
    padding: spacing.md,
    gap: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContent: {
    flex: 1,
    marginLeft: 14,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '700',
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginLeft: 6,
  },
  body: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 18,
    marginTop: 4,
  },
  time: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 6,
  },
});
