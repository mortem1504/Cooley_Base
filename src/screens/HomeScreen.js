import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { categories } from '../data/mockData';
import { useApp } from '../context/AppContext';
import { colors, radius, shadow, spacing } from '../theme';

function JobPreviewCard({ job, onPress }) {
  return (
    <Pressable style={styles.jobCard} onPress={onPress}>
      <View style={styles.jobCardHeader}>
        <View style={styles.jobMetaRow}>
          <Text style={styles.jobCategory}>{job.category}</Text>
          {job.urgent ? <Text style={styles.urgentPill}>Urgent</Text> : null}
        </View>
        <Text style={styles.jobPrice}>${job.price}</Text>
      </View>
      <Text style={styles.jobTitle}>{job.title}</Text>
      <Text style={styles.jobSubtitle}>
        {job.location} · {job.distance} km · {job.date}, {job.time}
      </Text>
      <Text numberOfLines={2} style={styles.jobDescription}>
        {job.description}
      </Text>
    </Pressable>
  );
}

export default function HomeScreen({ navigation }) {
  const { currentUser, filteredJobs, filters, setFilters } = useApp();
  const nearbyJobs = filteredJobs.slice(0, 3);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.heroCard}>
        <Text style={styles.greeting}>Hello, {currentUser.name.split(' ')[0]}</Text>
        <Text style={styles.heading}>Find nearby quick jobs in minutes.</Text>
        <Text style={styles.subheading}>
          Browse runner work, event support, simple delivery help, and other short-term tasks
          around campus.
        </Text>

        <TextInput
          value={filters.search}
          onChangeText={(value) => setFilters((prev) => ({ ...prev, search: value }))}
          placeholder="Search runner, usher, helper, delivery"
          placeholderTextColor={colors.subtleText}
          style={styles.searchInput}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
        {categories.map((category) => {
          const selected = filters.category === category;
          return (
            <Pressable
              key={category}
              style={[styles.chip, selected && styles.chipActive]}
              onPress={() => setFilters((prev) => ({ ...prev, category }))}
            >
              <Text style={[styles.chipText, selected && styles.chipTextActive]}>{category}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.switchCard}>
        <View>
          <Text style={styles.sectionTitle}>Discover nearby</Text>
          <Text style={styles.sectionSubtitle}>Switch between list cards and a visual map.</Text>
        </View>
        <View style={styles.switchButtons}>
          <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate('MapBrowse')}>
            <Text style={styles.secondaryButtonText}>Map view</Text>
          </Pressable>
          <Pressable style={styles.primaryButton} onPress={() => navigation.navigate('ListBrowse')}>
            <Text style={styles.primaryButtonText}>List view</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.statRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{filteredJobs.length}</Text>
          <Text style={styles.statLabel}>Nearby jobs</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>15 min</Text>
          <Text style={styles.statLabel}>Average response</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>4.9</Text>
          <Text style={styles.statLabel}>Trust score</Text>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Quick picks</Text>
        <Pressable onPress={() => navigation.navigate('ListBrowse')}>
          <Text style={styles.linkText}>See all</Text>
        </Pressable>
      </View>

      {nearbyJobs.map((job) => (
        <JobPreviewCard
          key={job.id}
          job={job}
          onPress={() => navigation.navigate('JobDetail', { jobId: job.id })}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingTop: spacing.xxl, gap: spacing.lg },
  heroCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
    ...shadow,
  },
  greeting: { fontSize: 14, fontWeight: '700', color: colors.primary },
  heading: { fontSize: 28, lineHeight: 34, fontWeight: '800', color: colors.text },
  subheading: { fontSize: 14, lineHeight: 22, color: colors.secondaryText },
  searchInput: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: 15,
    fontSize: 15,
    color: colors.text,
  },
  chipsRow: { gap: spacing.sm, paddingRight: spacing.lg },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  chipText: { color: colors.secondaryText, fontWeight: '700' },
  chipTextActive: { color: colors.primary },
  switchCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
    ...shadow,
  },
  switchButtons: { flexDirection: 'row', gap: spacing.sm },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  secondaryButtonText: { color: colors.text, fontWeight: '700' },
  primaryButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: { color: colors.card, fontWeight: '800' },
  statRow: { flexDirection: 'row', gap: spacing.sm },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: { fontSize: 20, fontWeight: '800', color: colors.text },
  statLabel: { marginTop: 6, fontSize: 12, color: colors.subtleText },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  sectionSubtitle: { fontSize: 13, color: colors.secondaryText, marginTop: 4 },
  linkText: { color: colors.primary, fontWeight: '700' },
  jobCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
    ...shadow,
  },
  jobCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  jobMetaRow: { flexDirection: 'row', gap: spacing.xs, alignItems: 'center' },
  jobCategory: { color: colors.secondaryText, fontWeight: '700', fontSize: 13 },
  urgentPill: {
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    overflow: 'hidden',
    fontSize: 12,
    fontWeight: '700',
  },
  jobPrice: { color: colors.text, fontSize: 24, fontWeight: '800' },
  jobTitle: { color: colors.text, fontSize: 18, lineHeight: 24, fontWeight: '800' },
  jobSubtitle: { color: colors.secondaryText, fontSize: 13 },
  jobDescription: { color: colors.secondaryText, fontSize: 14, lineHeight: 21 },
});
