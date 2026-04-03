import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import AppButton from '../components/AppButton';
import AppCard from '../components/AppCard';
import BrowseJobCard from '../components/BrowseJobCard';
import useAppState from '../hooks/useAppState';
import { ROOT_ROUTES } from '../navigation/routes';
import { jobCategories } from '../services/jobService';
import { colors, radius, spacing } from '../utils/theme';

function CategoryChip({ category, onPress, selected }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipActive]}>
      <Text style={[styles.chipText, selected && styles.chipTextActive]}>{category}</Text>
    </Pressable>
  );
}

export default function ListBrowseScreen({ navigation }) {
  const { filteredJobs, filters, isListingsLoading, listingsNotice, resetFilters, setFilters } =
    useAppState();
  const hasActiveFilters =
    Boolean(filters.search) ||
    filters.category !== 'All' ||
    filters.maxPrice < 500 ||
    filters.maxDistance < 25;

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.container}>
      <Text style={styles.heading}>Local jobs near you</Text>
      <Text style={styles.subheading}>
        Filter by category, price, and distance to surface the best nearby short-term work.
      </Text>

      <ScrollView
        contentContainerStyle={styles.chipsRow}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {jobCategories.map((category) => (
          <CategoryChip
            category={category}
            key={category}
            onPress={() => setFilters((prev) => ({ ...prev, category }))}
            selected={filters.category === category}
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
          <Text style={styles.messageTitle}>Loading job list</Text>
          <Text style={styles.messageText}>Pulling the latest listings from Supabase.</Text>
        </AppCard>
      ) : listingsNotice ? (
        <AppCard style={styles.messageCard}>
          <Text style={styles.messageTitle}>Could not load listings</Text>
          <Text style={styles.messageText}>{listingsNotice}</Text>
        </AppCard>
      ) : filteredJobs.length ? (
        filteredJobs.map((job) => (
          <BrowseJobCard
            job={job}
            key={job.id}
            onPress={() => navigation.navigate(ROOT_ROUTES.JOB_DETAIL, { jobId: job.id })}
          />
        ))
      ) : (
        <AppCard style={styles.messageCard}>
          <Text style={styles.messageTitle}>No jobs match these filters</Text>
          <Text style={styles.messageText}>
            Adjust your category, price, or distance filters to see more listings.
          </Text>
          {hasActiveFilters ? (
            <AppButton
              label="Reset filters"
              onPress={resetFilters}
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
