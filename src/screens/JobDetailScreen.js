import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../context/AppContext';
import { colors, radius, shadow, spacing } from '../theme';

const statusFlow = ['posted', 'accepted', 'in progress', 'completed'];

function formatStatus(status) {
  return status[0].toUpperCase() + status.slice(1);
}

export default function JobDetailScreen({ route, navigation }) {
  const { jobId } = route.params;
  const { getJobById, applyForJob, instantAcceptJob, updateJobStatus, cancelJob } = useApp();
  const job = getJobById(jobId);

  if (!job) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>Job not found</Text>
        <Pressable style={styles.inlineButton} onPress={() => navigation.goBack()}>
          <Text style={styles.inlineButtonText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const currentIndex = statusFlow.indexOf(job.status);
  const canAdvance = currentIndex >= 0 && currentIndex < statusFlow.length - 1;

  const handleAdvance = () => {
    if (!canAdvance) {
      return;
    }
    updateJobStatus(job.id, statusFlow[currentIndex + 1]);
  };

  const handleCancel = () => {
    cancelJob(job.id);
    Alert.alert('Job cancelled', 'This task has been marked as cancelled.');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View>
            <Text style={styles.category}>{job.category}</Text>
            <Text style={styles.title}>{job.title}</Text>
          </View>
          <Text style={styles.price}>${job.price}</Text>
        </View>
        <Text style={styles.description}>{job.description}</Text>
        <View style={styles.metaBlock}>
          <Text style={styles.metaText}>Location: {job.location}</Text>
          <Text style={styles.metaText}>
            When: {job.date}, {job.time}
          </Text>
          <Text style={styles.metaText}>Distance: {job.distance} km away</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Requester</Text>
        <Text style={styles.requesterName}>{job.requester.name}</Text>
        <Text style={styles.metaText}>
          {job.requester.school} · {job.requester.rating} rating
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Job status</Text>
        <View style={styles.timeline}>
          {statusFlow.map((status, index) => {
            const active = currentIndex >= index;
            return (
              <View key={status} style={styles.timelineItem}>
                <View style={[styles.timelineDot, active && styles.timelineDotActive]} />
                <Text style={[styles.timelineText, active && styles.timelineTextActive]}>
                  {formatStatus(status)}
                </Text>
              </View>
            );
          })}
          {job.status === 'cancelled' ? (
            <View style={styles.timelineItem}>
              <View style={[styles.timelineDot, { backgroundColor: colors.danger }]} />
              <Text style={[styles.timelineText, { color: colors.danger }]}>Cancelled</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.actionCard}>
        {job.status === 'posted' ? (
          <>
            <Pressable style={styles.primaryButton} onPress={() => applyForJob(job.id)}>
              <Text style={styles.primaryButtonText}>Apply for job</Text>
            </Pressable>
            {job.instantAccept ? (
              <Pressable style={styles.secondaryButton} onPress={() => instantAcceptJob(job.id)}>
                <Text style={styles.secondaryButtonText}>Instant accept</Text>
              </Pressable>
            ) : null}
          </>
        ) : null}

        {canAdvance && job.status !== 'cancelled' ? (
          <Pressable style={styles.secondaryButton} onPress={handleAdvance}>
            <Text style={styles.secondaryButtonText}>
              Move to {formatStatus(statusFlow[currentIndex + 1])}
            </Text>
          </Pressable>
        ) : null}

        {job.status !== 'completed' && job.status !== 'cancelled' ? (
          <Pressable style={styles.ghostButton} onPress={handleCancel}>
            <Text style={styles.ghostButtonText}>Cancel job</Text>
          </Pressable>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg },
  heroCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
    ...shadow,
  },
  heroHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  category: { color: colors.primary, fontWeight: '700', fontSize: 13, marginBottom: 8 },
  title: { color: colors.text, fontSize: 26, lineHeight: 31, fontWeight: '800', maxWidth: 260 },
  price: { color: colors.text, fontSize: 28, fontWeight: '800' },
  description: { color: colors.secondaryText, fontSize: 15, lineHeight: 23 },
  metaBlock: { gap: 6 },
  metaText: { color: colors.secondaryText, fontSize: 14 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
    ...shadow,
  },
  sectionTitle: { color: colors.text, fontWeight: '800', fontSize: 18 },
  requesterName: { color: colors.text, fontSize: 16, fontWeight: '700' },
  timeline: { gap: spacing.sm },
  timelineItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  timelineDot: { width: 12, height: 12, borderRadius: 999, backgroundColor: '#D8D4CB' },
  timelineDotActive: { backgroundColor: colors.primary },
  timelineText: { color: colors.subtleText, fontSize: 14, fontWeight: '600' },
  timelineTextActive: { color: colors.text },
  actionCard: { gap: spacing.sm, paddingBottom: spacing.xxl },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonText: { color: colors.card, fontWeight: '800', fontSize: 15 },
  secondaryButton: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
  },
  secondaryButtonText: { color: colors.text, fontWeight: '700', fontSize: 15 },
  ghostButton: { alignItems: 'center', paddingVertical: 12 },
  ghostButtonText: { color: colors.danger, fontWeight: '700', fontSize: 14 },
  emptyState: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  emptyTitle: { color: colors.text, fontSize: 20, fontWeight: '800' },
  inlineButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  inlineButtonText: { color: colors.card, fontWeight: '700' },
});
