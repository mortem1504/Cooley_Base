import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../utils/theme';
import { formatJobPrice, formatJobSummaryMeta } from '../utils/jobFormatters';
import AppCard from './AppCard';
import JobStatusBadge from './JobStatusBadge';

export default function BrowseJobCard({ job, onPress }) {
  return (
    <Pressable onPress={onPress}>
      <AppCard style={styles.card}>
        {job.coverImageUrl ? <Image source={{ uri: job.coverImageUrl }} style={styles.coverImage} /> : null}
        <View style={styles.topRow}>
          <View style={styles.content}>
            <View style={styles.metaRow}>
              <Text style={styles.category}>{job.category}</Text>
              <JobStatusBadge status={job.status} />
            </View>
            <Text style={styles.title}>{job.title}</Text>
          </View>
          <Text style={styles.price}>{formatJobPrice(job.price)}</Text>
        </View>
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
    padding: spacing.lg,
  },
  coverImage: {
    borderRadius: 18,
    height: 128,
    width: '100%',
  },
  topRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  content: {
    flex: 1,
    gap: 8,
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  category: {
    color: colors.secondaryText,
    fontSize: 12,
    fontWeight: '700',
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 24,
  },
  price: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
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
