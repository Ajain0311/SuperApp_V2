import React, { useState, useEffect } from 'react';
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
import { apiClient } from '../../services/apiClient';
import { ApiEndpoints } from '../../constants/api';
import { notificationService } from '../../services/notificationService';

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
  const [notifications, setNotifications] = useState<NotificationItem[]>(NOTIFICATIONS);
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<string | null>(null);

  useEffect(() => {
    notificationService.getExpoPushToken().then((token) => {
      setPushToken(token);
    });

    apiClient
      .get<any>(ApiEndpoints.common.notifications)
      .then((res) => {
        const data = res.data?.data || res.data;
        const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
        if (items.length > 0) {
          const mapped: NotificationItem[] = items.map((n: any) => ({
            id: String(n.id),
            title: n.title,
            body: n.body || n.message || '',
            time: n.createdAt
              ? new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : 'Just now',
            icon: (n.iconName as any) || 'notifications',
            color:
              n.category === 'OFFER'
                ? colors.primary
                : n.category === 'RIDE'
                ? colors.blue
                : colors.secondary,
            isUnread: !n.IsRead,
          }));
          setNotifications(mapped);
        }
      })
      .catch(() => {});
  }, []);

  const handleTestOrderNotification = async () => {
    setTestStatus('Firing Food Order notification...');
    await notificationService.scheduleLocalNotification({
      title: 'Biryani Order #FO-1002 Out For Delivery! 🛵',
      body: 'Your driver Rahul is 3 mins away. Tap to open live order tracking.',
      data: {
        module: 'FOOD_ORDER',
        orderId: 'FO-1002',
        orderNumericId: 1002,
      },
    });
    setTestStatus('Sent! Tap the notification banner to test deep link.');
    setTimeout(() => setTestStatus(null), 4000);
  };

  const handleTestRideNotification = async () => {
    setTestStatus('Firing Ride alert...');
    await notificationService.scheduleLocalNotification({
      title: 'Driver Arrived at Pickup! 🚖',
      body: 'Amit Singh (DL 04 AB 9821) is waiting at Connaught Place. Tap to view ride.',
      data: {
        module: 'RIDE',
        rideId: 'RD-5021',
        rideNumericId: 5021,
      },
    });
    setTestStatus('Sent! Tap the notification banner to test deep link.');
    setTimeout(() => setTestStatus(null), 4000);
  };

  const handleTestDelayedNotification = async () => {
    setTestStatus('Scheduled for 3 seconds from now...');
    await notificationService.scheduleLocalNotification({
      title: 'Flash Sale: 50% Off Electronics! ⚡',
      body: 'Check out newly listed gadgets in Bazaar. Tap to explore.',
      data: {
        module: 'MARKETPLACE',
        listingId: '1',
      },
      delaySeconds: 3,
    });
    setTimeout(() => setTestStatus(null), 5000);
  };

  const renderDevTester = () => {
    if (!__DEV__) return null;
    return (
      <View style={styles.devPanel}>
        <View style={styles.devHeader}>
          <MaterialIcons name="developer-mode" size={16} color={colors.primary} />
          <Text style={styles.devTitle}>PUSH NOTIFICATION TESTER (DEV)</Text>
        </View>

        <Text style={styles.devTokenText} numberOfLines={1}>
          Token: {pushToken || 'Fetching push token...'}
        </Text>

        {testStatus && <Text style={styles.devStatusText}>{testStatus}</Text>}

        <View style={styles.devButtonsRow}>
          <TouchableOpacity
            style={styles.devButton}
            onPress={handleTestOrderNotification}
            activeOpacity={0.7}
          >
            <MaterialIcons name="fastfood" size={14} color={colors.primary} />
            <Text style={styles.devButtonText}>Food Alert</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.devButton}
            onPress={handleTestRideNotification}
            activeOpacity={0.7}
          >
            <MaterialIcons name="directions-car" size={14} color={colors.blue} />
            <Text style={styles.devButtonText}>Ride Alert</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.devButton}
            onPress={handleTestDelayedNotification}
            activeOpacity={0.7}
          >
            <MaterialIcons name="timer" size={14} color={colors.secondary} />
            <Text style={styles.devButtonText}>3s Delay</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

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
        data={notifications}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderDevTester}
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
  devPanel: {
    backgroundColor: 'rgba(255, 107, 0, 0.08)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 0, 0.3)',
    marginBottom: spacing.md,
  },
  devHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  devTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.8,
  },
  devTokenText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  devStatusText: {
    fontSize: 11,
    color: colors.secondary,
    fontWeight: '600',
    marginBottom: 8,
  },
  devButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  devButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: colors.surface,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  devButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textPrimary,
  },
});
