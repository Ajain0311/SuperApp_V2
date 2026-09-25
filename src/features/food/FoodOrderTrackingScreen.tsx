import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { AppColors } from '../../theme/colors';
import { AppRadius } from '../../theme/spacing';
import { AppButton } from '../../components/common/AppButton';
import { RatingModal } from '../../components/RatingModal';
import { signalRService, OrderStatusEvent } from '../../services/signalr';
import { apiClient } from '../../services/apiClient';
import { ApiEndpoints } from '../../constants/api';

interface FoodOrderTrackingScreenProps {
  route: {
    params?: {
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
  const initialOrderId = route.params?.orderId;
  const initialOrderNumericId = route.params?.orderNumericId;

  const [isLoading, setIsLoading] = useState(true);
  const [orderNumericId, setOrderNumericId] = useState<number | undefined>(initialOrderNumericId);
  const [orderNumber, setOrderNumber] = useState<string>(initialOrderId || '');
  const [orderData, setOrderData] = useState<any>(null);

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [etaText, setEtaText] = useState('25 Mins • Estimated Delivery');
  const [restaurantName, setRestaurantName] = useState('Restaurant');
  const [restaurantPhone, setRestaurantPhone] = useState('');
  const [restaurantAddress, setRestaurantAddress] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [restaurantId, setRestaurantId] = useState<number>(1);
  const [orderStatus, setOrderStatus] = useState<string>('PENDING');
  const [showRatingModal, setShowRatingModal] = useState<boolean>(false);

  const mapStatusToStep = (status: string): number => {
    const s = (status || '').toUpperCase();
    if (s === 'PENDING' || s === 'CONFIRMED') return 0;
    if (s === 'ACCEPTED' || s === 'PREPARING') return 1;
    if (s === 'READY' || s === 'READYFORPICKUP') return 2;
    if (s === 'OUT_FOR_DELIVERY' || s === 'PICKEDUP' || s === 'ONTHEWAY') return 3;
    if (s === 'DELIVERED' || s === 'COMPLETED') return 4;
    return 0;
  };

  const getStatusHeadline = (status: string): string => {
    const s = (status || '').toUpperCase();
    if (s === 'PENDING') return 'Order Placed & Awaiting Confirmation';
    if (s === 'ACCEPTED') return 'Restaurant Confirmed Your Order';
    if (s === 'PREPARING') return 'Chef is Cooking Your Fresh Meal';
    if (s === 'READY') return 'Order Packed & Ready for Pickup';
    if (s === 'OUT_FOR_DELIVERY') return 'Driver Out for Delivery to Your Door';
    if (s === 'DELIVERED') return 'Order Delivered! Enjoy Your Food';
    if (s === 'CANCELLED') return 'Order Cancelled';
    return 'Processing Your Order';
  };

  useEffect(() => {
    let isMounted = true;

    const loadOrder = async () => {
      setIsLoading(true);
      try {
        let activeNumericId = orderNumericId;

        // If no numeric ID provided in params, fetch user's most recent orders from API
        if (!activeNumericId) {
          const listRes = await apiClient.get<any>(ApiEndpoints.food.orders);
          const raw = listRes.data?.data || listRes.data;
          const items = Array.isArray(raw) ? raw : [];
          if (items.length > 0) {
            // Find first active order, or fallback to the latest order
            const active = items.find((o: any) =>
              ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'].includes(
                String(o.status || '').toUpperCase()
              )
            ) || items[0];
            activeNumericId = active.id;
            if (isMounted) {
              setOrderNumericId(active.id);
              setOrderNumber(active.orderNumber || `FO-${active.id}`);
            }
          }
        }

        if (activeNumericId) {
          const res = await apiClient.get<any>(ApiEndpoints.food.orderDetail(activeNumericId));
          const data = res.data?.data || res.data;
          if (data && isMounted) {
            setOrderData(data);
            setOrderNumber(data.orderNumber || `FO-${data.id}`);
            setOrderStatus(data.status || 'PENDING');
            setCurrentStepIndex(mapStatusToStep(data.status));
            if (data.restaurantName) setRestaurantName(data.restaurantName);
            if (data.restaurantPhone) setRestaurantPhone(data.restaurantPhone);
            if (data.restaurantAddress) setRestaurantAddress(data.restaurantAddress);
            if (data.deliveryAddress) setDeliveryAddress(data.deliveryAddress);
            if (data.restaurantId) setRestaurantId(data.restaurantId);
            if (data.estimatedDeliveryMinutes) {
              setEtaText(`${data.estimatedDeliveryMinutes} Mins • Estimated Delivery`);
            }
          }
        }
      } catch (err) {
        console.warn('[FoodOrderTracking] Error fetching order details:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadOrder();

    return () => {
      isMounted = false;
    };
  }, [initialOrderNumericId]);

  // Subscribe to live SignalR order hub
  useEffect(() => {
    if (!orderNumericId) return;

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

  const handleCallOwner = () => {
    const phoneToCall = restaurantPhone || '+919845012345';
    const rawNumber = phoneToCall.replace(/\s+/g, '');
    const url = `tel:${rawNumber}`;
    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          Linking.openURL(url);
        } else {
          Alert.alert('Restaurant Contact', `Call Restaurant Owner directly at:\n${phoneToCall}`);
        }
      })
      .catch(() => {
        Alert.alert('Restaurant Contact', `Call Restaurant Owner directly at:\n${phoneToCall}`);
      });
  };

  const handleCancelOrder = () => {
    if (!orderNumericId) {
      Alert.alert('Notice', 'Cannot cancel an unverified order.');
      return;
    }
    Alert.alert(
      'Cancel Order',
      'Are you sure you want to cancel this food order?',
      [
        { text: 'Keep Order', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.post(ApiEndpoints.food.cancelOrder(orderNumericId));
              setOrderStatus('CANCELLED');
              Alert.alert('Order Cancelled', 'Your food order has been cancelled.');
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
      subtitle: 'Chef is preparing your fresh meal',
      isCompleted: currentStepIndex > 1,
      isCurrent: currentStepIndex === 1,
    },
    {
      title: 'Ready for Pickup',
      subtitle: 'Dishes packed & ready at restaurant counter',
      isCompleted: currentStepIndex > 2,
      isCurrent: currentStepIndex === 2,
    },
    {
      title: 'Out for Delivery',
      subtitle: deliveryAddress ? `Heading to ${deliveryAddress}` : 'Delivery executive is on the way',
      isCompleted: currentStepIndex > 3,
      isCurrent: currentStepIndex === 3,
    },
    {
      title: 'Delivered',
      subtitle: 'Meal delivered hot & fresh. Enjoy!',
      isCompleted: currentStepIndex >= 4,
      isCurrent: currentStepIndex === 4,
    },
  ];

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.appBar}>
          <TouchableOpacity
            onPress={() => {
              if (navigation.canGoBack()) navigation.goBack();
              else navigation.navigate('MainTabs', { screen: 'Food' });
            }}
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.appBarTitle}>Live Order Tracker</Text>
        </View>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={AppColors.primary} />
          <Text style={styles.loadingText}>Fetching real-time order data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!orderData && !orderNumericId) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.appBar}>
          <TouchableOpacity
            onPress={() => {
              if (navigation.canGoBack()) navigation.goBack();
              else navigation.navigate('MainTabs', { screen: 'Food' });
            }}
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.appBarTitle}>Order Tracker</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Ionicons name="fast-food-outline" size={64} color={AppColors.textTertiary} />
          <Text style={styles.emptyTitle}>No Active Orders</Text>
          <Text style={styles.emptySubtitle}>
            You do not have any active food orders in progress. Order your favorite dishes from top restaurants!
          </Text>
          <AppButton
            text="Explore Restaurants"
            onPressed={() => navigation.navigate('MainTabs', { screen: 'Food' })}
            style={{ width: '80%', marginTop: 20 }}
          />
        </View>
      </SafeAreaView>
    );
  }

  const items = orderData?.items || [];
  const subTotal = orderData?.subTotal ?? 0;
  const deliveryFee = orderData?.deliveryFee ?? 0;
  const taxAmount = orderData?.taxAmount ?? 0;
  const couponDiscount = orderData?.couponDiscount ?? 0;
  const grandTotal = orderData?.grandTotal ?? 0;
  const isCancelled = orderStatus.toUpperCase() === 'CANCELLED';

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* App Bar */}
      <View style={styles.appBar}>
        <TouchableOpacity
          onPress={() => {
            if (navigation.canGoBack()) navigation.goBack();
            else navigation.navigate('MainTabs', { screen: 'Food' });
          }}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.appBarTitle} numberOfLines={1}>
            Order #{orderNumber || 'Active'}
          </Text>
          <Text style={styles.appBarSubtitle}>{restaurantName}</Text>
        </View>
        <View style={[styles.statusChip, isCancelled && { backgroundColor: 'rgba(239, 68, 68, 0.2)' }]}>
          <Text style={[styles.statusChipText, isCancelled && { color: '#EF4444' }]}>
            {orderStatus.toUpperCase()}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ETA & Status Headline Card */}
        <LinearGradient
          colors={isCancelled ? ['#DC2626', '#991B1B'] : ['#EA580C', '#C2410C']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.etaCard}
        >
          <View style={styles.etaIconCircle}>
            <Ionicons
              name={isCancelled ? 'close-circle' : currentStepIndex >= 4 ? 'checkmark-circle' : 'bicycle'}
              size={28}
              color="#FFFFFF"
            />
          </View>
          <View style={styles.etaTextCol}>
            <Text style={styles.etaCaption}>
              {isCancelled ? 'Order Status' : 'Estimated Delivery Time'}
            </Text>
            <Text style={styles.etaMainText}>{isCancelled ? 'CANCELLED' : etaText}</Text>
            <Text style={styles.etaSubText}>{getStatusHeadline(orderStatus)}</Text>
          </View>
        </LinearGradient>

        {/* RESTAURANT & OWNER CONTACT CARD (Direct Requirement) */}
        <View style={styles.restaurantCard}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.sectionBadge}>
              <Ionicons name="restaurant" size={13} color={AppColors.primary} />
              <Text style={styles.sectionBadgeText}>RESTAURANT & OWNER CONTACT</Text>
            </View>
          </View>

          <View style={styles.restaurantBody}>
            <View style={styles.restaurantAvatar}>
              <Ionicons name="storefront" size={26} color={AppColors.primary} />
            </View>
            <View style={styles.restaurantInfoCol}>
              <Text style={styles.restaurantTitleText} numberOfLines={1}>
                {restaurantName}
              </Text>
              {restaurantAddress ? (
                <Text style={styles.restaurantAddressText} numberOfLines={2}>
                  📍 {restaurantAddress}
                </Text>
              ) : null}
              <View style={styles.phoneRow}>
                <Ionicons name="call-outline" size={14} color={AppColors.secondary} />
                <Text style={styles.phoneHighlightText}>
                  Owner Phone: {restaurantPhone || '+91 98450 12345'}
                </Text>
              </View>
            </View>
          </View>

          {/* Dedicated Call Restaurant Owner Button */}
          <TouchableOpacity
            style={styles.callOwnerButton}
            onPress={handleCallOwner}
            activeOpacity={0.85}
          >
            <Ionicons name="call" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.callOwnerButtonText}>
              Call Restaurant Owner ({restaurantPhone || '+91 98450 12345'})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Real-time Order Stepper */}
        {!isCancelled && (
          <View style={styles.progressCard}>
            <Text style={styles.cardHeaderTitle}>Live Order Tracking</Text>

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
        )}

        {/* Customer Delivery Address */}
        {deliveryAddress ? (
          <View style={styles.addressCard}>
            <View style={styles.addressIconBox}>
              <Ionicons name="location" size={22} color={AppColors.secondary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.addressKicker}>DELIVERY DESTINATION</Text>
              <Text style={styles.addressBodyText}>{deliveryAddress}</Text>
            </View>
          </View>
        ) : null}

        {/* Ordered Food Items List & Bill Breakdown */}
        {items.length > 0 ? (
          <View style={styles.orderSummaryCard}>
            <Text style={styles.cardHeaderTitle}>Order Summary ({items.length} item{items.length > 1 ? 's' : ''})</Text>
            {items.map((it: any, index: number) => (
              <View key={index} style={styles.itemRow}>
                <View style={styles.itemQuantityBadge}>
                  <Text style={styles.itemQuantityText}>{it.quantity}x</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemNameText}>{it.itemName}</Text>
                  {it.variantName ? (
                    <Text style={styles.itemVariantText}>Variant: {it.variantName}</Text>
                  ) : null}
                  {it.addonsSummary ? (
                    <Text style={styles.itemAddonsText}>{it.addonsSummary}</Text>
                  ) : null}
                </View>
                <Text style={styles.itemPriceText}>₹{it.totalPrice?.toFixed(0) || (it.unitPrice * it.quantity).toFixed(0)}</Text>
              </View>
            ))}

            <View style={styles.divider} />

            {/* Price Calculations */}
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Item Subtotal</Text>
              <Text style={styles.billValue}>₹{subTotal.toFixed(0)}</Text>
            </View>
            {couponDiscount > 0 ? (
              <View style={styles.billRow}>
                <Text style={[styles.billLabel, { color: AppColors.secondary }]}>Coupon Discount</Text>
                <Text style={[styles.billValue, { color: AppColors.secondary }]}>-₹{couponDiscount.toFixed(0)}</Text>
              </View>
            ) : null}
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Delivery Partner Fee</Text>
              <Text style={styles.billValue}>₹{deliveryFee.toFixed(0)}</Text>
            </View>
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Taxes & GST (5%)</Text>
              <Text style={styles.billValue}>₹{taxAmount.toFixed(0)}</Text>
            </View>

            <View style={[styles.divider, { marginVertical: 10 }]} />

            <View style={styles.billRow}>
              <Text style={styles.grandTotalLabel}>Total Paid / To Pay</Text>
              <Text style={styles.grandTotalValue}>₹{grandTotal.toFixed(0)}</Text>
            </View>
            <Text style={styles.paymentMethodCaption}>
              Payment: {orderData?.paymentMethod === 'ONLINE' ? 'Paid Online via Easebuzz' : 'Cash On Delivery'}
            </Text>
          </View>
        ) : null}

        {/* Cancel Order Button */}
        {!isCancelled && currentStepIndex <= 1 && (
          <TouchableOpacity
            style={styles.cancelOrderButton}
            onPress={handleCancelOrder}
            activeOpacity={0.8}
          >
            <Text style={styles.cancelOrderButtonText}>Cancel Food Order</Text>
          </TouchableOpacity>
        )}

        {/* Rate Order Button when Delivered */}
        {!isCancelled && currentStepIndex >= 4 && (
          <TouchableOpacity
            style={styles.rateOrderButton}
            onPress={() => setShowRatingModal(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="star" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.rateOrderButtonText}>Rate Restaurant & Food</Text>
          </TouchableOpacity>
        )}

        {/* Return Button */}
        <AppButton
          text="Return to SuperApp Home"
          onPressed={() => navigation.navigate('MainTabs', { screen: 'Home' })}
          style={styles.returnButton}
        />
      </ScrollView>

      {/* Rating Modal */}
      <RatingModal
        visible={showRatingModal}
        targetType="RESTAURANT"
        targetId={restaurantId}
        title="Rate Restaurant & Food"
        subtitle={restaurantName}
        onClose={() => setShowRatingModal(false)}
      />
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
    backgroundColor: AppColors.surface,
    gap: 12,
  },
  backButton: {
    padding: 6,
  },
  appBarTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: AppColors.textPrimary,
  },
  appBarSubtitle: {
    fontSize: 12,
    color: AppColors.textTertiary,
    marginTop: 1,
  },
  statusChip: {
    backgroundColor: `${AppColors.primary}26`,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusChipText: {
    color: AppColors.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    color: AppColors.textSecondary,
    fontSize: 14,
    marginTop: 12,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyTitle: {
    color: AppColors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    marginTop: 16,
  },
  emptySubtitle: {
    color: AppColors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  etaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
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
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 12,
    fontWeight: '700',
  },
  etaMainText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 2,
  },
  etaSubText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 13,
    marginTop: 2,
  },
  restaurantCard: {
    backgroundColor: AppColors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: AppColors.border,
    padding: 16,
    marginBottom: 16,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: AppColors.primary,
    letterSpacing: 0.5,
  },
  restaurantBody: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  restaurantAvatar: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: `${AppColors.primary}22`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  restaurantInfoCol: {
    flex: 1,
  },
  restaurantTitleText: {
    fontSize: 16,
    fontWeight: '800',
    color: AppColors.textPrimary,
  },
  restaurantAddressText: {
    fontSize: 12,
    color: AppColors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  phoneHighlightText: {
    fontSize: 13,
    fontWeight: '700',
    color: AppColors.secondary,
  },
  callOwnerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  callOwnerButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  progressCard: {
    backgroundColor: AppColors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: AppColors.border,
    padding: 20,
    marginBottom: 16,
  },
  cardHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
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
  addressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: AppColors.border,
    padding: 14,
    marginBottom: 16,
    gap: 12,
  },
  addressIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: `${AppColors.secondary}22`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressKicker: {
    fontSize: 10,
    fontWeight: '800',
    color: AppColors.secondary,
    letterSpacing: 0.5,
  },
  addressBodyText: {
    fontSize: 13,
    color: AppColors.textPrimary,
    marginTop: 2,
    lineHeight: 18,
  },
  orderSummaryCard: {
    backgroundColor: AppColors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: AppColors.border,
    padding: 18,
    marginBottom: 16,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 10,
  },
  itemQuantityBadge: {
    backgroundColor: `${AppColors.primary}22`,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  itemQuantityText: {
    fontSize: 12,
    fontWeight: '800',
    color: AppColors.primary,
  },
  itemNameText: {
    fontSize: 14,
    fontWeight: '700',
    color: AppColors.textPrimary,
  },
  itemVariantText: {
    fontSize: 12,
    color: AppColors.textSecondary,
    marginTop: 1,
  },
  itemAddonsText: {
    fontSize: 11,
    color: AppColors.textTertiary,
    marginTop: 1,
  },
  itemPriceText: {
    fontSize: 14,
    fontWeight: '800',
    color: AppColors.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: AppColors.border,
    marginVertical: 8,
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 3,
  },
  billLabel: {
    fontSize: 13,
    color: AppColors.textSecondary,
  },
  billValue: {
    fontSize: 13,
    fontWeight: '700',
    color: AppColors.textPrimary,
  },
  grandTotalLabel: {
    fontSize: 15,
    fontWeight: '900',
    color: AppColors.textPrimary,
  },
  grandTotalValue: {
    fontSize: 17,
    fontWeight: '900',
    color: AppColors.primary,
  },
  paymentMethodCaption: {
    fontSize: 11,
    color: AppColors.textTertiary,
    marginTop: 4,
    fontStyle: 'italic',
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
  rateOrderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: AppRadius.lg,
    backgroundColor: '#F59E0B',
    marginBottom: 12,
  },
  rateOrderButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
