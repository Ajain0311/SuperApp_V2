import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TouchableWithoutFeedback } from 'react-native';
import { useAlertStore } from '../../store/alertStore';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

export const AppAlert: React.FC = () => {
  const { isVisible, config, hideAlert } = useAlertStore();

  if (!config) return null;

  const { title, message, buttons, options } = config;

  const handleBackdropPress = () => {
    if (options?.cancelable) {
      options.onDismiss?.();
      hideAlert();
    }
  };

  const renderButtons = () => {
    const defaultButtons = [{ text: 'OK', onPress: () => {}, style: 'default' as const }];
    const activeButtons = buttons && buttons.length > 0 ? buttons : defaultButtons;

    return (
      <View style={styles.buttonContainer}>
        {activeButtons.map((button, index) => {
          const isDestructive = button.style === 'destructive';
          const isCancel = button.style === 'cancel';
          
          return (
            <TouchableOpacity
              key={index}
              style={[
                styles.button,
                isDestructive && styles.buttonDestructive,
                isCancel && styles.buttonCancel,
                activeButtons.length > 2 && styles.buttonStacked
              ]}
              onPress={() => {
                button.onPress?.();
                hideAlert();
              }}
            >
              <Text
                style={[
                  styles.buttonText,
                  isDestructive && styles.buttonTextDestructive,
                  isCancel && styles.buttonTextCancel
                ]}
              >
                {button.text || 'OK'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  return (
    <Modal
      transparent
      visible={isVisible}
      animationType="fade"
      onRequestClose={handleBackdropPress}
    >
      <TouchableWithoutFeedback onPress={handleBackdropPress}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.alertBox}>
              <Text style={styles.title}>{title}</Text>
              {!!message && <Text style={styles.message}>{message}</Text>}
              {renderButtons()}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  alertBox: {
    backgroundColor: colors.cardDark,
    borderRadius: spacing.radiusLg,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
    fontWeight: '700',
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  message: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  button: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: spacing.radiusMd,
    backgroundColor: colors.primary,
    minWidth: 80,
    alignItems: 'center',
  },
  buttonDestructive: {
    backgroundColor: colors.error,
  },
  buttonCancel: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonStacked: {
    width: '100%',
    marginBottom: spacing.xs,
  },
  buttonText: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  buttonTextDestructive: {
    color: '#FFFFFF',
  },
  buttonTextCancel: {
    color: colors.textSecondary,
  },
});
