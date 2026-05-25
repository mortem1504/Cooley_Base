import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../utils/theme';

const ICON_MAP = {
  Discover: { active: 'compass', inactive: 'compass-outline' },
  Messages: { active: 'chatbubble-ellipses', inactive: 'chatbubble-ellipses-outline' },
  Post: { active: 'add-circle', inactive: 'add-circle-outline' },
  Profile: { active: 'person-circle', inactive: 'person-circle-outline' },
  Wallet: { active: 'wallet', inactive: 'wallet-outline' },
};

export default function TabIcon({ badgeCount = 0, focused, label }) {
  const badgeLabel = badgeCount > 9 ? '9+' : `${badgeCount}`;
  const icons = ICON_MAP[label] || { active: 'ellipse', inactive: 'ellipse-outline' };
  const iconName = focused ? icons.active : icons.inactive;

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <Ionicons color={focused ? colors.primary : colors.subtleText} name={iconName} size={22} />
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
