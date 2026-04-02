import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../context/AppContext';
import { colors, radius, shadow, spacing } from '../theme';

export default function MapBrowseScreen({ navigation }) {
  const { filteredJobs, filters, setFilters } = useApp();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.topRow}>
        <Pressable
          style={styles.filterPill}
          onPress={() =>
            setFilters((prev) => ({
              ...prev,
              maxDistance: prev.maxDistance === 3 ? 1.5 : 3,
            }))
          }
        >
          <Text style={styles.filterPillText}>Distance {filters.maxDistance} km</Text>
        </Pressable>
        <Pressable
          style={styles.filterPill}
          onPress={() =>
            setFilters((prev) => ({
              ...prev,
              maxPrice: prev.maxPrice === 50 ? 25 : 50,
            }))
          }
        >
          <Text style={styles.filterPillText}>Price up to ${filters.maxPrice}</Text>
        </Pressable>
      </View>

      <View style={styles.mapCard}>
        <Text style={styles.mapLabel}>Campus map</Text>
        <Text style={styles.mapHint}>Tap a green pin to open the job.</Text>
        <View style={styles.mapSurface}>
          <View style={styles.mapRoadHorizontal} />
          <View style={styles.mapRoadVertical} />
          {filteredJobs.map((job) => (
            <Pressable
              key={job.id}
              style={[styles.pinWrap, job.coordinates]}
              onPress={() => navigation.navigate('JobDetail', { jobId: job.id })}
            >
              <View style={styles.pin}>
                <Text style={styles.pinPrice}>${job.price}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.bottomCard}>
        <View style={styles.bottomHeader}>
          <Text style={styles.sectionTitle}>Pinned nearby jobs</Text>
          <Pressable onPress={() => navigation.navigate('ListBrowse')}>
            <Text style={styles.linkText}>Switch to list</Text>
          </Pressable>
        </View>

        {filteredJobs.map((job) => (
          <Pressable
            key={job.id}
            style={styles.jobRow}
            onPress={() => navigation.navigate('JobDetail', { jobId: job.id })}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.jobTitle}>{job.title}</Text>
              <Text style={styles.jobMeta}>
                {job.location} · {job.distance} km · {job.time}
              </Text>
            </View>
            <Text style={styles.jobPrice}>${job.price}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg },
  topRow: { flexDirection: 'row', gap: spacing.sm },
  filterPill: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    alignItems: 'center',
  },
  filterPillText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  mapCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
    ...shadow,
  },
  mapLabel: { fontSize: 22, fontWeight: '800', color: colors.text },
  mapHint: { color: colors.secondaryText, fontSize: 13 },
  mapSurface: {
    height: 360,
    borderRadius: radius.lg,
    marginTop: spacing.sm,
    backgroundColor: colors.mapBase,
    overflow: 'hidden',
    position: 'relative',
  },
  mapRoadHorizontal: {
    position: 'absolute',
    top: '48%',
    left: -20,
    right: -20,
    height: 18,
    backgroundColor: '#DEE4D4',
    transform: [{ rotate: '-8deg' }],
  },
  mapRoadVertical: {
    position: 'absolute',
    top: -12,
    bottom: -12,
    left: '47%',
    width: 18,
    backgroundColor: '#DEE4D4',
    transform: [{ rotate: '8deg' }],
  },
  pinWrap: { position: 'absolute' },
  pin: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderBottomLeftRadius: 8,
    ...shadow,
  },
  pinPrice: { color: colors.card, fontWeight: '800', fontSize: 12 },
  bottomCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
    ...shadow,
  },
  bottomHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  linkText: { color: colors.primary, fontWeight: '700' },
  jobRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.background,
  },
  jobTitle: { color: colors.text, fontSize: 15, fontWeight: '700', marginBottom: 4 },
  jobMeta: { color: colors.secondaryText, fontSize: 12 },
  jobPrice: { color: colors.text, fontSize: 18, fontWeight: '800' },
});
