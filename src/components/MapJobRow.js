import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../utils/theme';
import { formatJobPrice, formatMapJobMeta } from '../utils/jobFormatters';

export default function MapJobRow({ job, onPress }) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      {job.coverImageUrl ? <Image source={{ uri: job.coverImageUrl }} style={styles.thumbnail} /> : null}
      <View style={styles.content}>
        <Text style={styles.title}>{job.title}</Text>
        <Text style={styles.meta}>{formatMapJobMeta(job)}</Text>
      </View>
      <Text style={styles.price}>{formatJobPrice(job.price)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  content: {
    flex: 1,
  },
  thumbnail: {
    borderRadius: radius.md,
    height: 56,
    width: 56,
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  meta: {
    color: colors.secondaryText,
    fontSize: 12,
  },
  price: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
});
