import React from 'react';
import { TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../theme/colors';

type Props = {
  onPress?: () => void;
  /** Fallback route when the stack cannot go back (e.g. deep link). */
  fallback?: () => void;
  color?: string;
  size?: number;
  style?: ViewStyle;
  testID?: string;
  accessibilityLabel?: string;
};

/**
 * Consistent top-left back control. Uses MaterialIcons so the glyph
 * stays visible across Expo Go / web / native (Ionicons chevron-back
 * was missing or hard to see on several food flow screens).
 */
export const ScreenBackButton: React.FC<Props> = ({
  onPress,
  fallback,
  color = colors.textPrimary,
  size = 24,
  style,
  testID = 'screen-back-btn',
  accessibilityLabel = 'Go back',
}) => {
  const navigation = useNavigation<any>();

  const handlePress = () => {
    if (onPress) {
      onPress();
      return;
    }
    if (navigation?.canGoBack?.()) {
      navigation.goBack();
      return;
    }
    fallback?.();
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={[styles.btn, style]}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      <MaterialIcons name="arrow-back" size={size} color={color} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  btn: {
    padding: 6,
    marginRight: 4,
    minWidth: 36,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
