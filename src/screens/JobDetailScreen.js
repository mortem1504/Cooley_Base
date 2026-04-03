import React, { useEffect, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import AppButton from '../components/AppButton';
import AppCard from '../components/AppCard';
import useAppState from '../hooks/useAppState';
import { ROOT_ROUTES, TAB_ROUTES } from '../navigation/routes';
import { buildInitials } from '../services/profileService';
import { jobStatusFlow } from '../services/jobService';
import { colors, radius, spacing } from '../utils/theme';
import { formatJobDistance, formatJobPrice, formatJobStatus } from '../utils/jobFormatters';

function ApplicantCard({ application, canReview, onAccept, onReject }) {
  return (
    <View style={styles.applicantCard}>
      <View style={styles.applicantHeader}>
        <View style={styles.applicantAvatar}>
          <Text style={styles.applicantAvatarText}>
            {application.applicant.initials || buildInitials(application.applicant.name)}
          </Text>
        </View>
        <View style={styles.applicantCopy}>
          <View style={styles.applicantNameRow}>
            <Text style={styles.applicantName}>{application.applicant.name}</Text>
            {application.applicant.isVerified ? (
              <View style={styles.applicantBadge}>
                <Text style={styles.applicantBadgeText}>Verified</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.applicantMeta}>
            {application.applicant.school} - {application.applicant.rating} rating
          </Text>
          {application.applicant.shortBio ? (
            <Text numberOfLines={2} style={styles.applicantBio}>
              {application.applicant.shortBio}
            </Text>
          ) : null}
        </View>
        <Text style={styles.applicantStatus}>{formatJobStatus(application.status)}</Text>
      </View>

      {canReview ? (
        <View style={styles.applicantActions}>
          <AppButton label="Accept" onPress={onAccept} style={styles.flexButton} />
          <AppButton
            label="Reject"
            onPress={onReject}
            style={styles.flexButton}
            variant="secondary"
          />
        </View>
      ) : null}
    </View>
  );
}

export default function JobDetailScreen({ navigation, route }) {
  const { jobId } = route.params;
  const {
    applicationsNotice,
    currentUser,
    getJobById,
    getMyApplicationForJob,
    getOwnerApplicationsForJob,
    applyForJob,
    cancelJob,
    instantAcceptJob,
    isOwnerApplicationsLoading,
    loadOwnerApplicationsForJob,
    openApplicationChat,
    openJobChat,
    reviewApplicationForOwnedJob,
    threads,
    updateJobStatus,
  } = useAppState();
  const [isOpeningChat, setIsOpeningChat] = useState(false);
  const job = getJobById(jobId);

  if (!job) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>Job not found</Text>
        <AppButton label="Go back" onPress={() => navigation.goBack()} style={styles.inlineButton} />
      </View>
    );
  }

  const currentIndex = jobStatusFlow.indexOf(job.status);
  const canAdvance = currentIndex >= 0 && currentIndex < jobStatusFlow.length - 1;
  const isOwnJob = job.createdBy === currentUser.id;
  const myApplication = getMyApplicationForJob(jobId);
  const ownerApplications = getOwnerApplicationsForJob(jobId);
  const isLoadingOwnerApplications = isOwnerApplicationsLoading(jobId);
  const existingThread = threads.find((thread) => thread.jobId === jobId);

  useEffect(() => {
    if (!isOwnJob) {
      return;
    }

    loadOwnerApplicationsForJob(jobId).catch(() => {});
  }, [isOwnJob, jobId]);

  const handleAdvance = async () => {
    if (!canAdvance) {
      return;
    }

    try {
      await updateJobStatus(job.id, jobStatusFlow[currentIndex + 1]);
    } catch (error) {
      Alert.alert('Update failed', error.message || 'We could not update the job status.');
    }
  };

  const handleCancel = async () => {
    try {
      await cancelJob(job.id);
      Alert.alert('Job cancelled', 'This task has been marked as cancelled.');
    } catch (error) {
      Alert.alert('Cancel failed', error.message || 'We could not cancel this job.');
    }
  };

  const handleMessageRequester = async () => {
    setIsOpeningChat(true);

    try {
      const thread = await openJobChat(job.id);

      if (!thread) {
        return;
      }

      navigation.navigate(ROOT_ROUTES.MAIN_TABS, {
        params: {
          openThreadId: thread.id,
          openThreadName: thread.participant.name,
          openThreadNonce: Date.now(),
        },
        screen: TAB_ROUTES.MESSAGES,
      });
    } catch (error) {
      Alert.alert('Chat unavailable', error.message || 'We could not open this conversation.');
    } finally {
      setIsOpeningChat(false);
    }
  };

  const handleReviewApplication = async (applicationId, nextStatus) => {
    try {
      const result = await reviewApplicationForOwnedJob(applicationId, nextStatus);

      if (nextStatus === 'accepted') {
        try {
          const thread = await openApplicationChat(applicationId);

          if (thread) {
            navigation.navigate(ROOT_ROUTES.MAIN_TABS, {
              params: {
                openThreadId: thread.id,
                openThreadName: thread.participant.name,
                openThreadNonce: Date.now(),
              },
              screen: TAB_ROUTES.MESSAGES,
            });
            return;
          }
        } catch (chatError) {
          Alert.alert(
            'Applicant accepted',
            chatError.message || 'The job was assigned, but we could not open chat yet.'
          );
          return;
        }
      }

      Alert.alert(
        nextStatus === 'accepted' ? 'Applicant accepted' : 'Applicant rejected',
        nextStatus === 'accepted'
          ? `The job is now assigned to ${result.application.applicantId ? 'this student' : 'the student'}.`
          : 'This application has been declined.'
      );
    } catch (error) {
      Alert.alert(
        'Review failed',
        error.message || 'We could not update this application right now.'
      );
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.container}>
      {job.imageUrls?.length ? (
        <ScrollView
          contentContainerStyle={styles.galleryRow}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {job.imageUrls.map((imageUrl) => (
            <Image key={imageUrl} source={{ uri: imageUrl }} style={styles.galleryImage} />
          ))}
        </ScrollView>
      ) : null}

      <AppCard style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View>
            <Text style={styles.category}>{job.category}</Text>
            <Text style={styles.title}>{job.title}</Text>
          </View>
          <Text style={styles.price}>{formatJobPrice(job.price)}</Text>
        </View>
        <Text style={styles.description}>{job.description}</Text>
        <View style={styles.metaBlock}>
          <Text style={styles.metaText}>Address: {job.location}</Text>
          <Text style={styles.metaText}>
            When: {job.date}, {job.time}
          </Text>
          <Text style={styles.metaText}>Distance: {formatJobDistance(job.distance)} away</Text>
        </View>
      </AppCard>

      <AppCard style={styles.card}>
        <Text style={styles.sectionTitle}>Requester</Text>
        <Text style={styles.requesterName}>{job.requester.name}</Text>
        <Text style={styles.metaText}>
          {job.requester.school} - {job.requester.rating} rating
        </Text>
      </AppCard>

      <AppCard style={styles.card}>
        <Text style={styles.sectionTitle}>Job status</Text>
        <View style={styles.timeline}>
          {jobStatusFlow.map((status, index) => {
            const active = currentIndex >= index;
            return (
              <View key={status} style={styles.timelineItem}>
                <View style={[styles.timelineDot, active && styles.timelineDotActive]} />
                <Text style={[styles.timelineText, active && styles.timelineTextActive]}>
                  {formatJobStatus(status)}
                </Text>
              </View>
            );
          })}
          {job.status === 'cancelled' ? (
            <View style={styles.timelineItem}>
              <View style={[styles.timelineDot, styles.timelineDotCancelled]} />
              <Text style={[styles.timelineText, styles.timelineTextCancelled]}>Cancelled</Text>
            </View>
          ) : null}
        </View>
      </AppCard>

      {isOwnJob ? (
        <AppCard style={styles.card}>
          <Text style={styles.sectionTitle}>Applicants</Text>
          {isLoadingOwnerApplications ? (
            <Text style={styles.metaText}>Loading applicants for this job...</Text>
          ) : applicationsNotice ? (
            <Text style={styles.metaText}>{applicationsNotice}</Text>
          ) : ownerApplications.length ? (
            ownerApplications.map((application) => (
              <ApplicantCard
                application={application}
                canReview={job.status === 'posted' && application.status === 'pending'}
                key={application.id}
                onAccept={() => handleReviewApplication(application.id, 'accepted')}
                onReject={() => handleReviewApplication(application.id, 'rejected')}
              />
            ))
          ) : (
            <Text style={styles.metaText}>
              No one has applied yet. New student applications will appear here.
            </Text>
          )}
        </AppCard>
      ) : null}

      <View style={styles.actionCard}>
        {!isOwnJob ? (
          <>
            <AppButton
              disabled={isOpeningChat}
              label={
                isOpeningChat
                  ? 'Opening chat...'
                  : existingThread
                    ? 'Open conversation'
                    : 'Message requester'
              }
              onPress={handleMessageRequester}
              variant="secondary"
            />
            <Text style={styles.messageHint}>
              {existingThread
                ? 'This opens your conversation inside Messages.'
                : 'Start a conversation with the requester and it will appear in Messages.'}
            </Text>
          </>
        ) : null}

        {!isOwnJob && myApplication?.status === 'pending' ? (
          <AppButton disabled label="Application sent" variant="secondary" />
        ) : null}

        {!isOwnJob && myApplication?.status === 'accepted' ? (
          <AppButton disabled label="You accepted this job" variant="secondary" />
        ) : null}

        {!isOwnJob && job.status === 'posted' && !myApplication ? (
          <>
            <AppButton
              label="Apply for job"
              onPress={async () => {
                try {
                  await applyForJob(job.id);
                } catch (error) {
                  Alert.alert('Apply failed', error.message || 'We could not apply for this job.');
                }
              }}
            />
            {job.instantAccept ? (
              <AppButton
                label="Instant accept"
                onPress={async () => {
                  try {
                    await instantAcceptJob(job.id);
                  } catch (error) {
                    Alert.alert(
                      'Accept failed',
                      error.message || 'We could not instantly accept this job.'
                    );
                  }
                }}
                variant="secondary"
              />
            ) : null}
          </>
        ) : null}

        {isOwnJob && canAdvance && job.status !== 'cancelled' ? (
          <AppButton
            label={`Move to ${formatJobStatus(jobStatusFlow[currentIndex + 1])}`}
            onPress={handleAdvance}
            variant="secondary"
          />
        ) : null}

        {isOwnJob && job.status !== 'completed' && job.status !== 'cancelled' ? (
          <AppButton label="Cancel job" onPress={handleCancel} variant="ghost" />
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  applicantActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  applicantAvatar: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  applicantAvatarText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '800',
  },
  applicantBadge: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  applicantBadgeText: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '800',
  },
  applicantBio: {
    color: colors.secondaryText,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  applicantCard: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  applicantCopy: {
    flex: 1,
  },
  applicantHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  applicantMeta: {
    color: colors.secondaryText,
    fontSize: 12,
    marginTop: 2,
  },
  applicantName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  applicantNameRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  applicantStatus: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  container: {
    backgroundColor: colors.background,
    flex: 1,
  },
  content: {
    gap: spacing.lg,
    padding: spacing.lg,
  },
  heroCard: {
    gap: spacing.md,
    padding: spacing.lg,
  },
  galleryImage: {
    borderRadius: 22,
    height: 220,
    width: 260,
  },
  galleryRow: {
    gap: spacing.md,
    paddingRight: spacing.lg,
  },
  heroHeader: {
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  category: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 31,
    maxWidth: 260,
  },
  price: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
  },
  description: {
    color: colors.secondaryText,
    fontSize: 15,
    lineHeight: 23,
  },
  metaBlock: {
    gap: 6,
  },
  metaText: {
    color: colors.secondaryText,
    fontSize: 14,
  },
  card: {
    gap: spacing.sm,
    padding: spacing.lg,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  requesterName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  timeline: {
    gap: spacing.sm,
  },
  timelineItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  timelineDot: {
    backgroundColor: '#D8D4CB',
    borderRadius: 999,
    height: 12,
    width: 12,
  },
  timelineDotActive: {
    backgroundColor: colors.primary,
  },
  timelineDotCancelled: {
    backgroundColor: colors.danger,
  },
  timelineText: {
    color: colors.subtleText,
    fontSize: 14,
    fontWeight: '600',
  },
  timelineTextActive: {
    color: colors.text,
  },
  timelineTextCancelled: {
    color: colors.danger,
  },
  actionCard: {
    gap: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  emptyState: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    gap: spacing.md,
    justifyContent: 'center',
  },
  flexButton: {
    flex: 1,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  inlineButton: {
    minWidth: 120,
  },
  messageHint: {
    color: colors.subtleText,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
});
