import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../utils/theme';
import { formatJobPrice } from '../utils/jobFormatters';

export default function MapJobPin({ job, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.wrap, job.coordinates]}>
      <View style={styles.pin}>
        <Text style={styles.label}>{formatJobPrice(job.price)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
  },
  pin: {
    backgroundColor: colors.primary,
    borderBottomLeftRadius: 8,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  label: {
    color: colors.card,
    fontSize: 12,
    fontWeight: '800',
  },
});
