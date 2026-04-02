import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { skillTags } from '../data/mockData';
import { useApp } from '../context/AppContext';
import { colors, radius, shadow, spacing } from '../theme';

export default function ProfileScreen() {
  const { currentUser, jobs, logout } = useApp();
  const activeJobs = jobs.filter((job) => job.status !== 'completed' && job.status !== 'cancelled');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{currentUser.avatar}</Text>
        </View>
        <Text style={styles.name}>{currentUser.name}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Verified student</Text>
        </View>
        <Text style={styles.bio}>{currentUser.shortBio}</Text>

        <View style={styles.statRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{currentUser.rating}</Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{currentUser.completedJobs}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{currentUser.skills.length}</Text>
            <Text style={styles.statLabel}>Skills</Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Listed skills</Text>
        <View style={styles.skillWrap}>
          {skillTags.map((skill) => (
            <View key={skill} style={styles.skillPill}>
              <Text style={styles.skillText}>{skill}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Current activity</Text>
        {activeJobs.slice(0, 3).map((job) => (
          <View key={job.id} style={styles.activityRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.activityTitle}>{job.title}</Text>
              <Text style={styles.activityMeta}>
                {job.location} · {job.status}
              </Text>
            </View>
            <Text style={styles.activityPrice}>${job.price}</Text>
          </View>
        ))}
      </View>

      <Pressable style={styles.logoutButton} onPress={logout}>
        <Text style={styles.logoutButtonText}>Log out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingTop: spacing.xxl, gap: spacing.lg },
  profileCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    gap: spacing.sm,
    ...shadow,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.primary, fontSize: 26, fontWeight: '800' },
  name: { color: colors.text, fontSize: 24, fontWeight: '800' },
  badge: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  badgeText: { color: colors.primary, fontWeight: '700', fontSize: 12 },
  bio: { color: colors.secondaryText, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  statRow: { flexDirection: 'row', gap: spacing.md, marginTop: 6 },
  statItem: { minWidth: 78, alignItems: 'center' },
  statValue: { color: colors.text, fontSize: 20, fontWeight: '800' },
  statLabel: { color: colors.subtleText, fontSize: 12, marginTop: 4 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
    ...shadow,
  },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  skillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  skillPill: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  skillText: { color: colors.secondaryText, fontWeight: '700', fontSize: 13 },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  activityTitle: { color: colors.text, fontSize: 15, fontWeight: '700', marginBottom: 5 },
  activityMeta: { color: colors.secondaryText, fontSize: 12 },
  activityPrice: { color: colors.text, fontSize: 18, fontWeight: '800' },
  logoutButton: { alignItems: 'center', paddingVertical: 14 },
  logoutButtonText: { color: colors.danger, fontWeight: '700', fontSize: 15 },
});
