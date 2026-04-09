import React, { useEffect, useRef, useState } from 'react';
import { useHeaderHeight } from '@react-navigation/elements';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppButton from '../components/AppButton';
import AppCard from '../components/AppCard';
import AppTextInput from '../components/AppTextInput';
import UserAvatar from '../components/UserAvatar';
import useAppState from '../hooks/useAppState';
import { ROOT_ROUTES } from '../navigation/routes';
import { formatMessageTimestamp } from '../utils/chatFormatters';
import {
  canLeaveRentalReview,
  formatRentalDateRange,
  formatRentalPrice,
  formatRentalRequestStatus,
} from '../utils/rentalFormatters';
import { colors, radius, spacing } from '../utils/theme';

const EMOJI_SHORTCUTS = ['\u{1F44D}', '\u{1F60A}', '\u{1F64F}', '\u{1F525}', '\u{1F389}', '\u{1F602}'];

function EventMessageCard({ currentUserId, message, participantName }) {
  const metadata = message.metadata || {};
  const isCurrentUser = message.senderId === currentUserId;
  const actorLabel = isCurrentUser ? 'You' : participantName || 'Other student';

  if (message.kind === 'review') {
    const rating = Math.max(0, Math.min(5, Number(metadata.rating) || 0));
    const stars = Array.from({ length: 5 }, (_, index) =>
      index < rating ? '\u2605' : '\u2606'
    ).join('');

    return (
      <View style={styles.eventWrap}>
        <AppCard style={styles.eventCard}>
          <Text style={styles.eventTitle}>{actorLabel} left a review</Text>
          <Text style={styles.reviewStars}>{stars || 'Review'}</Text>
          {metadata.comment ? <Text style={styles.eventBody}>{metadata.comment}</Text> : null}
          <Text style={styles.eventTime}>{formatMessageTimestamp(message.createdAt)}</Text>
        </AppCard>
      </View>
    );
  }

  if (message.kind === 'rental_request') {
    return (
      <View style={styles.eventWrap}>
        <AppCard style={styles.eventCard}>
          <Text style={styles.eventTitle}>{actorLabel} sent a rental request</Text>
          <Text style={styles.eventBody}>
            {formatRentalDateRange(metadata.startDate, metadata.endDate)} - {formatRentalPrice(metadata.totalPrice)}
          </Text>
          {metadata.note ? <Text style={styles.eventBody}>{metadata.note}</Text> : null}
          <Text style={styles.eventTime}>{formatMessageTimestamp(message.createdAt)}</Text>
        </AppCard>
      </View>
    );
  }

  return (
    <View style={styles.eventWrap}>
      <AppCard style={styles.eventCard}>
        <Text style={styles.eventTitle}>Booking update</Text>
        <Text style={styles.eventBody}>{message.text || 'Conversation updated'}</Text>
        <Text style={styles.eventTime}>{formatMessageTimestamp(message.createdAt)}</Text>
      </AppCard>
    </View>
  );
}

function ReviewComposer({ comment, onCancel, onCommentChange, onRatingChange, onSubmit, rating, submitting }) {
  return (
    <AppCard style={styles.reviewComposer}>
      <Text style={styles.reviewComposerTitle}>Leave review</Text>
      <View style={styles.starRow}>
        {[1, 2, 3, 4, 5].map((value) => (
          <Pressable key={value} onPress={() => onRatingChange(value)} style={styles.starPressable}>
            <Text style={[styles.starText, value <= rating && styles.starTextActive]}>
              {value <= rating ? '\u2605' : '\u2606'}
            </Text>
          </Pressable>
        ))}
      </View>
      <AppTextInput
        multiline
        onChangeText={onCommentChange}
        placeholder="Share a short note about the rental"
        style={styles.reviewInput}
        value={comment}
      />
      <View style={styles.inlineRow}>
        <AppButton label="Cancel" onPress={onCancel} style={styles.flexButton} variant="secondary" />
        <AppButton
          disabled={submitting || !rating}
          label={submitting ? 'Submitting...' : 'Submit review'}
          onPress={onSubmit}
          style={styles.flexButton}
        />
      </View>
    </AppCard>
  );
}

function BookingHeaderCard({
  booking,
  bookingNotice,
  currentUserId,
  loading,
  onAccept,
  onAdvanceToCompleted,
  onAdvanceToOngoing,
  onReject,
  updating,
}) {
  if (loading) {
    return (
      <AppCard style={styles.contextCard}>
        <Text style={styles.inlineStateTitle}>Loading booking</Text>
        <Text style={styles.inlineStateText}>Pulling the latest rental details.</Text>
      </AppCard>
    );
  }

  if (!booking) {
    return bookingNotice ? (
      <AppCard style={styles.contextCard}>
        <Text style={styles.inlineStateTitle}>Rental booking</Text>
        <Text style={styles.inlineStateText}>{bookingNotice}</Text>
      </AppCard>
    ) : null;
  }

  const isOwnerView = booking.ownerId === currentUserId;

  return (
    <AppCard style={styles.contextCard}>
      <View style={styles.bookingHeader}>
        <View style={styles.flexButton}>
          <Text style={styles.contextEyebrow}>Rental booking</Text>
          <Text style={styles.contextTitle}>{formatRentalRequestStatus(booking.status)}</Text>
          <Text style={styles.contextMeta}>
            {formatRentalDateRange(booking.startDate, booking.endDate)} - {formatRentalPrice(booking.totalPrice)}
          </Text>
        </View>
        <View style={styles.statusChip}>
          <Text style={styles.statusChipText}>{formatRentalRequestStatus(booking.status)}</Text>
        </View>
      </View>

      <Text style={styles.inlineStateText}>{booking.renter.name}</Text>
      {booking.note ? <Text style={styles.inlineStateText}>{booking.note}</Text> : null}

      {isOwnerView && booking.status === 'requested' ? (
        <View style={styles.inlineRow}>
          <AppButton
            disabled={updating}
            label={updating ? 'Updating...' : 'Accept'}
            onPress={onAccept}
            style={styles.flexButton}
          />
          <AppButton
            disabled={updating}
            label="Reject"
            onPress={onReject}
            style={styles.flexButton}
            variant="secondary"
          />
        </View>
      ) : null}

      {isOwnerView && booking.status === 'accepted' ? (
        <AppButton
          disabled={updating}
          label={updating ? 'Updating...' : 'Mark Ongoing'}
          onPress={onAdvanceToOngoing}
        />
      ) : null}

      {isOwnerView && booking.status === 'ongoing' ? (
        <AppButton
          disabled={updating}
          label={updating ? 'Updating...' : 'Mark Completed'}
          onPress={onAdvanceToCompleted}
        />
      ) : null}
    </AppCard>
  );
}

export default function ChatThreadScreen({ navigation, route }) {
  const { threadId } = route.params;
  const {
    currentUser,
    getMessagesForThread,
    getThreadById,
    getThreadMessagesNotice,
    isThreadMessagesLoading,
    loadMessagesForThread,
    loadRentalRequestForThread,
    markThreadRead,
    reviewRentalBooking,
    sendMessage,
    submitRentalReviewForRequest,
    updateRentalBookingStage,
  } = useAppState();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const inputRef = useRef(null);
  const scrollRef = useRef(null);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [booking, setBooking] = useState(null);
  const [bookingNotice, setBookingNotice] = useState('');
  const [isBookingLoading, setIsBookingLoading] = useState(false);
  const [isBookingUpdating, setIsBookingUpdating] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [showReviewComposer, setShowReviewComposer] = useState(false);
  const thread = getThreadById(threadId);
  const messages = getMessagesForThread(threadId);
  const isLoadingMessages = isThreadMessagesLoading(threadId);
  const threadNotice = getThreadMessagesNotice(threadId);

  useEffect(() => {
    loadMessagesForThread(threadId).catch(() => {});
    markThreadRead(threadId);
  }, [threadId]);

  useEffect(() => {
    navigation.setOptions({
      title: thread?.participant?.name || 'Chat',
    });
  }, [navigation, thread?.participant?.name]);

  useEffect(() => {
    let isActive = true;

    async function hydrateBooking() {
      if (thread?.listingType !== 'rental') {
        if (isActive) {
          setBooking(null);
          setBookingNotice('');
          setIsBookingLoading(false);
        }
        return;
      }

      setIsBookingLoading(true);

      try {
        const nextBooking = await loadRentalRequestForThread(threadId);

        if (!isActive) {
          return;
        }

        setBooking(nextBooking);
        setBookingNotice('');
      } catch (error) {
        if (!isActive) {
          return;
        }

        setBooking(null);
        setBookingNotice(error.message);
      } finally {
        if (isActive) {
          setIsBookingLoading(false);
        }
      }
    }

    hydrateBooking();

    return () => {
      isActive = false;
    };
  }, [thread?.listingType, thread?.updatedAt, threadId]);

  const participantName = thread?.participant?.name || 'Student User';
  const reviewOpen = canLeaveRentalReview(booking, currentUser?.id);

  useEffect(() => {
    if (!reviewOpen && showReviewComposer) {
      setShowReviewComposer(false);
    }
  }, [reviewOpen, showReviewComposer]);

  if (!thread) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>Conversation not found</Text>
        <AppButton label="Go back" onPress={() => navigation.goBack()} style={styles.inlineButton} />
      </View>
    );
  }

  const refreshBooking = async () => {
    if (thread.listingType !== 'rental') {
      return null;
    }

    const nextBooking = await loadRentalRequestForThread(threadId);
    setBooking(nextBooking);
    setBookingNotice('');
    return nextBooking;
  };

  const handleSend = async () => {
    if (!draft.trim()) {
      return;
    }

    setIsSending(true);

    try {
      await sendMessage(threadId, draft);
      setDraft('');
    } catch (error) {
      Alert.alert('Message failed', error.message || 'We could not send your message.');
    } finally {
      setIsSending(false);
    }
  };

  const handleAppendEmoji = (emoji) => {
    setDraft((prev) => `${prev}${emoji}`);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const handleOpenListingDetails = () => {
    if (!thread?.listingId) {
      return;
    }

    navigation.navigate(ROOT_ROUTES.JOB_DETAIL, {
      jobId: thread.listingId,
    });
  };

  const handleOpenParticipantProfile = () => {
    if (!thread?.participant?.id) {
      return;
    }

    navigation.navigate(ROOT_ROUTES.USER_PROFILE, {
      userId: thread.participant.id,
    });
  };

  const handleUpdateBooking = async (action) => {
    if (!booking) {
      return;
    }

    setIsBookingUpdating(true);

    try {
      if (action === 'accepted' || action === 'rejected') {
        await reviewRentalBooking(booking.id, action);
      } else {
        await updateRentalBookingStage(booking.id, action);
      }

      await refreshBooking();
    } catch (error) {
      Alert.alert('Update failed', error.message || 'We could not update this rental flow.');
    } finally {
      setIsBookingUpdating(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!booking || !reviewRating) {
      return;
    }

    setIsSubmittingReview(true);

    try {
      await submitRentalReviewForRequest({
        requestId: booking.id,
        rating: reviewRating,
        comment: reviewComment,
      });

      await refreshBooking();
      setReviewComment('');
      setReviewRating(0);
      setShowReviewComposer(false);
    } catch (error) {
      Alert.alert('Review failed', error.message || 'We could not submit your review.');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: 'padding', android: 'height' })}
      keyboardVerticalOffset={headerHeight}
      style={styles.container}
    >
      <View style={styles.content}>
        <AppCard style={styles.contextCard}>
          <Text style={styles.contextEyebrow}>{thread.listingType === 'job' ? 'Job chat' : 'Rental chat'}</Text>
          <Text style={styles.contextTitle}>{thread.listingTitle}</Text>
          <View style={styles.contextPersonRow}>
            <UserAvatar
              avatarUrl={thread.participant.avatarUrl}
              initials={thread.participant.initials}
              name={thread.participant.name}
              onPress={handleOpenParticipantProfile}
              size={42}
            />
            <View style={styles.contextPersonCopy}>
              <Pressable onPress={handleOpenParticipantProfile}>
                <Text style={styles.contextPersonName}>{thread.participant.name}</Text>
              </Pressable>
              <Text style={styles.contextMeta}>{thread.subtitle}</Text>
            </View>
          </View>
          {thread.listingId ? (
            <Pressable onPress={handleOpenListingDetails} style={styles.contextActionRow}>
                <Text style={styles.contextActionText}>View listing details</Text>
                <Text style={styles.contextActionHint}>Tap to open</Text>
            </Pressable>
          ) : null}
        </AppCard>

        {thread.listingType === 'rental' ? (
          <BookingHeaderCard
            booking={booking}
            bookingNotice={bookingNotice}
            currentUserId={currentUser.id}
            loading={isBookingLoading}
            onAccept={() => handleUpdateBooking('accepted')}
            onAdvanceToCompleted={() => handleUpdateBooking('completed')}
            onAdvanceToOngoing={() => handleUpdateBooking('ongoing')}
            onReject={() => handleUpdateBooking('rejected')}
            updating={isBookingUpdating}
          />
        ) : null}

        <ScrollView
          contentContainerStyle={styles.messagesContent}
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          style={styles.messagesScroll}
        >
          {isLoadingMessages ? (
            <AppCard style={styles.inlineStateCard}>
              <Text style={styles.inlineStateTitle}>Loading messages</Text>
              <Text style={styles.inlineStateText}>Pulling this conversation from Supabase.</Text>
            </AppCard>
          ) : threadNotice && !messages.length ? (
            <AppCard style={styles.inlineStateCard}>
              <Text style={styles.inlineStateTitle}>Could not load messages</Text>
              <Text style={styles.inlineStateText}>{threadNotice}</Text>
            </AppCard>
          ) : messages.length ? (
            messages.map((message) => {
              if (message.kind !== 'text') {
                return (
                  <EventMessageCard
                    currentUserId={currentUser.id}
                    key={message.id}
                    message={message}
                    participantName={participantName}
                  />
                );
              }

              const isCurrentUser = message.senderId === currentUser.id;

              return (
                <View key={message.id} style={[styles.messageRow, isCurrentUser && styles.messageRowCurrentUser]}>
                  <View
                    style={[
                      styles.messageBubble,
                      isCurrentUser ? styles.messageBubbleCurrentUser : styles.messageBubbleOther,
                    ]}
                  >
                    <Text style={[styles.messageText, isCurrentUser && styles.messageTextCurrentUser]}>
                      {message.text}
                    </Text>
                    <Text style={[styles.messageTime, isCurrentUser && styles.messageTimeCurrentUser]}>
                      {formatMessageTimestamp(message.createdAt)}
                    </Text>
                  </View>
                </View>
              );
            })
          ) : (
            <AppCard style={styles.inlineStateCard}>
              <Text style={styles.inlineStateTitle}>No messages yet</Text>
              <Text style={styles.inlineStateText}>Start the conversation and your messages will appear here.</Text>
            </AppCard>
          )}
        </ScrollView>
      </View>

      {reviewOpen && !showReviewComposer ? (
        <View style={styles.reviewCtaWrap}>
          <AppButton label="Leave Review" onPress={() => setShowReviewComposer(true)} variant="secondary" />
        </View>
      ) : null}

      {reviewOpen && showReviewComposer ? (
        <View style={styles.reviewCtaWrap}>
          <ReviewComposer
            comment={reviewComment}
            onCancel={() => setShowReviewComposer(false)}
            onCommentChange={setReviewComment}
            onRatingChange={setReviewRating}
            onSubmit={handleSubmitReview}
            rating={reviewRating}
            submitting={isSubmittingReview}
          />
        </View>
      ) : null}

      <View style={[styles.composerWrap, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
        <ScrollView contentContainerStyle={styles.emojiRow} horizontal keyboardShouldPersistTaps="always" showsHorizontalScrollIndicator={false}>
          {EMOJI_SHORTCUTS.map((emoji) => (
            <Pressable key={emoji} onPress={() => handleAppendEmoji(emoji)} style={styles.emojiChip}>
              <Text style={styles.emojiText}>{emoji}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.composerRow}>
          <AppTextInput
            ref={inputRef}
            multiline
            onChangeText={setDraft}
            placeholder="Write a message"
            style={styles.composerInput}
            value={draft}
          />
          <AppButton
            disabled={isSending || !draft.trim()}
            label={isSending ? 'Sending...' : 'Send'}
            onPress={handleSend}
            style={styles.sendButton}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.background, flex: 1 },
  content: { flex: 1, gap: spacing.md, padding: spacing.lg, paddingBottom: 0 },
  contextCard: { gap: spacing.xs, padding: spacing.md },
  contextEyebrow: { color: colors.primary, fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  contextPersonCopy: { flex: 1 },
  contextPersonName: { color: colors.text, fontSize: 14, fontWeight: '800' },
  contextPersonRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  contextTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  contextMeta: { color: colors.secondaryText, fontSize: 13 },
  contextActionRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs },
  contextActionText: { color: colors.primary, fontSize: 13, fontWeight: '800' },
  contextActionHint: { color: colors.subtleText, fontSize: 12, fontWeight: '700' },
  bookingHeader: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' },
  statusChip: { backgroundColor: colors.primarySoft, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6 },
  statusChipText: { color: colors.primary, fontSize: 12, fontWeight: '800' },
  messagesScroll: { flex: 1 },
  messagesContent: { gap: spacing.md, paddingBottom: spacing.lg },
  messageRow: { maxWidth: '90%' },
  messageRowCurrentUser: { alignSelf: 'flex-end' },
  messageBubble: { borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 12 },
  messageBubbleOther: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 },
  messageBubbleCurrentUser: { backgroundColor: colors.primary },
  messageText: { color: colors.text, fontSize: 15, lineHeight: 22 },
  messageTextCurrentUser: { color: colors.card },
  messageTime: { color: colors.subtleText, fontSize: 11, fontWeight: '700', marginTop: 8 },
  messageTimeCurrentUser: { color: '#DDEBFF' },
  eventWrap: { alignSelf: 'stretch' },
  eventCard: { gap: spacing.xs, padding: spacing.md },
  eventTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  eventBody: { color: colors.secondaryText, fontSize: 13, lineHeight: 20 },
  eventTime: { color: colors.subtleText, fontSize: 11, fontWeight: '700' },
  reviewStars: { color: '#E0A100', fontSize: 18, letterSpacing: 2 },
  inlineStateCard: { gap: spacing.xs, padding: spacing.md },
  inlineStateTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  inlineStateText: { color: colors.secondaryText, fontSize: 14, lineHeight: 21 },
  reviewCtaWrap: { backgroundColor: colors.background, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  reviewComposer: { gap: spacing.sm, padding: spacing.md },
  reviewComposerTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  reviewInput: { minHeight: 96, textAlignVertical: 'top' },
  inlineRow: { flexDirection: 'row', gap: spacing.sm },
  flexButton: { flex: 1 },
  starRow: { flexDirection: 'row', gap: spacing.xs },
  starPressable: { paddingVertical: 4 },
  starText: { color: colors.subtleText, fontSize: 28 },
  starTextActive: { color: '#E0A100' },
  composerWrap: { backgroundColor: colors.background, borderTopColor: colors.border, borderTopWidth: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  emojiRow: { gap: spacing.sm, paddingBottom: spacing.sm },
  emojiChip: { alignItems: 'center', backgroundColor: colors.card, borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, height: 40, justifyContent: 'center', paddingHorizontal: 14 },
  emojiText: { fontSize: 20 },
  composerRow: { alignItems: 'flex-end', flexDirection: 'row', gap: spacing.sm },
  composerInput: { backgroundColor: colors.card, flex: 1, maxHeight: 112, minHeight: 52, paddingTop: 14 },
  sendButton: { minWidth: 88 },
  emptyState: { alignItems: 'center', backgroundColor: colors.background, flex: 1, gap: spacing.md, justifyContent: 'center', padding: spacing.lg },
  emptyTitle: { color: colors.text, fontSize: 20, fontWeight: '800' },
  inlineButton: { minWidth: 120 },
});
