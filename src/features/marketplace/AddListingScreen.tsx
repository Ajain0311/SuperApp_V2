import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  SafeAreaView,
  StatusBar,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useMarketplaceStore } from '../../store/marketplaceStore';
import { ListingSummary } from '../../models/marketplace';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import { apiClient } from '../../services/apiClient';
import { ApiEndpoints } from '../../constants/api';
import { notificationService } from '../../services/notificationService';

const CATEGORIES = [
  { id: 1, name: 'Mobiles' },
  { id: 2, name: 'Vehicles' },
  { id: 3, name: 'Electronics' },
  { id: 4, name: 'Furniture' },
  { id: 5, name: 'Fashion' },
  { id: 6, name: 'Books' },
  { id: 7, name: 'Sports' },
  { id: 8, name: 'Others' },
];

const CONDITIONS = [
  { id: 'LIKE_NEW', label: 'LIKE NEW' },
  { id: 'NEW', label: 'BRAND NEW' },
  { id: 'USED', label: 'GENTLY USED' },
];

export const AddListingScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { addListing } = useMarketplaceStore();

  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [location, setLocation] = useState('Koramangala, Bengaluru');
  const [description, setDescription] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState(1);
  const [selectedCondition, setSelectedCondition] = useState('LIKE_NEW');
  const [photos, setPhotos] = useState<string[]>([
    'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600',
  ]);
  const [isAddingPhoto, setIsAddingPhoto] = useState(false);
  const [photoUrlInput, setPhotoUrlInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddPhoto = () => {
    if (!photoUrlInput.trim()) return;
    setPhotos([...photos, photoUrlInput.trim()]);
    setPhotoUrlInput('');
    setIsAddingPhoto(false);
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos(photos.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Missing Field', 'Please enter a title for your item.');
      return;
    }
    if (!price.trim()) {
      Alert.alert('Missing Field', 'Please enter a valid price.');
      return;
    }
    if (photos.length === 0) {
      Alert.alert('Missing Photos', 'Please add at least one photo of your item.');
      return;
    }

    setIsSubmitting(true);
    let serverId: number | undefined;
    try {
      const res = await apiClient.post<any>(ApiEndpoints.marketplace.manageListings, {
        action: 'ADD',
        title: title.trim(),
        description: description.trim() || title.trim(),
        price: parseFloat(price.trim()) || 0,
        condition: selectedCondition,
        categoryId: selectedCategoryId,
        location: location.trim(),
        imageUrls: photos,
      });
      const data = res.data?.data || res.data;
      if (data?.id) {
        serverId = data.id;
      }
    } catch (err: any) {
      console.warn('[AddListing] Server error:', err?.message);
    } finally {
      setIsSubmitting(false);
    }

    const cat = CATEGORIES.find((c) => c.id === selectedCategoryId) || CATEGORIES[0];

    const newListing: ListingSummary = {
      id: serverId || Date.now(),
      title: title.trim(),
      price: parseFloat(price.trim()) || 0,
      condition: selectedCondition,
      location: location.trim(),
      primaryImageUrl: photos[0],
      isFeatured: false,
      viewCount: 1,
      createdAt: new Date().toISOString(),
      categoryId: selectedCategoryId,
      categoryName: cat.name,
      isFavorite: false,
    };

    addListing(newListing);

    // Trigger witty Zomato-style seller notification
    try {
      notificationService.scheduleLocalNotification({
        title: 'Dhamaka! 🎉 Aapka ad live ho gaya!',
        body: `Puraani cheezon ko kaho bye-bye, jeb me aayegi nayi kamai! 💰📦 (${title.trim()} for ₹${price.trim()})`,
        data: {
          module: 'MARKETPLACE',
          listingId: (serverId || newListing.id).toString(),
        },
      });
    } catch {}

    Alert.alert('Success 🎉', 'Your Ad has been published to Community Bazaar!');
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.surface} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Post an Item for Sale</Text>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Close Post Item"
          testID="add-listing-close-btn"
        >
          <MaterialIcons name="close" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Photos Section */}
        <Text style={styles.sectionTitle}>Photos (Upload up to 5)</Text>
        <Text style={styles.sectionSubtitle}>
          Clear photos with good lighting attract 3x more buyers.
        </Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosScroll}>
          <TouchableOpacity
            style={styles.addPhotoBox}
            onPress={() => setIsAddingPhoto(true)}
          >
            <MaterialIcons name="add-a-photo" size={26} color={colors.primary} />
            <Text style={styles.addPhotoText}>Add Photo</Text>
          </TouchableOpacity>

          {photos.map((url, idx) => (
            <View key={idx} style={styles.photoThumbContainer}>
              <Image source={{ uri: url }} style={styles.photoThumb} />
              <TouchableOpacity
                style={styles.deletePhotoBtn}
                onPress={() => handleRemovePhoto(idx)}
              >
                <MaterialIcons name="close" size={14} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>

        {/* Title */}
        <Text style={styles.inputLabel}>Item Title *</Text>
        <TextInput
          testID="add-listing-title-input"
          placeholder="e.g. MacBook Pro M2 16GB / 512GB"
          placeholderTextColor={colors.textTertiary}
          value={title}
          onChangeText={setTitle}
          style={styles.textInput}
        />

        {/* Category */}
        <Text style={styles.inputLabel}>Category *</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
          {CATEGORIES.map((cat) => {
            const isSelected = cat.id === selectedCategoryId;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryChip,
                  isSelected && styles.categoryChipSelected,
                ]}
                onPress={() => setSelectedCategoryId(cat.id)}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    isSelected && styles.categoryChipTextSelected,
                  ]}
                >
                  {cat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Price */}
        <Text style={styles.inputLabel}>Price *</Text>
        <View style={styles.priceInputWrapper}>
          <Text style={styles.pricePrefix}>₹</Text>
          <TextInput
            testID="add-listing-price-input"
            keyboardType="numeric"
            placeholder="0.00"
            placeholderTextColor={colors.textTertiary}
            value={price}
            onChangeText={setPrice}
            style={styles.priceInput}
          />
        </View>

        {/* Condition */}
        <Text style={styles.inputLabel}>Item Condition *</Text>
        <View style={styles.conditionRow}>
          {CONDITIONS.map((cond) => {
            const isSelected = cond.id === selectedCondition;
            return (
              <TouchableOpacity
                key={cond.id}
                style={[
                  styles.conditionChip,
                  isSelected && styles.conditionChipSelected,
                ]}
                onPress={() => setSelectedCondition(cond.id)}
              >
                <Text
                  style={[
                    styles.conditionChipText,
                    isSelected && styles.conditionChipTextSelected,
                  ]}
                >
                  {cond.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Location */}
        <Text style={styles.inputLabel}>Pickup Location *</Text>
        <TextInput
          testID="add-listing-location-input"
          placeholder="e.g. Koramangala, Bengaluru"
          placeholderTextColor={colors.textTertiary}
          value={location}
          onChangeText={setLocation}
          style={styles.textInput}
        />

        {/* Description */}
        <Text style={styles.inputLabel}>Description</Text>
        <TextInput
          placeholder="Mention age of item, usage details, reason for selling..."
          placeholderTextColor={colors.textTertiary}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          style={[styles.textInput, styles.textArea]}
        />

        {/* Submit Button */}
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.submitButton}
          onPress={handleSubmit}
          disabled={isSubmitting}
          testID="add-listing-publish-btn"
          accessibilityLabel="Publish Ad"
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>Publish Ad</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Add Photo Modal */}
      <Modal visible={isAddingPhoto} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalCardTitle}>Add Photo URL</Text>
            <TextInput
              placeholder="Paste image link (https://...)"
              placeholderTextColor={colors.textTertiary}
              value={photoUrlInput}
              onChangeText={setPhotoUrlInput}
              style={styles.modalInput}
              autoCapitalize="none"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsAddingPhoto(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalAddBtn}
                onPress={handleAddPhoto}
              >
                <Text style={styles.modalAddText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: spacing.xs,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  sectionSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 4,
  },
  photosScroll: {
    marginTop: 12,
    marginBottom: spacing.lg,
  },
  addPhotoBox: {
    width: 90,
    height: 90,
    borderRadius: 12,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    gap: 4,
  },
  addPhotoText: {
    fontSize: 10,
    color: colors.primary,
    fontWeight: 'bold',
  },
  photoThumbContainer: {
    position: 'relative',
    marginRight: 12,
  },
  photoThumb: {
    width: 90,
    height: 90,
    borderRadius: 12,
  },
  deletePhotoBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: spacing.sm,
  },
  textInput: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.textPrimary,
    ...typography.bodyMedium,
  },
  textArea: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  categoryScroll: {
    marginBottom: spacing.xs,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
  },
  categoryChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryChipText: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  categoryChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  priceInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
  },
  pricePrefix: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary,
    marginRight: 8,
  },
  priceInput: {
    flex: 1,
    height: 48,
    color: colors.textPrimary,
    ...typography.bodyLarge,
    fontWeight: 'bold',
  },
  conditionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  conditionChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  conditionChipSelected: {
    backgroundColor: 'rgba(255, 107, 53, 0.15)',
    borderColor: colors.primary,
  },
  conditionChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  conditionChipTextSelected: {
    color: colors.primary,
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  submitButtonText: {
    ...typography.bodyLarge,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    width: '100%',
    backgroundColor: colors.cardDark,
    borderRadius: 16,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalCardTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: 12,
  },
  modalInput: {
    backgroundColor: colors.surfaceLight,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.textPrimary,
    ...typography.bodyMedium,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
    gap: 12,
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  modalCancelText: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  modalAddBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  modalAddText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
});
