import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../utils/theme';

export default function TabIcon({ badgeCount = 0, focused, label }) {
  const badgeLabel = badgeCount > 9 ? '9+' : `${badgeCount}`;

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={[styles.dot, focused && styles.dotActive]} />
        {badgeCount ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badgeLabel}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.label, focused && styles.labelActive]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 4,
    minWidth: 64,
  },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  dot: {
    backgroundColor: 'transparent',
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  dotActive: {
    backgroundColor: colors.primary,
  },
  badge: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 999,
    justifyContent: 'center',
    minWidth: 18,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  badgeText: {
    color: colors.card,
    fontSize: 10,
    fontWeight: '800',
  },
  label: {
    color: colors.subtleText,
    fontSize: 12,
    fontWeight: '600',
  },
  labelActive: {
    color: colors.text,
    fontWeight: '700',
  },
});
