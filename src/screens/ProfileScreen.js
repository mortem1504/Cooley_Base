import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import AppButton from '../components/AppButton';
import AppCard from '../components/AppCard';
import useAppState from '../hooks/useAppState';
import useScreenTopInset from '../hooks/useScreenTopInset';
import { TAB_ROUTES } from '../navigation/routes';
import { skillTags } from '../services/profileService';
import { colors, radius, spacing } from '../utils/theme';

function formatStatus(status) {
  return status
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export default function ProfileScreen({ navigation }) {
  const { currentUser, isListingsLoading, jobs, listingsNotice, logout, myListings } =
    useAppState();
  const topInset = useScreenTopInset(spacing.lg);
  const activeJobs = jobs.filter(
    (job) =>
      job.createdBy === currentUser.id &&
      job.status !== 'completed' &&
      job.status !== 'cancelled'
  );

  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingTop: topInset }]} style={styles.container}>
      <AppCard style={styles.profileCard}>
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
      </AppCard>

      <AppCard style={styles.card}>
        <Text style={styles.sectionTitle}>Listed skills</Text>
        <View style={styles.skillWrap}>
          {skillTags.map((skill) => (
            <View key={skill} style={styles.skillPill}>
              <Text style={styles.skillText}>{skill}</Text>
            </View>
          ))}
        </View>
      </AppCard>

      <AppCard style={styles.card}>
        <View style={styles.sectionHeadingRow}>
          <Text style={styles.sectionTitle}>Your listings</Text>
          <Text style={styles.sectionCount}>{myListings.length}</Text>
        </View>

        {isListingsLoading ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Loading your listings</Text>
            <Text style={styles.emptyText}>
              Pulling your latest job and rental posts from Supabase.
            </Text>
          </View>
        ) : listingsNotice ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Could not load your listings</Text>
            <Text style={styles.emptyText}>{listingsNotice}</Text>
          </View>
        ) : myListings.length ? (
          myListings.map((listing) => (
            <Pressable
              key={listing.id}
              onPress={() =>
                navigation.navigate(TAB_ROUTES.POST_JOB, {
                  editListingId: listing.id,
                })
              }
              style={styles.listingRow}
            >
              <View style={styles.listingMainRow}>
                {listing.coverImageUrl ? (
                  <Image source={{ uri: listing.coverImageUrl }} style={styles.listingThumb} />
                ) : null}
                <View style={styles.flexOne}>
                  <View style={styles.listingHeaderRow}>
                    <View
                      style={[
                        styles.listingTypePill,
                        listing.type === 'rental' && styles.listingTypePillAlt,
                      ]}
                    >
                      <Text
                        style={[
                          styles.listingTypeText,
                          listing.type === 'rental' && styles.listingTypeTextAlt,
                        ]}
                      >
                        {listing.type === 'job' ? 'Job' : 'Rental'}
                      </Text>
                    </View>
                    <Text style={styles.listingStatus}>{formatStatus(listing.status)}</Text>
                  </View>
                  <Text style={styles.listingTitle}>{listing.title}</Text>
                  <Text style={styles.listingMeta}>
                    {listing.category} - {listing.location}
                  </Text>
                  <View style={styles.listingFooterRow}>
                    <Text style={styles.listingMeta}>{listing.detail}</Text>
                    <View style={styles.listingFooterRight}>
                      <Text style={styles.listingEdit}>Edit</Text>
                      <Text style={styles.listingPrice}>${listing.price}</Text>
                    </View>
                  </View>
                </View>
              </View>
            </Pressable>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No listings yet</Text>
            <Text style={styles.emptyText}>
              Your job and rental posts will appear here after you publish them.
            </Text>
          </View>
        )}
      </AppCard>

      <AppCard style={styles.card}>
        <Text style={styles.sectionTitle}>Current activity</Text>
        {isListingsLoading ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Loading current activity</Text>
            <Text style={styles.emptyText}>
              Active jobs will appear here as soon as your listings finish loading.
            </Text>
          </View>
        ) : listingsNotice ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Current activity is unavailable</Text>
            <Text style={styles.emptyText}>{listingsNotice}</Text>
          </View>
        ) : activeJobs.length ? (
          activeJobs.slice(0, 3).map((job) => (
            <View key={job.id} style={styles.activityRow}>
              <View style={styles.flexOne}>
                <Text style={styles.activityTitle}>{job.title}</Text>
                <Text style={styles.activityMeta}>
                  {job.location} - {formatStatus(job.status)}
                </Text>
              </View>
              <Text style={styles.activityPrice}>${job.price}</Text>
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No active posts</Text>
            <Text style={styles.emptyText}>
              Any job you publish and keep live will show up here while it is still active.
            </Text>
          </View>
        )}
      </AppCard>

      <AppButton label="Log out" onPress={logout} variant="ghost" />
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
  profileCard: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 44,
    height: 88,
    justifyContent: 'center',
    width: 88,
  },
  avatarText: {
    color: colors.primary,
    fontSize: 26,
    fontWeight: '800',
  },
  name: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
  },
  badge: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  badgeText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  bio: {
    color: colors.secondaryText,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  statRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: 6,
  },
  statItem: {
    alignItems: 'center',
    minWidth: 78,
  },
  statValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  statLabel: {
    color: colors.subtleText,
    fontSize: 12,
    marginTop: 4,
  },
  card: {
    gap: spacing.md,
    padding: spacing.lg,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  sectionHeadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionCount: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  skillWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  skillPill: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  skillText: {
    color: colors.secondaryText,
    fontSize: 13,
    fontWeight: '700',
  },
  listingRow: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  listingMainRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  listingHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  listingThumb: {
    borderRadius: radius.md,
    height: 84,
    width: 84,
  },
  listingTypePill: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  listingTypePillAlt: {
    backgroundColor: '#F1F5FF',
  },
  listingTypeText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  listingTypeTextAlt: {
    color: '#4566C9',
  },
  listingStatus: {
    color: colors.secondaryText,
    fontSize: 12,
    fontWeight: '700',
  },
  listingTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  listingMeta: {
    color: colors.secondaryText,
    fontSize: 13,
  },
  listingFooterRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  listingFooterRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  listingEdit: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  listingPrice: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  activityRow: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  flexOne: {
    flex: 1,
  },
  activityTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 5,
  },
  activityMeta: {
    color: colors.secondaryText,
    fontSize: 12,
  },
  activityPrice: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  emptyState: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 6,
    padding: spacing.md,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  emptyText: {
    color: colors.secondaryText,
    fontSize: 13,
    lineHeight: 19,
  },
});
