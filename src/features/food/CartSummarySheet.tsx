import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppColors } from '../../theme/colors';
import { AppRadius } from '../../theme/spacing';
import { AppConstants } from '../../constants/app';
import { CartItem } from '../../models/food';

interface CartSummarySheetProps {
  visible: boolean;
  onClose: () => void;
  restaurantName: string;
  cartItems: CartItem[];
  onClear: () => void;
  onOrderPlaced: () => void;
}

export const CartSummarySheet: React.FC<CartSummarySheetProps> = ({
  visible,
  onClose,
  restaurantName,
  cartItems,
  onClear,
  onOrderPlaced,
}) => {
  const itemTotal = cartItems.reduce((sum, item) => sum + item.totalPrice, 0);
  const deliveryFee = 0; // FREE
  const taxesAndPackaging = Math.round(itemTotal * 0.05 * 100) / 100; // 5% GST
  const grandTotal = itemTotal + deliveryFee + taxesAndPackaging;

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

            {/* Bill Breakdown */}
            <View style={styles.billBox}>
              <View style={styles.billRow}>
                <Text style={styles.billLabel}>Item Total</Text>
                <Text style={styles.billValue}>
                  {AppConstants.currency}
                  {itemTotal.toFixed(0)}
                </Text>
              </View>

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
                onClose();
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.clearButtonText}>Clear</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.placeOrderButton}
              onPress={() => {
                onClose();
                onOrderPlaced();
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.placeOrderText}>
                Place Food Order    {AppConstants.currency}
                {grandTotal.toFixed(0)}
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
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  itemsList: {
    marginBottom: 12,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: AppColors.surfaceLight,
    borderRadius: AppRadius.md,
    borderWidth: 1,
    borderColor: `${AppColors.border}80`,
    padding: 14,
    marginBottom: 8,
  },
  itemInfo: {
    flex: 1,
    marginRight: 12,
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
    color: AppColors.primaryLight,
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
    fontSize: 11,
    color: AppColors.textTertiary,
    marginTop: 2,
  },
  billBox: {
    backgroundColor: AppColors.surfaceLight,
    borderRadius: AppRadius.lg,
    borderWidth: 1,
    borderColor: AppColors.border,
    padding: 16,
    marginBottom: 16,
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
    fontWeight: '800',
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
  },
  grandTotalLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: AppColors.textPrimary,
  },
  grandTotalValue: {
    fontSize: 18,
    fontWeight: '900',
    color: AppColors.textPrimary,
  },
  actionsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderTopColor: AppColors.border,
  },
  clearButton: {
    height: 50,
    paddingHorizontal: 18,
    backgroundColor: AppColors.surfaceLight,
    borderRadius: AppRadius.md,
    borderWidth: 1,
    borderColor: AppColors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  clearButtonText: {
    color: AppColors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  placeOrderButton: {
    flex: 1,
    height: 50,
    backgroundColor: AppColors.primary,
    borderRadius: AppRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeOrderText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
