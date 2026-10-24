import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ViewStyle,
  StyleProp,
} from 'react-native';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Extra offset above the keyboard (iOS nav headers, etc.). */
  offset?: number;
};

/**
 * Shared keyboard avoidance for modals and form screens so focused
 * inputs stay visible above the soft keyboard on iOS and Android.
 */
export const FormKeyboardAvoid: React.FC<Props> = ({ children, style, offset }) => {
  return (
    <KeyboardAvoidingView
      style={[styles.root, style]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={offset ?? (Platform.OS === 'ios' ? 12 : 0)}
    >
      {children}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
