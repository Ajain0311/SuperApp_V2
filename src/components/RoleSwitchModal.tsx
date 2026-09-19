import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoleStore, AppRole, ROLE_CONFIGS } from '../store/roleStore';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';

interface RoleSwitchModalProps {
  visible: boolean;
  onClose: () => void;
}

export const RoleSwitchModal: React.FC<RoleSwitchModalProps> = ({ visible, onClose }) => {
  const { activeRole, availableRoles, switchRole } = useRoleStore();

  const handleSelectRole = async (role: AppRole) => {
    if (role !== activeRole) {
      await switchRole(role);
    }
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View style={styles.sheetContainer}>
              {/* Header */}
              <View style={styles.header}>
                <View>
                  <Text style={styles.title}>Switch Mode</Text>
                  <Text style={styles.subtitle}>Select your active workspace profile</Text>
                </View>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
                {availableRoles.map((role) => {
                  const config = ROLE_CONFIGS[role] || {
                    key: role,
                    label: role,
                    badge: role,
                    icon: 'ellipse-outline',
                    tagline: 'Role Mode',
                    color: colors.primary,
                  };
                  const isActive = role === activeRole;

                  return (
                    <TouchableOpacity
                      key={role}
                      activeOpacity={0.75}
                      style={[
                        styles.roleCard,
                        isActive && [styles.roleCardActive, { borderColor: config.color }],
                      ]}
                      onPress={() => handleSelectRole(role)}
                    >
                      <View style={[styles.iconBox, { backgroundColor: `${config.color}22` }]}>
                        <Ionicons name={config.icon as any} size={26} color={config.color} />
                      </View>

                      <View style={styles.roleInfo}>
                        <View style={styles.roleNameRow}>
                          <Text style={[styles.roleName, isActive && { color: config.color }]}>
                            {config.badge}
                          </Text>
                          {isActive && (
                            <View style={[styles.activeBadge, { backgroundColor: config.color }]}>
                              <Text style={styles.activeBadgeText}>ACTIVE</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.roleTagline}>{config.tagline}</Text>
                      </View>

                      <View style={styles.radioContainer}>
                        <Ionicons
                          name={isActive ? 'radio-button-on' : 'radio-button-off'}
                          size={22}
                          color={isActive ? config.color : colors.textTertiary}
                        />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <View style={styles.footerNote}>
                <Ionicons name="information-circle-outline" size={16} color={colors.textTertiary} />
                <Text style={styles.footerText}>
                  Backend role-based security is enforced across all modes.
                </Text>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.bodySm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    padding: spacing.xs,
  },
  list: {
    marginVertical: spacing.sm,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSecondary,
    padding: spacing.md,
    borderRadius: 16,
    marginBottom: spacing.sm,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  roleCardActive: {
    backgroundColor: `${colors.surfaceSecondary}F0`,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  roleInfo: {
    flex: 1,
  },
  roleNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  roleName: {
    ...typography.h4,
    color: colors.textPrimary,
    marginRight: spacing.sm,
  },
  activeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  activeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: 0.5,
  },
  roleTagline: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  radioContainer: {
    marginLeft: spacing.sm,
  },
  footerNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerText: {
    ...typography.caption,
    color: colors.textTertiary,
    marginLeft: 6,
  },
});
