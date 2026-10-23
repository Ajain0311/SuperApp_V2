import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useMarketplaceStore } from '../../store/marketplaceStore';
import { apiClient } from '../../services/apiClient';
import { ApiEndpoints } from '../../constants/api';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

export const SellerDashboardScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { customListings } = useMarketplaceStore();
  const [activeTab, setActiveTab] = useState<'LISTINGS' | 'CHATS'>('LISTINGS');
  const [listings, setListings] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      // 1. Load Listings
      const res = await apiClient.get<any>(ApiEndpoints.marketplace.myListings);
      const raw = res?.data?.data ?? res?.data?.items ?? res?.data ?? (Array.isArray(res) ? res : []);
      const serverItems: any[] = Array.isArray(raw) ? raw : [];

      const merged = [...serverItems];
      for (const custom of customListings) {
        if (!merged.some((m) => m.id === custom.id || m.title === custom.title)) {
          merged.unshift({
            ...custom,
            status: custom.status || 'ACTIVE',
            isActive: true,
          });
        }
      }
      setListings(merged);

      // 2. Load Conversations
      const convRes = await apiClient.get<any>(ApiEndpoints.marketplace.myConversations);
      const convRaw = convRes?.data?.data ?? convRes?.data ?? [];
      if (Array.isArray(convRaw)) {
        setConversations(convRaw);
      }
    } catch (e: any) {
      console.warn('[SellerDashboard] Error loading data:', e.message);
      if (customListings.length > 0) {
        setListings(customListings);
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [customListings]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleDeleteListing = (id: number) => {
    Alert.alert('Remove Listing', 'Are you sure you want to deactivate this listing?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Deactivate',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiClient.post(ApiEndpoints.marketplace.manageListings, {
              action: 'DELETE',
              id,
            });
            setListings((prev) => prev.filter((l) => l.id !== id));
            Alert.alert('Listing Removed', 'The item has been removed from the community bazaar.');
          } catch (e: any) {
            Alert.alert('Error', e.message || 'Could not deactivate listing');
          }
        },
      },
    ]);
  };

  const handleMarkSold = (id: number) => {
    Alert.alert('Mark as Sold', 'Has this item been sold?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Yes, Mark Sold',
        onPress: async () => {
          try {
            await apiClient.post(ApiEndpoints.marketplace.manageListings, {
              action: 'STATUS',
              id,
              status: 'SOLD',
            });
            setListings((prev) =>
              prev.map((l) => (l.id === id ? { ...l, status: 'SOLD' } : l))
            );
            Alert.alert('Updated', 'Item has been marked as SOLD.');
          } catch (e: any) {
            Alert.alert('Error', e.message || 'Could not update status');
          }
        },
      },
    ]);
  };

  const activeCount = listings.filter((l) => l.status === 'ACTIVE' || l.isActive).length;

  const renderListing = ({ item }: { item: any }) => (
    <View style={styles.listingCard}>
      <View style={styles.cardHeader}>
        <View style={styles.infoCol}>
          <Text style={styles.itemTitle}>{item.title}</Text>
          <Text style={styles.itemLocation}>{item.location || 'Local Listing'}</Text>
        </View>
        <View style={styles.priceCol}>
          <Text style={styles.priceText}>₹{item.price}</Text>
          <View style={[styles.activePill, item.status === 'SOLD' && { backgroundColor: '#10B98120' }]}>
            <Text style={[styles.activePillText, item.status === 'SOLD' && { color: '#10B981' }]}>
              {item.status || 'ACTIVE'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.cardActions}>
        <TouchableOpacity
          style={styles.viewBtn}
          onPress={() => navigation.navigate('ListingDetail', { listingId: item.id.toString() })}
        >
          <Ionicons name="eye-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.btnText}>Preview</Text>
        </TouchableOpacity>

        {item.status !== 'SOLD' && (
          <TouchableOpacity
            style={styles.soldBtn}
            onPress={() => handleMarkSold(item.id)}
          >
            <Ionicons name="checkmark-circle-outline" size={16} color="#10B981" />
            <Text style={styles.soldBtnText}>Mark Sold</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => handleDeleteListing(item.id)}
        >
          <Ionicons name="trash-outline" size={16} color="#EF4444" />
          <Text style={styles.deleteBtnText}>Remove</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>My Bazaar Store</Text>
          <Text style={styles.subtitle}>Manage your community marketplace listings</Text>
        </View>

        <TouchableOpacity
          style={styles.postAdBtn}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('AddListing')}
        >
          <Ionicons name="add" size={18} color="#FFFFFF" />
          <Text style={styles.postAdText}>Post Ad</Text>
        </TouchableOpacity>
      </View>

      {/* Summary KPI Bar */}
      <View style={styles.summaryBar}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{listings.length}</Text>
          <Text style={styles.statLabel}>Total Ads</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={[styles.statNumber, { color: '#8B5CF6' }]}>{activeCount}</Text>
          <Text style={styles.statLabel}>Active Now</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={[styles.statNumber, { color: '#10B981' }]}>{conversations.length}</Text>
          <Text style={styles.statLabel}>Buyer Chats</Text>
        </View>
      </View>

      {/* Tabs Selector: My Ads vs Buyer Inquiries */}
      <View style={styles.tabSelector}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'LISTINGS' && styles.tabButtonActive]}
          onPress={() => setActiveTab('LISTINGS')}
        >
          <Ionicons
            name="cube-outline"
            size={18}
            color={activeTab === 'LISTINGS' ? '#8B5CF6' : colors.textSecondary}
          />
          <Text style={[styles.tabButtonText, activeTab === 'LISTINGS' && styles.tabButtonTextActive]}>
            My Ads ({listings.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'CHATS' && styles.tabButtonActive]}
          onPress={() => setActiveTab('CHATS')}
        >
          <Ionicons
            name="chatbubbles-outline"
            size={18}
            color={activeTab === 'CHATS' ? '#8B5CF6' : colors.textSecondary}
          />
          <Text style={[styles.tabButtonText, activeTab === 'CHATS' && styles.tabButtonTextActive]}>
            Inquiries ({conversations.length})
          </Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#8B5CF6" />
        </View>
      ) : activeTab === 'LISTINGS' ? (
        <FlatList
          data={listings}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderListing}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => { setIsRefreshing(true); loadData(); }} tintColor="#8B5CF6" />}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="bag-handle-outline" size={48} color={colors.textTertiary} />
              <Text style={styles.emptyTitle}>No Listings Yet</Text>
              <Text style={styles.emptySubtitle}>Tap 'Post Ad' above to sell electronics, vehicles, or items to citizens nearby.</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => { setIsRefreshing(true); loadData(); }} tintColor="#8B5CF6" />}
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.chatCard}
              onPress={() =>
                navigation.navigate('MarketplaceChat', {
                  conversationId: item.id,
                  listingId: String(item.listingId),
                  sellerId: item.sellerId,
                  sellerName: item.sellerName,
                  listingTitle: item.listingTitle,
                  listingPrice: item.listingPrice,
                  listingImageUrl: item.listingImageUrl,
                })
              }
            >
              <View style={styles.chatCardHeader}>
                <View style={styles.chatBuyerAvatar}>
                  <Text style={styles.chatBuyerInitial}>{(item.buyerName || 'B')[0].toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={styles.chatBuyerName}>{item.buyerName}</Text>
                    <Text style={styles.chatTimestamp}>
                      {item.lastMessageTimestamp
                        ? new Date(item.lastMessageTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : 'New'}
                    </Text>
                  </View>
                  <Text style={styles.chatListingTag} numberOfLines={1}>
                    Re: {item.listingTitle} (₹{item.listingPrice})
                  </Text>
                  <Text style={styles.chatLastMsg} numberOfLines={1}>
                    {item.lastMessageText || 'No messages yet'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="chatbubbles-outline" size={48} color={colors.textTertiary} />
              <Text style={styles.emptyTitle}>No Inquiries Yet</Text>
              <Text style={styles.emptySubtitle}>When buyers send messages about your items, conversations will appear here in real-time.</Text>
            </View>
          }
        />
      )}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.bodySm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  postAdBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 4,
  },
  postAdText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8 },
      android: { elevation: 4 },
      web: { boxShadow: '0 4px 12px rgba(0,0,0,0.05)' } as any,
    }),
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.border,
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  listingCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 },
      android: { elevation: 2 },
      web: { boxShadow: '0 2px 8px rgba(0,0,0,0.03)' } as any,
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  infoCol: {
    flex: 1,
    marginRight: spacing.md,
  },
  itemTitle: {
    ...typography.h4,
    color: colors.textPrimary,
  },
  itemLocation: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  priceCol: {
    alignItems: 'flex-end',
  },
  priceText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#10B981',
  },
  activePill: {
    backgroundColor: '#8B5CF620',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 4,
  },
  activePillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#8B5CF6',
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  viewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.surfaceSecondary,
    gap: 4,
  },
  soldBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#10B98115',
    gap: 4,
  },
  soldBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
  },
  btnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#EF444415',
    gap: 4,
  },
  deleteBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#EF4444',
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyTitle: {
    ...typography.h4,
    color: colors.textPrimary,
    marginTop: spacing.md,
  },
  emptySubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 260,
  },
  tabSelector: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    gap: 12,
    marginBottom: spacing.xs,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  tabButtonActive: {
    backgroundColor: '#8B5CF618',
    borderColor: '#8B5CF6',
  },
  tabButtonText: {
    ...typography.bodySm,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabButtonTextActive: {
    color: '#8B5CF6',
    fontWeight: '700',
  },
  chatCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chatCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chatBuyerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#8B5CF625',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatBuyerInitial: {
    fontSize: 18,
    fontWeight: '700',
    color: '#8B5CF6',
  },
  chatBuyerName: {
    ...typography.bodyMedium,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  chatTimestamp: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  chatListingTag: {
    ...typography.caption,
    color: '#8B5CF6',
    marginTop: 2,
  },
  chatLastMsg: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
