import React, { useEffect, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
  ViewStyle,
  StyleProp,
} from 'react-native';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Extra offset above the keyboard (iOS nav headers, etc.). */
  offset?: number;
  /**
   * form (default): iOS padding + Android height via KeyboardAvoidingView.
   * chat: lift bottom composer with live keyboard height (most reliable for message bars).
   */
  variant?: 'form' | 'chat';
};

/**
 * Shared keyboard avoidance so focused inputs stay visible above the soft keyboard.
 */
export const FormKeyboardAvoid: React.FC<Props> = ({
  children,
  style,
  offset,
  variant = 'form',
}) => {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    // Chat: always track height. Forms: track on Android (pan mode lift).
    if (variant !== 'chat' && Platform.OS !== 'android') return;

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e?.endCoordinates?.height ?? 0);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [variant]);

  if (variant === 'chat') {
    // Chat composers: lift by live keyboard height so the message bar stays visible.
    // Pairs with android softwareKeyboardLayoutMode "pan" (no double-offset from resize).
    return (
      <View
        style={[
          styles.root,
          style,
          keyboardHeight > 0 ? { paddingBottom: keyboardHeight } : null,
        ]}
      >
        {children}
      </View>
    );
  }

  // Forms: KeyboardAvoidingView + Android bottom pad from keyboard height for reliability.
  return (
    <KeyboardAvoidingView
      style={[
        styles.root,
        style,
        Platform.OS === 'android' && keyboardHeight > 0
          ? { paddingBottom: Math.max(0, keyboardHeight - 24) }
          : null,
      ]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
