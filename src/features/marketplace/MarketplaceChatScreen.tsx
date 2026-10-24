import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { ChatConversation, ChatMessage } from '../../models/marketplace';
import { apiClient } from '../../services/apiClient';
import { ApiEndpoints } from '../../constants/api';
import { signalRService, ChatMessageEvent } from '../../services/signalr';
import { useAuthStore } from '../../store/authStore';
import { OfflineBanner } from '../../components/common/OfflineBanner';
import { FormKeyboardAvoid } from '../../components/common/FormKeyboardAvoid';
import { useKeyboardHeight } from '../../hooks/useKeyboardHeight';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

export const MarketplaceChatScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'MarketplaceChat'>>();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight({ androidMode: 'pad' });
  const params = route.params || {
    listingId: '0',
    sellerId: 0,
    sellerName: 'Seller',
    listingTitle: 'Listing',
    listingPrice: 0,
  };
  const { listingId, sellerId, sellerName, listingTitle, listingPrice, listingImageUrl } = params;

  const user = useAuthStore((s) => s.user);
  const currentUserId = user?.id ?? 0;

  const [conversation, setConversation] = useState<ChatConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const activeConvIdRef = useRef<number | null>(params.conversationId ?? null);
  const keyboardOpen = keyboardHeight > 0;

  useEffect(() => {
    if (!keyboardOpen) return;
    const t = setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(t);
  }, [keyboardOpen, messages.length]);

  const loadConversation = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      let convData: ChatConversation;
      if (activeConvIdRef.current) {
        const res = await apiClient.get<any>(ApiEndpoints.marketplace.conversation(activeConvIdRef.current));
        convData = res.data?.data || res.data;
      } else {
        const res = await apiClient.post<any>(ApiEndpoints.marketplace.openChat(listingId));
        convData = res.data?.data || res.data;
      }

      if (convData && convData.id) {
        setConversation(convData);
        setMessages(convData.messages || []);
        activeConvIdRef.current = convData.id;

        // Join SignalR chat group
        await signalRService.joinChat(convData.id.toString());
      } else {
        setError('Could not load chat conversation.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to connect to chat');
    } finally {
      setIsLoading(false);
    }
  }, [listingId]);

  useEffect(() => {
    loadConversation();

    // Listen for incoming messages
    const unsubscribe = signalRService.onChatMessageReceived((event: ChatMessageEvent) => {
      if (event.conversationId === activeConvIdRef.current?.toString()) {
        setMessages((prev) => {
          // If this incoming message matches a clientMessageId of an optimistic message, reconcile it
          if (event.clientMessageId) {
            const optIndex = prev.findIndex((m) => m.clientMessageId === event.clientMessageId);
            if (optIndex !== -1) {
              const updated = [...prev];
              updated[optIndex] = {
                id: event.id || prev[optIndex].id,
                conversationId: activeConvIdRef.current || 0,
                senderId: event.senderId,
                senderName: event.senderName,
                messageText: event.messageText,
                createdAt: event.timestamp || prev[optIndex].createdAt,
                clientMessageId: event.clientMessageId,
                isSending: false,
              };
              return updated;
            }
          }

          // Avoid duplicate messages by server ID
          if (event.id && prev.some((m) => m.id === event.id)) {
            return prev;
          }

          // Also check if an identical sender + message text was added optimistically in sending state
          const pendingMatchIndex = prev.findIndex(
            (m) => m.isSending && m.senderId === event.senderId && m.messageText === event.messageText
          );
          if (pendingMatchIndex !== -1) {
            const updated = [...prev];
            updated[pendingMatchIndex] = {
              id: event.id || prev[pendingMatchIndex].id,
              conversationId: activeConvIdRef.current || 0,
              senderId: event.senderId,
              senderName: event.senderName,
              messageText: event.messageText,
              createdAt: event.timestamp || prev[pendingMatchIndex].createdAt,
              isSending: false,
            };
            return updated;
          }

          const incoming: ChatMessage = {
            id: event.id || Date.now(),
            conversationId: activeConvIdRef.current || 0,
            senderId: event.senderId,
            senderName: event.senderName,
            messageText: event.messageText,
            createdAt: event.timestamp || new Date().toISOString(),
            clientMessageId: event.clientMessageId,
          };
          return [...prev, incoming];
        });
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      }
    });

    return () => {
      unsubscribe();
      if (activeConvIdRef.current) {
        signalRService.leaveChat(activeConvIdRef.current.toString()).catch(() => {});
      }
    };
  }, [loadConversation]);

  const handleSendMessage = async () => {
    const text = inputText.trim();
    if (!text || !activeConvIdRef.current || isSending) return;

    setIsSending(true);
    setInputText('');

    // Assign a unique clientMessageId
    const clientMsgId = `cmsg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const tempId = Date.now();
    const optimisticMessage: ChatMessage = {
      id: tempId,
      conversationId: activeConvIdRef.current,
      senderId: currentUserId,
      senderName: user?.fullName || 'Me',
      messageText: text,
      createdAt: new Date().toISOString(),
      clientMessageId: clientMsgId,
      isSending: true,
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);

    try {
      const res = await apiClient.post<any>(
        ApiEndpoints.marketplace.sendMessage(activeConvIdRef.current),
        { messageText: text, clientMessageId: clientMsgId }
      );
      const saved = res.data?.data || res.data;
      if (saved && saved.id) {
        setMessages((prev) =>
          prev.map((m) =>
            m.clientMessageId === clientMsgId || m.id === tempId
              ? { ...saved, isSending: false, clientMessageId: clientMsgId }
              : m
          )
        );
      }
    } catch (err: any) {
      // Mark optimistic message as failed and restore text
      setMessages((prev) =>
        prev.map((m) =>
          m.clientMessageId === clientMsgId || m.id === tempId
            ? { ...m, isSending: false, failed: true }
            : m
        )
      );
      setInputText(text);
    } finally {
      setIsSending(false);
    }
  };

  const renderMessageItem = ({ item }: { item: ChatMessage }) => {
    const isMe = item.senderId === currentUserId;
    const timeStr = item.createdAt
      ? new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';

    return (
      <View style={[styles.messageRow, isMe ? styles.messageRowMe : styles.messageRowOther]}>
        <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
          {!isMe && <Text style={styles.senderLabel}>{item.senderName}</Text>}
          <Text style={[styles.messageText, isMe ? styles.messageTextMe : styles.messageTextOther]}>
            {item.messageText}
          </Text>
          <View style={styles.metaRow}>
            <Text style={[styles.timestamp, isMe ? styles.timestampMe : styles.timestampOther]}>
              {timeStr}
            </Text>
            {item.isSending && (
              <ActivityIndicator size="small" color="#FFFFFF" style={styles.sendingSpinner} />
            )}
            {item.failed && (
              <MaterialIcons name="error-outline" size={14} color={colors.error} style={styles.failedIcon} />
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <OfflineBanner onRetry={loadConversation} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {sellerName}
          </Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {listingTitle} • ₹{listingPrice.toLocaleString('en-IN')}
          </Text>
        </View>
      </View>

      {/* Listing Snippet Card */}
      <View style={styles.snippetCard}>
        {listingImageUrl ? (
          <Image source={{ uri: listingImageUrl }} style={styles.snippetImage} resizeMode="cover" />
        ) : (
          <View style={[styles.snippetImage, styles.snippetPlaceholder]}>
            <MaterialIcons name="image" size={20} color={colors.textSecondary} />
          </View>
        )}
        <View style={styles.snippetDetails}>
          <Text style={styles.snippetTitle} numberOfLines={1}>
            {listingTitle}
          </Text>
          <Text style={styles.snippetPrice}>₹{listingPrice.toLocaleString('en-IN')}</Text>
        </View>
      </View>

      {/* Chat Body */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Connecting to chat...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <MaterialIcons name="cloud-off" size={48} color={colors.textSecondary} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadConversation}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FormKeyboardAvoid variant="chat" style={styles.chatArea}>
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderMessageItem}
            contentContainerStyle={styles.messagesList}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <MaterialIcons name="chat" size={40} color={colors.textSecondary} />
                <Text style={styles.emptyText}>Start a conversation with {sellerName}</Text>
                <Text style={styles.emptySubtext}>Ask about availability, pickup, or make an offer.</Text>
              </View>
            }
          />

          {/* Input bar — rides above keyboard via FormKeyboardAvoid chat padding */}
          <View
            style={[
              styles.inputBarWrapper,
              { paddingBottom: keyboardOpen ? spacing.sm : Math.max(insets.bottom, spacing.sm) },
            ]}
          >
            <View style={styles.inputBar}>
              <TextInput
                style={styles.textInput}
                placeholder="Type a message..."
                placeholderTextColor={colors.textSecondary}
                value={inputText}
                onChangeText={setInputText}
                multiline
                maxLength={1000}
                onFocus={() => {
                  setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 120);
                }}
              />
              <TouchableOpacity
                style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
                onPress={handleSendMessage}
                disabled={!inputText.trim() || isSending}
              >
                {isSending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <MaterialIcons name="send" size={20} color="#FFFFFF" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </FormKeyboardAvoid>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  backBtn: {
    padding: spacing.xs,
    marginRight: spacing.sm,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: typography.h3.fontSize,
    fontFamily: typography.h3.fontFamily,
    color: colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: typography.caption.fontSize,
    color: colors.textSecondary,
    marginTop: 2,
  },
  snippetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  snippetImage: {
    width: 44,
    height: 44,
    borderRadius: 6,
    backgroundColor: '#27272A',
  },
  snippetPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  snippetDetails: {
    flex: 1,
    marginLeft: spacing.md,
  },
  snippetTitle: {
    fontSize: typography.bodyMedium?.fontSize ?? 14,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  snippetPrice: {
    fontSize: typography.bodyMedium?.fontSize ?? 14,
    color: colors.primary,
    fontWeight: 'bold',
    marginTop: 2,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  errorText: {
    color: colors.textSecondary,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  chatArea: {
    flex: 1,
  },
  messagesList: {
    padding: spacing.md,
    flexGrow: 1,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  messageRowMe: {
    justifyContent: 'flex-end',
  },
  messageRowOther: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 16,
  },
  bubbleMe: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 4,
  },
  senderLabel: {
    fontSize: typography.caption.fontSize,
    color: colors.secondary,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  messageText: {
    fontSize: typography.bodyLarge?.fontSize ?? 16,
  },
  messageTextMe: {
    color: '#FFFFFF',
  },
  messageTextOther: {
    color: colors.textPrimary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  timestamp: {
    fontSize: 10,
  },
  timestampMe: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  timestampOther: {
    color: colors.textSecondary,
  },
  sendingSpinner: {
    marginLeft: 4,
  },
  failedIcon: {
    marginLeft: 4,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyText: {
    color: colors.textPrimary,
    fontSize: typography.h3.fontSize,
    fontWeight: '600',
    marginTop: spacing.md,
  },
  emptySubtext: {
    color: colors.textSecondary,
    fontSize: typography.caption.fontSize,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  inputBarWrapper: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  textInput: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    maxHeight: 100,
    color: colors.textPrimary,
    fontSize: typography.bodyMedium?.fontSize ?? 14,
  },
  sendBtn: {
    backgroundColor: colors.primary,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
});
