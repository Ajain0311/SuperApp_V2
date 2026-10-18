import React, { useState } from 'react';
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

import { FoodItemVariant, FoodItemAddon } from '../../models/food';

interface PortionOption {
  id?: number;
  name: string;
  price: number;
  label: string;
}

interface AddonOption {
  id?: number;
  name: string;
  price: number;
  selected: boolean;
}

interface ItemCustomizationSheetProps {
  visible: boolean;
  onClose: () => void;
  itemName: string;
  basePrice: number;
  variants?: FoodItemVariant[];
  addons?: FoodItemAddon[];
  onAddToCart: (
    quantity: number,
    portionName: string,
    portionPrice: number,
    addons: string[],
    grandTotal: number,
    variantId?: number | null,
    selectedAddonIds?: number[]
  ) => void;
}

export const ItemCustomizationSheet: React.FC<ItemCustomizationSheetProps> = ({
  visible,
  onClose,
  itemName,
  basePrice,
  variants,
  addons: rawAddons,
  onAddToCart,
}) => {
  const [quantity, setQuantity] = useState(1);
  const [selectedPortionIndex, setSelectedPortionIndex] = useState(0);

  // Initialize portions from backend variants if present
  const portions: PortionOption[] = React.useMemo(() => {
    if (variants && variants.length > 0) {
      return variants.map((v) => ({
        id: v.id,
        name: v.name,
        price: v.additionalPrice,
        label: v.additionalPrice > 0 ? `+₹${v.additionalPrice}` : 'Included',
      }));
    }
    return [
      { name: 'Regular Portion', price: 0, label: 'Included' },
    ];
  }, [variants]);

  // Initialize addons from backend addons if present
  const [addons, setAddons] = useState<AddonOption[]>([]);

  React.useEffect(() => {
    if (rawAddons && rawAddons.length > 0) {
      setAddons(
        rawAddons.map((a) => ({
          id: a.id,
          name: a.name,
          price: a.price,
          selected: Boolean(a.isDefault || a.selected),
        }))
      );
    } else {
      setAddons([]);
    }
  }, [rawAddons]);

  const portionPrice = portions[selectedPortionIndex]?.price || 0;
  const addonsTotal = addons
    .filter((a) => a.selected)
    .reduce((sum, a) => sum + a.price, 0);

  const grandTotal = (basePrice + portionPrice + addonsTotal) * quantity;

  const toggleAddon = (index: number) => {
    const updated = [...addons];
    updated[index].selected = !updated[index].selected;
    setAddons(updated);
  };

  const handleConfirm = () => {
    const selectedAddonObjects = addons.filter((a) => a.selected);
    const selectedAddonNames = selectedAddonObjects.map((a) => a.name);
    const selectedAddonIds = selectedAddonObjects.map((a) => a.id).filter(Boolean) as number[];
    const chosenVariant = portions[selectedPortionIndex];

    onAddToCart(
      quantity,
      chosenVariant ? chosenVariant.name : 'Regular',
      chosenVariant ? chosenVariant.price : 0,
      selectedAddonNames,
      grandTotal,
      chosenVariant?.id ?? null,
      selectedAddonIds
    );
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitles}>
              <Text style={styles.itemName}>{itemName}</Text>
              <Text style={styles.basePriceText}>
                Base: {AppConstants.currency}
                {basePrice.toFixed(0)}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={AppColors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Choose Portion */}
            <Text style={styles.sectionHeader}>CHOOSE PORTION</Text>
            {portions.map((portion, idx) => {
              const isSelected = idx === selectedPortionIndex;
              return (
                <TouchableOpacity
                  key={idx}
                  activeOpacity={0.8}
                  style={[styles.optionRow, isSelected ? styles.optionRowSelected : null]}
                  onPress={() => setSelectedPortionIndex(idx)}
                >
                  <Ionicons
                    name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={isSelected ? AppColors.primary : AppColors.textSecondary}
                  />
                  <Text style={[styles.optionName, isSelected ? styles.optionNameBold : null]}>
                    {portion.name}
                  </Text>
                  <Text style={[styles.optionLabel, isSelected ? styles.optionLabelActive : null]}>
                    {portion.label}
                  </Text>
                </TouchableOpacity>
              );
            })}

            {/* Add-ons */}
            <Text style={[styles.sectionHeader, { marginTop: 16 }]}>ADD-ONS</Text>
            {addons.map((addon, idx) => (
              <TouchableOpacity
                key={idx}
                activeOpacity={0.8}
                style={[styles.optionRow, addon.selected ? styles.optionRowSelected : null]}
                onPress={() => toggleAddon(idx)}
              >
                <Ionicons
                  name={addon.selected ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={addon.selected ? AppColors.primary : AppColors.textSecondary}
                />
                <Text style={[styles.optionName, addon.selected ? styles.optionNameBold : null]}>
                  {addon.name}
                </Text>
                <Text style={styles.optionPrice}>
                  +{AppConstants.currency}
                  {addon.price.toFixed(0)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Bottom Bar */}
          <View style={styles.bottomBar}>
            {/* Stepper */}
            <View style={styles.stepperContainer}>
              <TouchableOpacity
                onPress={() => quantity > 1 && setQuantity(quantity - 1)}
                style={styles.stepperButton}
                disabled={quantity <= 1}
              >
                <Ionicons name="remove" size={18} color={quantity > 1 ? AppColors.textPrimary : AppColors.textTertiary} />
              </TouchableOpacity>
              <Text style={styles.stepperQuantity}>{quantity}</Text>
              <TouchableOpacity
                onPress={() => setQuantity(quantity + 1)}
                style={styles.stepperButton}
              >
                <Ionicons name="add" size={18} color={AppColors.primary} />
              </TouchableOpacity>
            </View>

            {/* Add Button */}
            <TouchableOpacity
              style={styles.addButton}
              onPress={handleConfirm}
              activeOpacity={0.85}
            >
              <Text style={styles.addButtonText}>
                Add Item    {AppConstants.currency}
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
  itemName: {
    fontSize: 18,
    fontWeight: '800',
    color: AppColors.textPrimary,
  },
  basePriceText: {
    fontSize: 14,
    fontWeight: '700',
    color: AppColors.primary,
    marginTop: 4,
  },
  closeButton: {
    padding: 4,
  },
  divider: {
    height: 1,
    backgroundColor: AppColors.border,
  },
  body: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: AppColors.textTertiary,
    letterSpacing: 1.0,
    marginBottom: 8,
    marginLeft: 4,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: AppRadius.md,
    borderWidth: 1,
    borderColor: `${AppColors.border}66`,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  optionRowSelected: {
    backgroundColor: AppColors.surfaceLight,
    borderColor: `${AppColors.primary}80`,
  },
  optionName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: AppColors.textPrimary,
    marginLeft: 12,
  },
  optionNameBold: {
    fontWeight: '700',
  },
  optionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: AppColors.textSecondary,
  },
  optionLabelActive: {
    color: AppColors.primary,
  },
  optionPrice: {
    fontSize: 13,
    fontWeight: '600',
    color: AppColors.textSecondary,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderTopColor: AppColors.border,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.surfaceLight,
    borderRadius: AppRadius.md,
    borderWidth: 1,
    borderColor: AppColors.border,
    height: 48,
    marginRight: 12,
  },
  stepperButton: {
    paddingHorizontal: 12,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperQuantity: {
    fontSize: 16,
    fontWeight: '800',
    color: AppColors.textPrimary,
    minWidth: 20,
    textAlign: 'center',
  },
  addButton: {
    flex: 1,
    height: 48,
    backgroundColor: AppColors.primary,
    borderRadius: AppRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
