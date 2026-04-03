import React, { forwardRef } from 'react';
import { StyleSheet, TextInput } from 'react-native';
import { colors, radius, spacing } from '../utils/theme';

const AppTextInput = forwardRef(function AppTextInput({ style, ...props }, ref) {
  return (
    <TextInput
      placeholderTextColor={colors.subtleText}
      ref={ref}
      style={[styles.input, style]}
      {...props}
    />
  );
});

export default AppTextInput;

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
});
