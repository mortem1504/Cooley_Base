import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import AppButton from '../components/AppButton';
import AppCard from '../components/AppCard';
import BrowseJobCard from '../components/BrowseJobCard';
import useAppState from '../hooks/useAppState';
import { ROOT_ROUTES } from '../navigation/routes';
import { colors, radius, spacing } from '../utils/theme';

const LISTING_FILTER_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: 'job', label: 'Jobs' },
  { key: 'rental', label: 'Items' },
];

function getListingGroup(listing) {
  if (listing?.type === 'rental') {
    return 'item';
  }

  if (listing?.type === 'job') {
    return 'job';
  }

  if (listing?.listingMode === 'rent' || listing?.listingMode === 'sell') {
    return 'item';
  }

  return 'job';
}

function CategoryChip({ category, onPress, selected }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipActive]}>
      <Text style={[styles.chipText, selected && styles.chipTextActive]}>{category.label}</Text>
    </Pressable>
  );
}

export default function ListBrowseScreen({ navigation }) {
  const { filters, isListingsLoading, listingsNotice, nearbyListings, resetFilters, setFilters } =
    useAppState();
  const [selectedListingFilter, setSelectedListingFilter] = useState('all');
  const visibleListings = useMemo(
    () =>
      nearbyListings.filter((listing) => {
        if (selectedListingFilter === 'job') {
          return getListingGroup(listing) === 'job';
        }

        if (selectedListingFilter === 'rental') {
          return getListingGroup(listing) === 'item';
        }

        return true;
      }),
    [nearbyListings, selectedListingFilter]
  );
  const hasActiveFilters =
    Boolean(filters.search) ||
    filters.maxPrice < 500 ||
    filters.maxDistance < 25 ||
    selectedListingFilter !== 'all';
  const handleResetNearbyFilters = () => {
    setSelectedListingFilter('all');
    resetFilters();
  };

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.container}>
      <Text style={styles.heading}>Nearby listings</Text>
      <Text style={styles.subheading}>
        Browse the same nearby jobs and items that power map suggestions and Discover.
      </Text>

      <ScrollView
        contentContainerStyle={styles.chipsRow}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {LISTING_FILTER_OPTIONS.map((category) => (
          <CategoryChip
            category={category}
            key={category.key}
            onPress={() => setSelectedListingFilter(category.key)}
            selected={selectedListingFilter === category.key}
          />
        ))}
      </ScrollView>

      <View style={styles.controlsRow}>
        <Pressable
          onPress={() =>
            setFilters((prev) => ({
              ...prev,
              maxPrice: prev.maxPrice === 500 ? 100 : 500,
            }))
          }
          style={styles.controlPressable}
        >
          <AppCard style={styles.controlCard}>
            <Text style={styles.controlLabel}>Price range</Text>
            <Text style={styles.controlValue}>Up to ${filters.maxPrice}</Text>
          </AppCard>
        </Pressable>
        <Pressable
          onPress={() =>
            setFilters((prev) => ({
              ...prev,
              maxDistance: prev.maxDistance === 25 ? 5 : 25,
            }))
          }
          style={styles.controlPressable}
        >
          <AppCard style={styles.controlCard}>
            <Text style={styles.controlLabel}>Distance</Text>
            <Text style={styles.controlValue}>{filters.maxDistance} km</Text>
          </AppCard>
        </Pressable>
      </View>

      {isListingsLoading ? (
        <AppCard style={styles.messageCard}>
          <Text style={styles.messageTitle}>Loading nearby listings</Text>
          <Text style={styles.messageText}>Pulling the latest listings from Supabase.</Text>
        </AppCard>
      ) : listingsNotice ? (
        <AppCard style={styles.messageCard}>
          <Text style={styles.messageTitle}>Could not load listings</Text>
          <Text style={styles.messageText}>{listingsNotice}</Text>
        </AppCard>
      ) : visibleListings.length ? (
        visibleListings.map((job) => (
          <BrowseJobCard
            job={job}
            key={job.id}
            onPress={() => navigation.navigate(ROOT_ROUTES.JOB_DETAIL, { jobId: job.id })}
          />
        ))
      ) : (
        <AppCard style={styles.messageCard}>
          <Text style={styles.messageTitle}>No listings match these filters</Text>
          <Text style={styles.messageText}>
            Adjust your type, price, or distance filters to see more nearby results.
          </Text>
          {hasActiveFilters ? (
            <AppButton
              label="Reset filters"
              onPress={handleResetNearbyFilters}
              style={styles.resetButton}
              variant="secondary"
            />
          ) : null}
        </AppCard>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
  },
  content: {
    gap: spacing.md,
    padding: spacing.lg,
  },
  heading: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
  },
  subheading: {
    color: colors.secondaryText,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 4,
  },
  chipsRow: {
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  chip: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  chipActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  chipText: {
    color: colors.secondaryText,
    fontWeight: '700',
  },
  chipTextActive: {
    color: colors.primary,
  },
  controlsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  controlPressable: {
    flex: 1,
  },
  controlCard: {
    padding: spacing.md,
  },
  controlLabel: {
    color: colors.subtleText,
    fontSize: 12,
  },
  controlValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 6,
  },
  messageCard: {
    gap: spacing.xs,
    padding: spacing.lg,
  },
  messageTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  messageText: {
    color: colors.secondaryText,
    fontSize: 14,
    lineHeight: 21,
  },
  resetButton: {
    marginTop: spacing.sm,
  },
});
