import React from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppColors } from '../../theme/colors';
import { AppRadius } from '../../theme/spacing';

interface AppSearchBarProps {
  value?: string;
  onChangeText?: (text: string) => void;
  placeholder?: string;
  onClear?: () => void;
  onSubmitEditing?: () => void;
  editable?: boolean;
  onPress?: () => void;
}

export const AppSearchBar: React.FC<AppSearchBarProps> = ({
  value,
  onChangeText,
  placeholder = 'Search...',
  onClear,
  onSubmitEditing,
  editable = true,
  onPress,
}) => {
  const content = (
    <View style={styles.container}>
      <Ionicons name="search-outline" size={20} color={AppColors.textTertiary} style={styles.icon} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={AppColors.textHint}
        style={styles.input}
        editable={editable}
        onSubmitEditing={onSubmitEditing}
        returnKeyType="search"
      />
      {Boolean(value && value.length > 0) && (
        <TouchableOpacity
          onPress={() => {
            if (onChangeText) onChangeText('');
            if (onClear) onClear();
          }}
          style={styles.clearButton}
        >
          <Ionicons name="close-circle" size={18} color={AppColors.textTertiary} />
        </TouchableOpacity>
      )}
    </View>
  );

  if (onPress && !editable) {
    return (
      <TouchableOpacity activeOpacity={0.8} onPress={onPress}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

const styles = StyleSheet.create({
  container: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.surfaceLight,
    borderRadius: AppRadius.md,
    borderWidth: 1,
    borderColor: AppColors.border,
    paddingHorizontal: 14,
  },
  icon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: AppColors.textPrimary,
    fontSize: 14,
    height: '100%',
  },
  clearButton: {
    padding: 4,
  },
});
