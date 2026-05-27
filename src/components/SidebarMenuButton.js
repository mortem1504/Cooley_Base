import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, radius, shadow } from '../utils/theme';

export default function SidebarMenuButton({ onPress, style }) {
  return (
    <Pressable onPress={onPress} style={[styles.button, style]}>
      <View style={styles.bar} />
      <View style={styles.barWide} />
      <View style={styles.bar} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 4,
    height: 42,
    justifyContent: 'center',
    width: 42,
    ...shadow,
  },
  bar: {
    backgroundColor: colors.text,
    borderRadius: 999,
    height: 2.5,
    width: 14,
  },
  barWide: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    height: 2.5,
    width: 18,
  },
});
