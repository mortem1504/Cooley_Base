import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius } from '../utils/theme';

const variantStyles = {
  primary: {
    container: {
      backgroundColor: colors.primary,
      borderWidth: 0,
    },
    text: {
      color: colors.card,
      fontWeight: '800',
    },
  },
  secondary: {
    container: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    text: {
      color: colors.text,
      fontWeight: '700',
    },
  },
  ghost: {
    container: {
      backgroundColor: 'transparent',
      borderWidth: 0,
      paddingVertical: 12,
    },
    text: {
      color: colors.danger,
      fontWeight: '700',
    },
  },
};

export default function AppButton({
  label,
  onPress,
  variant = 'primary',
  style,
  textStyle,
  disabled = false,
}) {
  const stylesForVariant = variantStyles[variant] || variantStyles.primary;

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        stylesForVariant.container,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      <Text style={[styles.text, stylesForVariant.text, disabled && styles.textDisabled, textStyle]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: radius.md,
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  text: {
    fontSize: 15,
  },
  disabled: {
    opacity: 0.7,
  },
  textDisabled: {
    opacity: 0.8,
  },
  pressed: {
    opacity: 0.9,
  },
});
