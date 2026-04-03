import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import AppButton from '../components/AppButton';
import AppCard from '../components/AppCard';
import AppTextInput from '../components/AppTextInput';
import FeaturedJobCard from '../components/FeaturedJobCard';
import useAppState from '../hooks/useAppState';
import useScreenTopInset from '../hooks/useScreenTopInset';
import { DISCOVER_ROUTES, ROOT_ROUTES } from '../navigation/routes';
import { jobCategories } from '../services/jobService';
import { colors, radius, spacing } from '../utils/theme';

function CategoryChip({ category, onPress, selected }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipActive]}>
      <Text style={[styles.chipText, selected && styles.chipTextActive]}>{category}</Text>
    </Pressable>
  );
}

export default function DiscoverScreen({ navigation }) {
  const {
    currentUser,
    filteredJobs,
    filters,
    isListingsLoading,
    listingsNotice,
    resetFilters,
    setFilters,
  } = useAppState();
  const topInset = useScreenTopInset(spacing.lg);
  const nearbyJobs = filteredJobs.slice(0, 3);
  const hasActiveFilters =
    Boolean(filters.search) ||
    filters.category !== 'All' ||
    filters.maxPrice < 500 ||
    filters.maxDistance < 25;

  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingTop: topInset }]} style={styles.container}>
      <AppCard style={styles.heroCard}>
        <Text style={styles.greeting}>Hello, {currentUser.name.split(' ')[0]}</Text>
        <Text style={styles.heading}>Find nearby quick jobs in minutes.</Text>
        <Text style={styles.subheading}>
          Browse runner work, event support, simple delivery help, and other short-term tasks
          around campus.
        </Text>
        <AppTextInput
          onChangeText={(value) => setFilters((prev) => ({ ...prev, search: value }))}
          placeholder="Search runner, usher, helper, delivery"
          value={filters.search}
        />
      </AppCard>

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

      <AppCard style={styles.switchCard}>
        <View>
          <Text style={styles.sectionTitle}>Discover nearby</Text>
          <Text style={styles.sectionSubtitle}>Switch between list cards and a visual map.</Text>
        </View>
        <View style={styles.switchButtons}>
          <AppButton
            label="Map view"
            onPress={() => navigation.navigate(DISCOVER_ROUTES.MAP)}
            style={styles.flexButton}
            variant="secondary"
          />
          <AppButton
            label="List view"
            onPress={() => navigation.navigate(DISCOVER_ROUTES.LIST)}
            style={styles.flexButton}
          />
        </View>
      </AppCard>

      <View style={styles.statRow}>
        <AppCard style={styles.statCard}>
          <Text style={styles.statValue}>{filteredJobs.length}</Text>
          <Text style={styles.statLabel}>Nearby jobs</Text>
        </AppCard>
        <AppCard style={styles.statCard}>
          <Text style={styles.statValue}>15 min</Text>
          <Text style={styles.statLabel}>Average response</Text>
        </AppCard>
        <AppCard style={styles.statCard}>
          <Text style={styles.statValue}>4.9</Text>
          <Text style={styles.statLabel}>Trust score</Text>
        </AppCard>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Quick picks</Text>
        <Pressable onPress={() => navigation.navigate(DISCOVER_ROUTES.LIST)}>
          <Text style={styles.linkText}>See all</Text>
        </Pressable>
      </View>

      {isListingsLoading ? (
        <AppCard style={styles.messageCard}>
          <Text style={styles.messageTitle}>Loading nearby jobs</Text>
          <Text style={styles.messageText}>Fetching the latest listings from your live backend.</Text>
        </AppCard>
      ) : listingsNotice ? (
        <AppCard style={styles.messageCard}>
          <Text style={styles.messageTitle}>Could not load jobs</Text>
          <Text style={styles.messageText}>{listingsNotice}</Text>
        </AppCard>
      ) : nearbyJobs.length ? (
        nearbyJobs.map((job) => (
          <FeaturedJobCard
            job={job}
            key={job.id}
            onPress={() => navigation.navigate(ROOT_ROUTES.JOB_DETAIL, { jobId: job.id })}
          />
        ))
      ) : (
        <AppCard style={styles.messageCard}>
          <Text style={styles.messageTitle}>No nearby jobs yet</Text>
          <Text style={styles.messageText}>
            {hasActiveFilters
              ? 'Your current filters are hiding available jobs. Reset them to see more nearby posts.'
              : 'Publish the first campus task from the Post tab and it will appear here.'}
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
    gap: spacing.lg,
    padding: spacing.lg,
  },
  heroCard: {
    gap: spacing.sm,
    padding: spacing.lg,
  },
  greeting: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
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
    lineHeight: 22,
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
    paddingHorizontal: 16,
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
  switchCard: {
    gap: spacing.md,
    padding: spacing.lg,
  },
  switchButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  flexButton: {
    flex: 1,
  },
  statRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    padding: spacing.md,
  },
  statValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  statLabel: {
    color: colors.subtleText,
    fontSize: 12,
    marginTop: 6,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  sectionSubtitle: {
    color: colors.secondaryText,
    fontSize: 13,
    marginTop: 4,
  },
  linkText: {
    color: colors.primary,
    fontWeight: '700',
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
