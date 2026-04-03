import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../utils/theme';
import { formatJobStatus } from '../utils/jobFormatters';

export default function JobStatusBadge({ status }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.text}>{formatJobStatus(status)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  text: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
});
