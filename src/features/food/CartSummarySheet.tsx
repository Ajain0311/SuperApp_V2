import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppColors } from '../../theme/colors';
import { AppRadius } from '../../theme/spacing';
import { AppConstants } from '../../constants/app';
import { CartItem } from '../../models/food';
import { apiClient } from '../../services/apiClient';
import { ApiEndpoints } from '../../constants/api';

interface CartSummarySheetProps {
  visible: boolean;
  onClose: () => void;
  restaurantName: string;
  cartItems: CartItem[];
  onClear: () => void;
  onOrderPlaced: (couponCode?: string) => void;
  isSubmitting?: boolean;
}

export const CartSummarySheet: React.FC<CartSummarySheetProps> = ({
  visible,
  onClose,
  restaurantName,
  cartItems,
  onClear,
  onOrderPlaced,
  isSubmitting = false,
}) => {
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [couponMessage, setCouponMessage] = useState<string | null>(null);
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);

  const itemTotal = cartItems.reduce((sum, item) => sum + item.totalPrice, 0);
  const deliveryFee = 0; // FREE
  const discountedSubtotal = Math.max(0, itemTotal - discountAmount);
  const taxesAndPackaging = Math.round(discountedSubtotal * 0.05 * 100) / 100; // 5% GST
  const grandTotal = discountedSubtotal + deliveryFee + taxesAndPackaging;

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setIsValidatingCoupon(true);
    setCouponMessage(null);
    try {
      const res = await apiClient.post<any>(ApiEndpoints.food.validateCoupon, {
        code: couponCode.trim().toUpperCase(),
        orderAmount: itemTotal,
        module: 'FOOD',
      });
      const data = res.data?.data || res.data;
      if (data?.isValid) {
        setAppliedCoupon(data.code || couponCode.trim().toUpperCase());
        setDiscountAmount(Number(data.discountAmount) || 0);
        setCouponMessage(data.message || `Coupon applied! You saved ₹${data.discountAmount}`);
      } else {
        setAppliedCoupon(null);
        setDiscountAmount(0);
        setCouponMessage(data?.message || 'Invalid coupon code');
      }
    } catch (err: any) {
      setAppliedCoupon(null);
      setDiscountAmount(0);
      setCouponMessage(err?.message || 'Could not validate coupon');
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setDiscountAmount(0);
    setCouponMessage(null);
    setCouponCode('');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitles}>
              <Text style={styles.title}>Your Cart Summary</Text>
              <Text style={styles.subtitle}>Ordering from {restaurantName}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={AppColors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
            {/* Items List */}
            <View style={styles.itemsList}>
              {cartItems.map((item, idx) => (
                <View key={idx} style={styles.itemCard}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemTitle}>{item.name}</Text>
                    {Boolean(item.portionName && item.portionName.length > 0) && (
                      <Text style={styles.itemPortion}>{item.portionName}</Text>
                    )}
                    {Boolean(item.addons && item.addons.length > 0) && (
                      <Text style={styles.itemAddons}>{item.addons.join(', ')}</Text>
                    )}
                  </View>
                  <View style={styles.itemPriceCol}>
                    <Text style={styles.itemPrice}>
                      {AppConstants.currency}
                      {item.totalPrice.toFixed(0)}
                    </Text>
                    <Text style={styles.itemQuantity}>Qty: {item.quantity}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Coupon Code Section */}
            <View style={styles.couponSection}>
              <View style={styles.couponInputRow}>
                <View style={styles.couponInputBox}>
                  <Ionicons name="pricetag-outline" size={18} color={AppColors.primary} style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.couponInput}
                    placeholder="Enter Coupon (e.g. WELCOME50)"
                    placeholderTextColor={AppColors.textTertiary}
                    value={couponCode}
                    onChangeText={setCouponCode}
                    autoCapitalize="characters"
                    editable={!appliedCoupon && !isValidatingCoupon}
                  />
                </View>
                {appliedCoupon ? (
                  <TouchableOpacity style={styles.removeCouponBtn} onPress={handleRemoveCoupon}>
                    <Text style={styles.removeCouponText}>Remove</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.applyCouponBtn, (!couponCode.trim() || isValidatingCoupon) && { opacity: 0.6 }]}
                    onPress={handleApplyCoupon}
                    disabled={!couponCode.trim() || isValidatingCoupon}
                  >
                    {isValidatingCoupon ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.applyCouponText}>Apply</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>

              {couponMessage ? (
                <Text style={[styles.couponMessageText, appliedCoupon ? styles.couponSuccess : styles.couponError]}>
                  {couponMessage}
                </Text>
              ) : null}
            </View>

            {/* Bill Breakdown */}
            <View style={styles.billBox}>
              <View style={styles.billRow}>
                <Text style={styles.billLabel}>Item Total</Text>
                <Text style={styles.billValue}>
                  {AppConstants.currency}
                  {itemTotal.toFixed(0)}
                </Text>
              </View>

              {discountAmount > 0 && (
                <View style={styles.billRow}>
                  <Text style={[styles.billLabel, { color: AppColors.secondary }]}>Coupon Discount ({appliedCoupon})</Text>
                  <Text style={[styles.billValue, { color: AppColors.secondary }]}>
                    -{AppConstants.currency}{discountAmount.toFixed(0)}
                  </Text>
                </View>
              )}

              <View style={styles.billRow}>
                <Text style={styles.billLabel}>Delivery Partner Fee</Text>
                <Text style={[styles.billValue, styles.freeDeliveryText]}>FREE</Text>
              </View>

              <View style={styles.billRow}>
                <Text style={styles.billLabel}>Govt. Taxes & Restaurant Packaging</Text>
                <Text style={styles.billValue}>
                  {AppConstants.currency}
                  {taxesAndPackaging.toFixed(0)}
                </Text>
              </View>

              <View style={styles.billDivider} />

              <View style={styles.grandTotalRow}>
                <Text style={styles.grandTotalLabel}>Grand Total</Text>
                <Text style={styles.grandTotalValue}>
                  {AppConstants.currency}
                  {grandTotal.toFixed(0)}
                </Text>
              </View>
            </View>
          </ScrollView>

          {/* Action Bar */}
          <View style={styles.actionsBar}>
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => {
                onClear();
                handleRemoveCoupon();
                onClose();
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.clearButtonText}>Clear</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.placeOrderButton, isSubmitting && { opacity: 0.7 }]}
              onPress={() => onOrderPlaced(appliedCoupon || undefined)}
              disabled={isSubmitting}
              activeOpacity={0.85}
            >
              <Text style={styles.placeOrderText}>
                {isSubmitting
                  ? 'Placing Order...'
                  : `Place Food Order    ${AppConstants.currency}${grandTotal.toFixed(0)}`}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: AppColors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
  },
  headerTitles: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: AppColors.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: AppColors.textSecondary,
    marginTop: 2,
  },
  closeButton: {
    padding: 4,
  },
  divider: {
    height: 1,
    backgroundColor: AppColors.border,
  },
  scrollArea: {
    paddingHorizontal: 20,
  },
  itemsList: {
    paddingTop: 16,
    paddingBottom: 8,
  },
  itemCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.surfaceLight,
  },
  itemInfo: {
    flex: 1,
    paddingRight: 16,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: AppColors.textPrimary,
  },
  itemPortion: {
    fontSize: 12,
    color: AppColors.textSecondary,
    marginTop: 2,
  },
  itemAddons: {
    fontSize: 11,
    color: AppColors.textTertiary,
    marginTop: 2,
  },
  itemPriceCol: {
    alignItems: 'flex-end',
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: AppColors.textPrimary,
  },
  itemQuantity: {
    fontSize: 12,
    color: AppColors.textSecondary,
    marginTop: 2,
  },
  couponSection: {
    marginVertical: 12,
    backgroundColor: AppColors.surfaceLight,
    padding: 12,
    borderRadius: AppRadius.md,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  couponInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  couponInputBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: AppRadius.sm,
    borderWidth: 1,
    borderColor: AppColors.border,
    marginRight: 10,
  },
  couponInput: {
    flex: 1,
    color: AppColors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    padding: 0,
  },
  applyCouponBtn: {
    backgroundColor: AppColors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: AppRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  applyCouponText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  removeCouponBtn: {
    backgroundColor: `${AppColors.error}22`,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: AppRadius.sm,
    borderWidth: 1,
    borderColor: AppColors.error,
  },
  removeCouponText: {
    color: AppColors.error,
    fontWeight: '700',
    fontSize: 13,
  },
  couponMessageText: {
    fontSize: 12,
    marginTop: 8,
    fontWeight: '600',
  },
  couponSuccess: {
    color: AppColors.secondary,
  },
  couponError: {
    color: AppColors.error,
  },
  billBox: {
    backgroundColor: AppColors.surfaceLight,
    borderRadius: AppRadius.md,
    padding: 16,
    marginVertical: 12,
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  billLabel: {
    fontSize: 13,
    color: AppColors.textSecondary,
  },
  billValue: {
    fontSize: 13,
    fontWeight: '600',
    color: AppColors.textPrimary,
  },
  freeDeliveryText: {
    color: AppColors.secondary,
    fontWeight: '700',
  },
  billDivider: {
    height: 1,
    backgroundColor: AppColors.border,
    marginVertical: 10,
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  grandTotalLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: AppColors.textPrimary,
  },
  grandTotalValue: {
    fontSize: 18,
    fontWeight: '900',
    color: AppColors.primary,
  },
  actionsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: AppColors.border,
    backgroundColor: AppColors.surface,
  },
  clearButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginRight: 10,
    borderRadius: AppRadius.md,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: AppColors.textSecondary,
  },
  placeOrderButton: {
    flex: 1,
    backgroundColor: AppColors.primary,
    paddingVertical: 14,
    borderRadius: AppRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeOrderText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
