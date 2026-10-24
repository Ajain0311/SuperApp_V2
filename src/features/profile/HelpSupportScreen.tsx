import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Linking,
  Platform,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import { apiClient } from '../../services/apiClient';
import { ApiEndpoints } from '../../constants/api';

type SupportConfig = {
  phone: string;
  whatsApp: string;
  email: string;
  hours: string;
  faq: string;
};

function digitsOnly(value: string) {
  return String(value || '').replace(/\D/g, '');
}

function parseFaqBlocks(faq: string): { q: string; a: string }[] {
  const text = String(faq || '').trim();
  if (!text) return [];
  const chunks = text.split(/\n\s*\n/).map((c) => c.trim()).filter(Boolean);
  const blocks: { q: string; a: string }[] = [];
  for (const chunk of chunks) {
    const lines = chunk.split('\n').map((l) => l.trim()).filter(Boolean);
    let q = '';
    let a = '';
    for (const line of lines) {
      if (/^q\s*:/i.test(line)) q = line.replace(/^q\s*:/i, '').trim();
      else if (/^a\s*:/i.test(line)) a = line.replace(/^a\s*:/i, '').trim();
      else if (!q) q = line;
      else a = a ? `${a} ${line}` : line;
    }
    if (q || a) blocks.push({ q: q || 'FAQ', a });
  }
  return blocks;
}

export const HelpSupportScreen: React.FC = () => {
  const navigation = useNavigation();
  const [config, setConfig] = useState<SupportConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get<any>(ApiEndpoints.common.support);
      const raw = res?.data?.data || res?.data || {};
      setConfig({
        phone: String(raw.phone || raw.Phone || ''),
        whatsApp: String(raw.whatsApp || raw.WhatsApp || ''),
        email: String(raw.email || raw.Email || ''),
        hours: String(raw.hours || raw.Hours || ''),
        faq: String(raw.faq || raw.Faq || ''),
      });
    } catch (e: any) {
      Alert.alert('Support Unavailable', e?.message || 'Could not load help & support details.');
      setConfig(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load])
  );

  const openTel = async () => {
    const phone = digitsOnly(config?.phone || '');
    if (!phone) {
      Alert.alert('Not Configured', 'Support phone number is not set by admin yet.');
      return;
    }
    const url = `tel:${phone}`;
    try {
      const ok = await Linking.canOpenURL(url);
      if (ok || Platform.OS === 'web') await Linking.openURL(url);
      else Alert.alert('Dialer Unavailable', 'Cannot open phone dialer on this device.');
    } catch {
      Alert.alert('Error', 'Could not start the phone call.');
    }
  };

  const openWhatsApp = async () => {
    const phone = digitsOnly(config?.whatsApp || '');
    if (!phone) {
      Alert.alert('Not Configured', 'WhatsApp number is not set by admin yet.');
      return;
    }
    const url = `https://wa.me/${phone}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Error', 'Could not open WhatsApp.');
    }
  };

  const openEmail = async () => {
    const email = String(config?.email || '').trim();
    if (!email || !email.includes('@')) {
      Alert.alert('Not Configured', 'Support email is not set by admin yet.');
      return;
    }
    const url = `mailto:${email}?subject=${encodeURIComponent('SuperApp Support')}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Error', 'Could not open email app.');
    }
  };

  const faqBlocks = parseFaqBlocks(config?.faq || '');

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} accessibilityRole="button">
          <MaterialIcons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help & Support</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load();
              }}
              tintColor={colors.primary}
            />
          }
        >
          <View style={styles.hoursCard}>
            <MaterialIcons name="schedule" size={20} color={colors.primary} />
            <View style={styles.hoursTextCol}>
              <Text style={styles.hoursLabel}>SUPPORT HOURS</Text>
              <Text style={styles.hoursValue}>{config?.hours || 'Contact us anytime'}</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Contact us</Text>
          <TouchableOpacity style={styles.actionRow} onPress={openTel} activeOpacity={0.85}>
            <View style={[styles.actionIcon, { backgroundColor: 'rgba(34,197,94,0.15)' }]}>
              <MaterialIcons name="call" size={20} color="#16A34A" />
            </View>
            <View style={styles.actionTextCol}>
              <Text style={styles.actionTitle}>Call Support</Text>
              <Text style={styles.actionSub}>{config?.phone || 'Not configured'}</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={colors.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionRow} onPress={openWhatsApp} activeOpacity={0.85}>
            <View style={[styles.actionIcon, { backgroundColor: 'rgba(37,211,102,0.18)' }]}>
              <MaterialIcons name="chat" size={20} color="#128C7E" />
            </View>
            <View style={styles.actionTextCol}>
              <Text style={styles.actionTitle}>WhatsApp</Text>
              <Text style={styles.actionSub}>{config?.whatsApp || 'Not configured'}</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={colors.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionRow} onPress={openEmail} activeOpacity={0.85}>
            <View style={[styles.actionIcon, { backgroundColor: 'rgba(59,130,246,0.15)' }]}>
              <MaterialIcons name="email" size={20} color="#2563EB" />
            </View>
            <View style={styles.actionTextCol}>
              <Text style={styles.actionTitle}>Email</Text>
              <Text style={styles.actionSub}>{config?.email || 'Not configured'}</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={colors.textTertiary} />
          </TouchableOpacity>

          <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>Legal & Statutory Policies</Text>

          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => Linking.openURL('https://superapp-website-ashen.vercel.app/privacy-policy')}
            activeOpacity={0.85}
          >
            <View style={[styles.actionIcon, { backgroundColor: 'rgba(16,185,129,0.15)' }]}>
              <MaterialIcons name="privacy-tip" size={20} color="#10B981" />
            </View>
            <View style={styles.actionTextCol}>
              <Text style={styles.actionTitle}>Privacy Policy</Text>
              <Text style={styles.actionSub}>Data collection, permissions & security</Text>
            </View>
            <MaterialIcons name="open-in-new" size={18} color={colors.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => Linking.openURL('https://superapp-website-ashen.vercel.app/terms-and-conditions')}
            activeOpacity={0.85}
          >
            <View style={[styles.actionIcon, { backgroundColor: 'rgba(59,130,246,0.15)' }]}>
              <MaterialIcons name="description" size={20} color="#3B82F6" />
            </View>
            <View style={styles.actionTextCol}>
              <Text style={styles.actionTitle}>Terms & Conditions</Text>
              <Text style={styles.actionSub}>User agreement & terms of use</Text>
            </View>
            <MaterialIcons name="open-in-new" size={18} color={colors.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => Linking.openURL('https://superapp-website-ashen.vercel.app/refund-cancellation')}
            activeOpacity={0.85}
          >
            <View style={[styles.actionIcon, { backgroundColor: 'rgba(245,158,11,0.15)' }]}>
              <MaterialIcons name="replay" size={20} color="#F59E0B" />
            </View>
            <View style={styles.actionTextCol}>
              <Text style={styles.actionTitle}>Refund & Cancellation</Text>
              <Text style={styles.actionSub}>Policy on cancelled rides & food orders</Text>
            </View>
            <MaterialIcons name="open-in-new" size={18} color={colors.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => Linking.openURL('https://superapp-website-ashen.vercel.app/delete-account')}
            activeOpacity={0.85}
          >
            <View style={[styles.actionIcon, { backgroundColor: 'rgba(239,68,68,0.15)' }]}>
              <MaterialIcons name="delete-forever" size={20} color="#EF4444" />
            </View>
            <View style={styles.actionTextCol}>
              <Text style={styles.actionTitle}>Delete Account / Data Erasure</Text>
              <Text style={styles.actionSub}>Submit account & data deletion request</Text>
            </View>
            <MaterialIcons name="open-in-new" size={18} color={colors.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => Linking.openURL('https://superapp-website-ashen.vercel.app')}
            activeOpacity={0.85}
          >
            <View style={[styles.actionIcon, { backgroundColor: 'rgba(139,92,246,0.15)' }]}>
              <MaterialIcons name="language" size={20} color="#8B5CF6" />
            </View>
            <View style={styles.actionTextCol}>
              <Text style={styles.actionTitle}>Official Website</Text>
              <Text style={styles.actionSub}>superapp-website-ashen.vercel.app</Text>
            </View>
            <MaterialIcons name="open-in-new" size={18} color={colors.textTertiary} />
          </TouchableOpacity>

          <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>FAQ</Text>
          {faqBlocks.length === 0 ? (
            <Text style={styles.emptyFaq}>No FAQ configured by admin yet.</Text>
          ) : (
            faqBlocks.map((block, idx) => (
              <View key={`${idx}-${block.q}`} style={styles.faqCard}>
                <Text style={styles.faqQ}>{block.q}</Text>
                {block.a ? <Text style={styles.faqA}>{block.a}</Text> : null}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...typography.h4,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  hoursCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: 12,
  },
  hoursTextCol: { flex: 1 },
  hoursLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: colors.primary,
    marginBottom: 2,
  },
  hoursValue: { ...typography.bodyMedium, color: colors.textPrimary, fontWeight: '600' },
  sectionTitle: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  actionTextCol: { flex: 1 },
  actionTitle: { ...typography.bodyLarge, color: colors.textPrimary, fontWeight: '700' },
  actionSub: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  faqCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  faqQ: { ...typography.bodyLarge, color: colors.textPrimary, fontWeight: '700', marginBottom: 6 },
  faqA: { ...typography.bodyMedium, color: colors.textSecondary, lineHeight: 20 },
  emptyFaq: { ...typography.bodyMedium, color: colors.textTertiary },
});
