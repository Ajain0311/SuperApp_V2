import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { AppColors } from '../../theme/colors';
import { AppRadius } from '../../theme/spacing';
import { AppButton } from '../../components/common/AppButton';
import { signalRService, OrderStatusEvent } from '../../services/signalr';
import { apiClient } from '../../services/apiClient';
import { ApiEndpoints } from '../../constants/api';

interface FoodOrderTrackingScreenProps {
  route: {
    params: {
      orderId?: string;
      orderNumericId?: number;
    };
  };
  navigation: any;
}

export const FoodOrderTrackingScreen: React.FC<FoodOrderTrackingScreenProps> = ({
  route,
  navigation,
}) => {
  const orderId = route.params?.orderId || 'FO-1002';
  const orderNumericId = route.params?.orderNumericId;
  const [currentStepIndex, setCurrentStepIndex] = useState(1); // Default Kitchen Preparing
  const [etaText, setEtaText] = useState('22 Mins • On Time');
  const [restaurantName, setRestaurantName] = useState('Meghana Foods');
  const [orderStatus, setOrderStatus] = useState<string>('Preparing');

  const mapStatusToStep = (status: string): number => {
    const s = status.toUpperCase();
    if (s === 'PENDING' || s === 'CONFIRMED') return 0;
    if (s === 'PREPARING' || s === 'ACCEPTED') return 1;
    if (s === 'READY' || s === 'READYFORPICKUP') return 2;
    if (s === 'OUT_FOR_DELIVERY' || s === 'PICKEDUP' || s === 'ONTHEWAY') return 3;
    if (s === 'DELIVERED' || s === 'COMPLETED') return 4;
    return 1;
  };

  useEffect(() => {
    if (!orderNumericId) return;

    // Fetch initial order state from API
    apiClient
      .get<any>(ApiEndpoints.food.orderDetail(orderNumericId))
      .then((res) => {
        const data = res.data?.data || res.data;
        if (data) {
          if (data.status) {
            setOrderStatus(data.status);
            setCurrentStepIndex(mapStatusToStep(data.status));
          }
          if (data.restaurantName) {
            setRestaurantName(data.restaurantName);
          }
        }
      })
      .catch(() => {
        // Fallback gracefully
      });

    // Subscribe to live SignalR order hub
    let unsubscribe: (() => void) | undefined;
    signalRService
      .connectOrderHub()
      .then(() => {
        signalRService.joinOrder(orderNumericId);
        unsubscribe = signalRService.onOrderStatusUpdated((event: OrderStatusEvent) => {
          if (event.orderId === orderNumericId) {
            setOrderStatus(event.status);
            setCurrentStepIndex(mapStatusToStep(event.status));
            if (event.estimatedMinutes) {
              setEtaText(`${event.estimatedMinutes} Mins • On Time`);
            }
          }
        });
      })
      .catch(() => {});

    return () => {
      if (orderNumericId) {
        signalRService.leaveOrder(orderNumericId);
      }
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [orderNumericId]);

  const handleCancelOrder = () => {
    if (!orderNumericId) {
      Alert.alert('Order Cancelled', 'Your order was cancelled successfully.');
      navigation.navigate('MainTabs', { screen: 'Food' });
      return;
    }
    Alert.alert(
      'Cancel Order',
      'Are you sure you want to cancel this order?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.post(ApiEndpoints.food.cancelOrder(orderNumericId));
              Alert.alert('Order Cancelled', 'Your order has been cancelled.');
              navigation.navigate('MainTabs', { screen: 'Food' });
            } catch (err: any) {
              const msg = err.response?.data?.message || 'Unable to cancel order at this stage.';
              Alert.alert('Cannot Cancel', msg);
            }
          },
        },
      ]
    );
  };

  const steps = [
    {
      title: 'Order Received',
      subtitle: `${restaurantName} confirmed your order`,
      isCompleted: currentStepIndex > 0,
      isCurrent: currentStepIndex === 0,
    },
    {
      title: 'Kitchen Preparing',
      subtitle: 'Chef is cooking your fresh dishes',
      isCompleted: currentStepIndex > 1,
      isCurrent: currentStepIndex === 1,
    },
    {
      title: 'Ready for Pickup',
      subtitle: 'Delivery partner arrives at restaurant',
      isCompleted: currentStepIndex > 2,
      isCurrent: currentStepIndex === 2,
    },
    {
      title: 'Out for Delivery',
      subtitle: 'Heading to Connaught Place',
      isCompleted: currentStepIndex > 3,
      isCurrent: currentStepIndex === 3,
    },
    {
      title: 'Delivered',
      subtitle: 'Enjoy your meal!',
      isCompleted: currentStepIndex >= 4,
      isCurrent: currentStepIndex === 4,
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* App Bar */}
      <View style={styles.appBar}>
        <TouchableOpacity
          onPress={() => navigation.navigate('MainTabs', { screen: 'Food' })}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>Track Order {orderId}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ETA Card */}
        <LinearGradient
          colors={['#EA580C', '#C2410C']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.etaCard}
        >
          <View style={styles.etaIconCircle}>
            <Ionicons name="bicycle" size={28} color="#FFFFFF" />
          </View>
          <View style={styles.etaTextCol}>
            <Text style={styles.etaCaption}>Estimated Delivery</Text>
            <Text style={styles.etaMainText}>22 Mins • On Time</Text>
            <Text style={styles.etaSubText}>Meghana Foods is preparing your feast</Text>
          </View>
        </LinearGradient>

        {/* Order Progress Stepper */}
        <View style={styles.progressCard}>
          <Text style={styles.cardHeaderTitle}>Order Progress</Text>

          <View style={styles.stepperContainer}>
            {steps.map((step, idx) => {
              const isLast = idx === steps.length - 1;
              const iconColor = step.isCurrent
                ? AppColors.primary
                : step.isCompleted
                ? AppColors.secondary
                : AppColors.textTertiary;

              return (
                <View key={idx}>
                  <View style={styles.stepRow}>
                    <View
                      style={[
                        styles.stepIconCircle,
                        {
                          borderColor: iconColor,
                          backgroundColor: `${iconColor}33`,
                        },
                      ]}
                    >
                      {step.isCompleted ? (
                        <Ionicons name="checkmark" size={13} color={iconColor} />
                      ) : (
                        <View style={[styles.innerDot, { backgroundColor: iconColor }]} />
                      )}
                    </View>

                    <View style={styles.stepTextCol}>
                      <Text
                        style={[
                          styles.stepTitle,
                          {
                            color:
                              step.isCurrent || step.isCompleted
                                ? AppColors.textPrimary
                                : AppColors.textSecondary,
                            fontWeight: step.isCurrent ? '800' : '600',
                          },
                        ]}
                      >
                        {step.title}
                      </Text>
                      <Text style={styles.stepSubtitle}>{step.subtitle}</Text>
                    </View>
                  </View>

                  {!isLast && (
                    <View
                      style={[
                        styles.stepConnector,
                        {
                          backgroundColor: step.isCompleted
                            ? AppColors.secondary
                            : AppColors.border,
                        },
                      ]}
                    />
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {/* Delivery Driver Card */}
        <View style={styles.driverCard}>
          <View style={styles.driverAvatar}>
            <Ionicons name="person" size={26} color={AppColors.secondary} />
          </View>

          <View style={styles.driverDetails}>
            <Text style={styles.driverName}>Ramesh Kumar</Text>
            <Text style={styles.driverRole}>Delivery Partner • 4.9 ★ (840 trips)</Text>
          </View>

          <TouchableOpacity
            style={styles.callButton}
            onPress={() => Alert.alert('Calling Partner', 'Connecting to Ramesh Kumar (+91 98765 00012)...')}
            activeOpacity={0.8}
          >
            <Ionicons name="call" size={20} color={AppColors.secondary} />
          </TouchableOpacity>
        </View>

        {/* Cancel Button if eligible */}
        {currentStepIndex <= 1 && (
          <TouchableOpacity
            style={styles.cancelOrderButton}
            onPress={handleCancelOrder}
            activeOpacity={0.8}
          >
            <Text style={styles.cancelOrderButtonText}>Cancel Food Order</Text>
          </TouchableOpacity>
        )}

        {/* Return Button */}
        <AppButton
          text="Return to SuperApp Home"
          onPressed={() => navigation.navigate('MainTabs', { screen: 'Home' })}
          style={styles.returnButton}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.border,
  },
  backButton: {
    padding: 6,
    marginRight: 10,
  },
  appBarTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: AppColors.textPrimary,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  etaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#EA580C',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 18,
    elevation: 6,
  },
  etaIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  etaTextCol: {
    flex: 1,
  },
  etaCaption: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    fontWeight: '600',
  },
  etaMainText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 2,
  },
  etaSubText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
    marginTop: 2,
  },
  progressCard: {
    backgroundColor: AppColors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: AppColors.border,
    padding: 20,
    marginBottom: 18,
  },
  cardHeaderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: AppColors.textPrimary,
    marginBottom: 16,
  },
  stepperContainer: {
    paddingLeft: 4,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stepIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  innerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stepTextCol: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 14,
  },
  stepSubtitle: {
    fontSize: 12,
    color: AppColors.textTertiary,
    marginTop: 2,
  },
  stepConnector: {
    width: 2,
    height: 22,
    marginLeft: 11,
    marginVertical: 4,
  },
  driverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: AppColors.border,
    padding: 16,
    marginBottom: 24,
  },
  driverAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: `${AppColors.secondary}26`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  driverDetails: {
    flex: 1,
  },
  driverName: {
    fontSize: 15,
    fontWeight: '700',
    color: AppColors.textPrimary,
  },
  driverRole: {
    fontSize: 12,
    color: AppColors.textSecondary,
    marginTop: 2,
  },
  callButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: AppColors.surfaceLight,
    borderWidth: 1,
    borderColor: AppColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  returnButton: {
    marginBottom: 20,
  },
  cancelOrderButton: {
    paddingVertical: 14,
    borderRadius: AppRadius.lg,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  cancelOrderButtonText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '700',
  },
});
