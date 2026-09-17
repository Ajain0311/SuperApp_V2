import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  SafeAreaView,
  StatusBar,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { ListingDetail } from '../../models/marketplace';
import { useMarketplaceStore } from '../../store/marketplaceStore';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import { apiClient } from '../../services/apiClient';
import { ApiEndpoints } from '../../constants/api';

const { width } = Dimensions.get('window');

export const ListingDetailScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'ListingDetail'>>();
  const listingId = route.params?.listingId || '101';

  const { favorites, toggleFavorite } = useMarketplaceStore();
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [offerPrice, setOfferPrice] = useState('61200');

  const idNum = parseInt(listingId, 10) || 101;
  const isFav = favorites.includes(idNum);

  // Mock detail data matching Flutter implementation
  const initialDetail: ListingDetail = {
    id: idNum,
    title: 'iPhone 14 Pro Max 256GB Deep Purple (Like New)',
    description:
      'Mint condition iPhone 14 Pro Max in Deep Purple with 256GB storage. Battery health is at 94%. Always used with a tempered glass screen protector and Spigen case. Comes with original Apple box, unused USB-C to Lightning cable, and invoice from Apple Store India. Only serious buyers please.',
    price: 68000,
    condition: 'LIKE_NEW',
    location: 'Koramangala, Bengaluru',
    images: [
      'https://images.unsplash.com/photo-1591337676887-a217a6970a8a?w=800',
      'https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?w=800',
      'https://images.unsplash.com/photo-1512499617640-c74ae3a79d37?w=800',
    ],
    isFeatured: true,
    viewCount: 142,
    createdAt: new Date().toISOString(),
    categoryId: 1,
    categoryName: 'Mobiles',
    sellerId: 501,
    sellerName: 'Rahul Verma',
    sellerPhone: '+91 98450 12345',
    sellerRating: 4.9,
    dealsCount: 28,
    isFavorite: isFav,
  };

  const [detail, setDetail] = useState<ListingDetail>(initialDetail);

  useEffect(() => {
    apiClient
      .get<any>(ApiEndpoints.marketplace.listingDetail(listingId))
      .then((res) => {
        const data = res.data?.data || res.data;
        if (data && data.title) {
          setDetail({
            id: data.id || idNum,
            title: data.title,
            description: data.description || '',
            price: Number(data.price) || 0,
            condition: data.condition || 'USED',
            location: data.location || 'Bengaluru',
            images:
              data.images && data.images.length > 0
                ? data.images.map((im: any) => im.imageUrl || im)
                : data.primaryImageUrl
                ? [data.primaryImageUrl]
                : ['https://images.unsplash.com/photo-1591337676887-a217a6970a8a?w=800'],
            isFeatured: Boolean(data.isFeatured),
            viewCount: data.viewCount || 1,
            createdAt: data.createdAt || new Date().toISOString(),
            categoryId: data.categoryId || 1,
            categoryName: data.categoryName || 'General',
            sellerId: data.sellerId || 1,
            sellerName: data.sellerName || 'Verified Seller',
            sellerPhone: data.sellerPhone || '+91 98450 12345',
            sellerRating: Number(data.sellerRating) || 4.9,
            dealsCount: data.dealsCount || 12,
            isFavorite: favorites.includes(data.id || idNum),
          });
        }
      })
      .catch(() => {});
  }, [listingId]);

  const handleSendOffer = () => {
    setShowOfferModal(false);
    Alert.alert('Offer Sent', `Offer of ₹${offerPrice} sent to ${detail.sellerName}!`);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Photo Carousel */}
        <View style={styles.carouselContainer}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const newIndex = Math.round(e.nativeEvent.contentOffset.x / width);
              setActivePhotoIndex(newIndex);
            }}
          >
            {detail.images.map((imgUrl, idx) => (
              <Image
                key={idx}
                source={{ uri: imgUrl }}
                style={styles.carouselImage}
                resizeMode="cover"
              />
            ))}
          </ScrollView>

          {/* Floating Top Nav Buttons */}
          <View style={styles.floatingTopBar}>
            <TouchableOpacity
              style={styles.roundIconButton}
              onPress={() => navigation.goBack()}
            >
              <MaterialIcons name="arrow-back" size={20} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={styles.topRightActions}>
              <TouchableOpacity
                style={styles.roundIconButton}
                onPress={() => Alert.alert('Share', 'Listing link copied to clipboard!')}
              >
                <MaterialIcons name="share" size={20} color="#FFFFFF" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.roundIconButton}
                onPress={() => toggleFavorite(detail.id)}
              >
                <MaterialIcons
                  name={isFav ? 'favorite' : 'favorite-border'}
                  size={20}
                  color={isFav ? colors.error : '#FFFFFF'}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Dot Indicators */}
          {detail.images.length > 1 && (
            <View style={styles.dotsContainer}>
              {detail.images.map((_, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.dot,
                    idx === activePhotoIndex && styles.dotActive,
                  ]}
                />
              ))}
            </View>
          )}
        </View>

        {/* Details Content */}
        <View style={styles.contentBody}>
          {/* Price & Views */}
          <View style={styles.priceRow}>
            <Text style={styles.priceText}>₹{detail.price.toFixed(0)}</Text>
            <View style={styles.negotiableBadge}>
              <Text style={styles.negotiableText}>Negotiable</Text>
            </View>
            <View style={styles.viewsWrapper}>
              <MaterialIcons name="visibility" size={14} color={colors.textTertiary} />
              <Text style={styles.viewsText}>{detail.viewCount} views</Text>
            </View>
          </View>

          {/* Title */}
          <Text style={styles.titleText}>{detail.title}</Text>

          {/* Meta Tags Row */}
          <View style={styles.metaTagsRow}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>{detail.categoryName}</Text>
            </View>
            <View style={styles.conditionBadge}>
              <Text style={styles.conditionBadgeText}>{detail.condition}</Text>
            </View>
            <View style={styles.locationWrapper}>
              <MaterialIcons name="location-on" size={14} color={colors.textTertiary} />
              <Text style={styles.locationText}>{detail.location}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Highlights */}
          <Text style={styles.sectionHeader}>Highlights</Text>
          <View style={styles.highlightsWrap}>
            {[
              { icon: 'verified', label: 'Authentic Guaranteed' },
              { icon: 'inventory-2', label: 'Original Bill & Box' },
              { icon: 'local-shipping', label: 'Self Pickup / Handover' },
              { icon: 'access-time', label: 'Fast Response Seller' },
            ].map((chip, idx) => (
              <View key={idx} style={styles.highlightChip}>
                <MaterialIcons name={chip.icon as any} size={15} color={colors.secondary} />
                <Text style={styles.highlightChipText}>{chip.label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.divider} />

          {/* Description */}
          <Text style={styles.sectionHeader}>Description</Text>
          <View style={styles.descriptionBox}>
            <Text style={styles.descriptionText}>{detail.description}</Text>
          </View>

          <View style={styles.divider} />

          {/* Seller Profile */}
          <Text style={styles.sectionHeader}>Seller Profile</Text>
          <View style={styles.sellerCard}>
            <View style={styles.sellerRow}>
              <View style={styles.sellerAvatar}>
                <MaterialIcons name="person" size={28} color={colors.textSecondary} />
              </View>
              <View style={styles.sellerMeta}>
                <View style={styles.sellerNameRow}>
                  <Text style={styles.sellerName}>{detail.sellerName}</Text>
                  <MaterialIcons name="verified" size={16} color={colors.secondary} />
                </View>
                <Text style={styles.sellerStats}>
                  Active member • {detail.sellerRating} ★ ({detail.dealsCount} deals closed)
                </Text>
              </View>
            </View>

            <View style={styles.sellerDivider} />

            <View style={styles.sellerActionsRow}>
              <TouchableOpacity
                style={styles.sellerChatBtn}
                onPress={() => setShowContactModal(true)}
              >
                <MaterialIcons name="chat-bubble-outline" size={16} color="#FFFFFF" />
                <Text style={styles.sellerActionText}>Chat</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.sellerCallBtn}
                onPress={() => setShowContactModal(true)}
              >
                <MaterialIcons name="call" size={16} color="#FFFFFF" />
                <Text style={styles.sellerActionText}>Call</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Safety Advice */}
          <View style={styles.safetyBox}>
            <MaterialIcons name="security" size={20} color={colors.secondary} />
            <View style={styles.safetyContent}>
              <Text style={styles.safetyTitle}>Safety Guidelines for Buyers</Text>
              <Text style={styles.safetyBody}>
                Always meet in public places, inspect the goods thoroughly in person, and never pay advance booking amounts.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Persistent Bottom Action Bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.bottomContactBtn}
          onPress={() => setShowContactModal(true)}
        >
          <Text style={styles.bottomContactText}>Chat / Call</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.bottomOfferBtn}
          onPress={() => setShowOfferModal(true)}
        >
          <Text style={styles.bottomOfferText}>Make an Offer</Text>
        </TouchableOpacity>
      </View>

      {/* Make Offer Modal */}
      <Modal visible={showOfferModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Make an Offer</Text>
              <TouchableOpacity onPress={() => setShowOfferModal(false)}>
                <MaterialIcons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalPriceHint}>
              Listed price: ₹{detail.price.toFixed(0)}
            </Text>

            <View style={styles.offerInputWrapper}>
              <Text style={styles.offerPrefix}>₹ </Text>
              <TextInput
                keyboardType="numeric"
                value={offerPrice}
                onChangeText={setOfferPrice}
                style={styles.offerInput}
              />
            </View>

            <TouchableOpacity style={styles.submitOfferBtn} onPress={handleSendOffer}>
              <Text style={styles.submitOfferText}>Send Offer to Seller</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Contact Options Modal */}
      <Modal visible={showContactModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Contact {detail.sellerName}</Text>
              <TouchableOpacity onPress={() => setShowContactModal(false)}>
                <MaterialIcons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.contactOptionRow}
              onPress={() => {
                setShowContactModal(false);
                Alert.alert('Calling', `Dialing ${detail.sellerPhone}...`);
              }}
            >
              <View style={[styles.contactIconCircle, { backgroundColor: 'rgba(0, 200, 83, 0.2)' }]}>
                <MaterialIcons name="call" size={20} color={colors.secondary} />
              </View>
              <View>
                <Text style={styles.contactOptionTitle}>Call Seller Directly</Text>
                <Text style={styles.contactOptionSub}>{detail.sellerPhone}</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.contactOptionRow}
              onPress={() => {
                setShowContactModal(false);
                Alert.alert('SuperApp Chat', `Opening secure chat with ${detail.sellerName}...`);
              }}
            >
              <View style={[styles.contactIconCircle, { backgroundColor: 'rgba(33, 150, 243, 0.2)' }]}>
                <MaterialIcons name="chat-bubble" size={20} color={colors.blue} />
              </View>
              <View>
                <Text style={styles.contactOptionTitle}>Chat in SuperApp</Text>
                <Text style={styles.contactOptionSub}>Fast responses, secure and in-app</Text>
              </View>
            </TouchableOpacity>
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
  scrollContent: {
    paddingBottom: 110,
  },
  carouselContainer: {
    width: width,
    height: 320,
    backgroundColor: colors.surface,
    position: 'relative',
  },
  carouselImage: {
    width: width,
    height: 320,
  },
  floatingTopBar: {
    position: 'absolute',
    top: 40,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roundIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(10, 14, 33, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topRightActions: {
    flexDirection: 'row',
    gap: 10,
  },
  dotsContainer: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  dotActive: {
    width: 20,
    backgroundColor: colors.primary,
  },
  contentBody: {
    padding: spacing.md,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  priceText: {
    ...typography.h1,
    color: colors.primary,
    fontWeight: '900',
    fontSize: 28,
  },
  negotiableBadge: {
    backgroundColor: 'rgba(0, 200, 83, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 200, 83, 0.3)',
  },
  negotiableText: {
    color: colors.secondary,
    fontSize: 11,
    fontWeight: 'bold',
  },
  viewsWrapper: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewsText: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  titleText: {
    ...typography.h2,
    color: colors.textPrimary,
    fontWeight: '700',
    marginTop: 10,
    lineHeight: 26,
  },
  metaTagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  categoryBadge: {
    backgroundColor: colors.surfaceLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  categoryBadgeText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  conditionBadge: {
    backgroundColor: 'rgba(255, 107, 53, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  conditionBadgeText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: 'bold',
  },
  locationWrapper: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  locationText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: 18,
  },
  sectionHeader: {
    ...typography.h3,
    color: colors.textPrimary,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  highlightsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  highlightChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardDark,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  highlightChipText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  descriptionBox: {
    backgroundColor: colors.cardDark,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  descriptionText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  sellerCard: {
    backgroundColor: colors.cardDark,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sellerAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sellerMeta: {
    marginLeft: 12,
    flex: 1,
  },
  sellerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sellerName: {
    ...typography.bodyLarge,
    color: colors.textPrimary,
    fontWeight: 'bold',
  },
  sellerStats: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  sellerDivider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: 12,
  },
  sellerActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  sellerChatBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  sellerCallBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceLight,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  sellerActionText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  safetyBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(20, 24, 41, 0.8)',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 18,
    gap: 12,
  },
  safetyContent: {
    flex: 1,
  },
  safetyTitle: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  safetyBody: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
    marginTop: 4,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    paddingBottom: 24,
    backgroundColor: colors.cardDark,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 12,
  },
  bottomContactBtn: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomContactText: {
    ...typography.bodyMedium,
    color: colors.primary,
    fontWeight: 'bold',
  },
  bottomOfferBtn: {
    flex: 2,
    height: 48,
    backgroundColor: colors.primary,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomOfferText: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.cardDark,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    fontWeight: 'bold',
  },
  modalPriceHint: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  offerInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceLight,
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 20,
  },
  offerPrefix: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.primary,
  },
  offerInput: {
    flex: 1,
    height: 52,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  submitOfferBtn: {
    height: 48,
    backgroundColor: colors.primary,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitOfferText: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  contactOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 14,
  },
  contactIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactOptionTitle: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  contactOptionSub: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
