import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../utils/theme';
import { formatJobPrice, formatJobSummaryMeta } from '../utils/jobFormatters';
import AppCard from './AppCard';

export default function FeaturedJobCard({ job, onPress }) {
  return (
    <Pressable onPress={onPress}>
      <AppCard style={styles.card}>
        {job.coverImageUrl ? <Image source={{ uri: job.coverImageUrl }} style={styles.coverImage} /> : null}
        <View style={styles.header}>
          <View style={styles.metaRow}>
            <Text style={styles.category}>{job.category}</Text>
            {job.urgent ? <Text style={styles.urgent}>Urgent</Text> : null}
          </View>
          <Text style={styles.price}>{formatJobPrice(job.price)}</Text>
        </View>
        <Text style={styles.title}>{job.title}</Text>
        <Text style={styles.meta}>{formatJobSummaryMeta(job)}</Text>
        <Text numberOfLines={2} style={styles.description}>
          {job.description}
        </Text>
      </AppCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    overflow: 'hidden',
    padding: spacing.lg,
  },
  coverImage: {
    borderRadius: radius.md,
    height: 152,
    width: '100%',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  category: {
    color: colors.secondaryText,
    fontSize: 13,
    fontWeight: '700',
  },
  urgent: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  price: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 24,
  },
  meta: {
    color: colors.secondaryText,
    fontSize: 13,
  },
  description: {
    color: colors.secondaryText,
    fontSize: 14,
    lineHeight: 21,
  },
});
