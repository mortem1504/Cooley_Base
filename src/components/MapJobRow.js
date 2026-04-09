import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../utils/theme';
import {
  formatJobPrice,
  formatMapJobMeta,
  getListingBadgeLabel,
  getListingBadgeVariant,
} from '../utils/jobFormatters';

export default function MapJobRow({ job, onPress }) {
  const badgeVariant = getListingBadgeVariant(job);

  return (
    <Pressable style={styles.row} onPress={onPress}>
      {job.coverImageUrl ? <Image source={{ uri: job.coverImageUrl }} style={styles.thumbnail} /> : null}
      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text numberOfLines={1} style={styles.title}>
            {job.title}
          </Text>
          <View
            style={[
              styles.typeBadge,
              badgeVariant === 'rent' && styles.typeBadgeRent,
              badgeVariant === 'sell' && styles.typeBadgeSell,
            ]}
          >
            <Text
              style={[
                styles.typeBadgeText,
                badgeVariant === 'rent' && styles.typeBadgeTextRent,
                badgeVariant === 'sell' && styles.typeBadgeTextSell,
              ]}
            >
              {getListingBadgeLabel(job)}
            </Text>
          </View>
        </View>
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
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: 4,
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  typeBadge: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  typeBadgeRent: {
    backgroundColor: '#FFF0DD',
  },
  typeBadgeSell: {
    backgroundColor: '#E6F6EC',
  },
  typeBadgeText: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '800',
  },
  typeBadgeTextRent: {
    color: '#D97904',
  },
  typeBadgeTextSell: {
    color: '#23834C',
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
