import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
  View,
} from 'react-native';
import { AppColors } from '../../theme/colors';
import { AppRadius } from '../../theme/spacing';

interface AppButtonProps {
  text: string;
  onPressed?: () => void;
  isLoading?: boolean;
  isOutlined?: boolean;
  backgroundColor?: string;
  textColor?: string;
  width?: number | string;
  height?: number;
  icon?: React.ReactNode;
  disabled?: boolean;
  style?: ViewStyle;
}

export const AppButton: React.FC<AppButtonProps> = ({
  text,
  onPressed,
  isLoading = false,
  isOutlined = false,
  backgroundColor,
  textColor,
  width = '100%',
  height = 52,
  icon,
  disabled = false,
  style,
}) => {
  const bg = backgroundColor || AppColors.primary;
  const tc = textColor || (isOutlined ? bg : '#FFFFFF');

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      disabled={disabled || isLoading}
      onPress={onPressed}
      style={[
        styles.base,
        {
          width: width as any,
          height,
          backgroundColor: isOutlined ? 'transparent' : bg,
          borderColor: bg,
          borderWidth: isOutlined ? 1.5 : 0,
          opacity: disabled ? 0.6 : 1,
        },
        style,
      ]}
    >
      {isLoading ? (
        <ActivityIndicator size="small" color={tc} />
      ) : (
        <View style={styles.content}>
          {icon && <View style={styles.iconContainer}>{icon}</View>}
          <Text style={[styles.text, { color: tc }]}>{text}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: AppRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginRight: 8,
  },
  text: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
