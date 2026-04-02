import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { categories } from '../data/mockData';
import { useApp } from '../context/AppContext';
import { colors, radius, shadow, spacing } from '../theme';

function StatusBadge({ status }) {
  const label = status[0].toUpperCase() + status.slice(1);
  return (
    <View style={styles.statusBadge}>
      <Text style={styles.statusText}>{label}</Text>
    </View>
  );
}

export default function ListBrowseScreen({ navigation }) {
  const { filteredJobs, filters, setFilters } = useApp();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Local jobs near you</Text>
      <Text style={styles.subheading}>
        Filter by category, price, and distance to surface the best nearby short-term work.
      </Text>

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

      <View style={styles.controlsRow}>
        <Pressable
          style={styles.controlCard}
          onPress={() =>
            setFilters((prev) => ({
              ...prev,
              maxPrice: prev.maxPrice === 50 ? 20 : 50,
            }))
          }
        >
          <Text style={styles.controlLabel}>Price range</Text>
          <Text style={styles.controlValue}>Up to ${filters.maxPrice}</Text>
        </Pressable>
        <Pressable
          style={styles.controlCard}
          onPress={() =>
            setFilters((prev) => ({
              ...prev,
              maxDistance: prev.maxDistance === 3 ? 1 : 3,
            }))
          }
        >
          <Text style={styles.controlLabel}>Distance</Text>
          <Text style={styles.controlValue}>{filters.maxDistance} km</Text>
        </Pressable>
      </View>

      {filteredJobs.map((job) => (
        <Pressable
          key={job.id}
          style={styles.card}
          onPress={() => navigation.navigate('JobDetail', { jobId: job.id })}
        >
          <View style={styles.cardTop}>
            <View style={{ flex: 1, gap: 8 }}>
              <View style={styles.inlineMeta}>
                <Text style={styles.category}>{job.category}</Text>
                <StatusBadge status={job.status} />
              </View>
              <Text style={styles.cardTitle}>{job.title}</Text>
            </View>
            <Text style={styles.price}>${job.price}</Text>
          </View>
          <Text style={styles.metaText}>
            {job.location} · {job.distance} km · {job.date}, {job.time}
          </Text>
          <Text style={styles.description} numberOfLines={2}>
            {job.description}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md },
  heading: { fontSize: 28, lineHeight: 34, fontWeight: '800', color: colors.text },
  subheading: { color: colors.secondaryText, fontSize: 14, lineHeight: 21, marginBottom: 4 },
  chipsRow: { gap: spacing.sm, paddingRight: spacing.lg },
  chip: {
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  chipActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  chipText: { color: colors.secondaryText, fontWeight: '700' },
  chipTextActive: { color: colors.primary },
  controlsRow: { flexDirection: 'row', gap: spacing.sm },
  controlCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  controlLabel: { fontSize: 12, color: colors.subtleText },
  controlValue: { marginTop: 6, fontSize: 16, fontWeight: '800', color: colors.text },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
    ...shadow,
  },
  cardTop: { flexDirection: 'row', gap: spacing.md },
  inlineMeta: { flexDirection: 'row', gap: spacing.xs, alignItems: 'center', flexWrap: 'wrap' },
  category: { fontSize: 12, fontWeight: '700', color: colors.secondaryText },
  statusBadge: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusText: { color: colors.primary, fontWeight: '700', fontSize: 12 },
  cardTitle: { fontSize: 18, lineHeight: 24, fontWeight: '800', color: colors.text },
  price: { fontSize: 24, fontWeight: '800', color: colors.text },
  metaText: { fontSize: 13, color: colors.secondaryText },
  description: { fontSize: 14, color: colors.secondaryText, lineHeight: 21 },
});
