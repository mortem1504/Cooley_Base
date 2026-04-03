import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import AppCard from '../components/AppCard';
import AppTextInput from '../components/AppTextInput';
import useAppState from '../hooks/useAppState';
import useScreenTopInset from '../hooks/useScreenTopInset';
import { ROOT_ROUTES } from '../navigation/routes';
import { formatThreadTimestamp } from '../utils/chatFormatters';
import { colors, radius, spacing } from '../utils/theme';

function ThreadCard({ onPress, thread }) {
  const unreadLabel = thread.unreadCount > 9 ? '9+' : `${thread.unreadCount}`;

  return (
    <Pressable onPress={onPress}>
      <AppCard style={styles.threadCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{thread.participant.initials}</Text>
        </View>

        <View style={styles.threadBody}>
          <View style={styles.threadHeader}>
            <View style={styles.nameWrap}>
              <Text style={styles.threadName}>{thread.participant.name}</Text>
              {thread.participant.verified ? (
                <View style={styles.verifiedPill}>
                  <Text style={styles.verifiedText}>Verified</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.threadTime}>{formatThreadTimestamp(thread.updatedAt)}</Text>
          </View>

          <View style={styles.metaRow}>
            <View style={styles.typePill}>
              <Text style={styles.typePillText}>
                {thread.listingType === 'job' ? 'Job' : 'Rental'}
              </Text>
            </View>
            <Text numberOfLines={1} style={styles.threadListing}>
              {thread.listingTitle}
            </Text>
          </View>

          <View style={styles.previewRow}>
            <Text numberOfLines={1} style={styles.previewText}>
              {thread.preview}
            </Text>
            {thread.unreadCount ? (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{unreadLabel}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </AppCard>
    </Pressable>
  );
}

export default function MessagesScreen({ navigation, route }) {
  const { isThreadsLoading, threads, threadsNotice, unreadThreadCount } = useAppState();
  const topInset = useScreenTopInset(spacing.lg);
  const [query, setQuery] = useState('');
  const handledOpenThreadNonceRef = useRef(null);

  useEffect(() => {
    const openThreadId = route?.params?.openThreadId;
    const openThreadName = route?.params?.openThreadName;
    const openThreadNonce = route?.params?.openThreadNonce;

    if (!openThreadId || !openThreadNonce || handledOpenThreadNonceRef.current === openThreadNonce) {
      return;
    }

    handledOpenThreadNonceRef.current = openThreadNonce;

    navigation.navigate(ROOT_ROUTES.CHAT_THREAD, {
      threadId: openThreadId,
      threadName: openThreadName || 'Chat',
    });

    navigation.setParams({
      openThreadId: undefined,
      openThreadName: undefined,
      openThreadNonce: undefined,
    });
  }, [
    navigation,
    route?.params?.openThreadId,
    route?.params?.openThreadName,
    route?.params?.openThreadNonce,
  ]);

  const filteredThreads = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return threads;
    }

    return threads.filter((thread) => {
      const target = `${thread.participant.name} ${thread.listingTitle} ${thread.preview} ${thread.listingType}`.toLowerCase();
      return target.includes(normalizedQuery);
    });
  }, [query, threads]);

  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingTop: topInset }]} style={styles.container}>
      <AppCard style={styles.heroCard}>
        <Text style={styles.eyebrow}>Messages</Text>
        <Text style={styles.heading}>Keep every job and rental conversation in one place.</Text>
        <Text style={styles.subheading}>
          {unreadThreadCount
            ? `You have ${unreadThreadCount} unread conversation${unreadThreadCount > 1 ? 's' : ''}.`
            : 'Catch up with requesters, renters, and nearby students.'}
        </Text>
        <AppTextInput
          onChangeText={setQuery}
          placeholder="Search people, jobs, or rentals"
          value={query}
        />
      </AppCard>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent chats</Text>
        <Text style={styles.sectionCount}>{filteredThreads.length}</Text>
      </View>

      {threadsNotice && !filteredThreads.length ? (
        <AppCard style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Could not load conversations</Text>
          <Text style={styles.emptyText}>{threadsNotice}</Text>
        </AppCard>
      ) : isThreadsLoading ? (
        <AppCard style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Loading conversations</Text>
          <Text style={styles.emptyText}>Pulling your latest threads from Supabase.</Text>
        </AppCard>
      ) : filteredThreads.length ? (
        <>
          {threadsNotice ? (
            <AppCard style={styles.warningState}>
              <Text style={styles.warningTitle}>Some chat data may be stale</Text>
              <Text style={styles.warningText}>{threadsNotice}</Text>
            </AppCard>
          ) : null}
          {filteredThreads.map((thread) => (
            <ThreadCard
              key={thread.id}
              onPress={() =>
                navigation.navigate(ROOT_ROUTES.CHAT_THREAD, {
                  threadId: thread.id,
                  threadName: thread.participant.name,
                })
              }
              thread={thread}
            />
          ))}
        </>
      ) : (
        <AppCard style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No conversations found</Text>
          <Text style={styles.emptyText}>
            Try a different search or open a job to start chatting with a requester.
          </Text>
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
    paddingBottom: spacing.xxl,
  },
  heroCard: {
    gap: spacing.sm,
    padding: spacing.lg,
  },
  eyebrow: {
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
  sectionCount: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  threadCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  avatarText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '800',
  },
  threadBody: {
    flex: 1,
    gap: 8,
  },
  threadHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  nameWrap: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 1,
    gap: 8,
  },
  threadName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  verifiedPill: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  verifiedText: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '800',
  },
  threadTime: {
    color: colors.subtleText,
    fontSize: 12,
    fontWeight: '700',
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  typePill: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  typePillText: {
    color: colors.secondaryText,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  threadListing: {
    color: colors.secondaryText,
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  previewRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  previewText: {
    color: colors.secondaryText,
    flex: 1,
    fontSize: 13,
  },
  unreadBadge: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    justifyContent: 'center',
    minWidth: 24,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  unreadText: {
    color: colors.card,
    fontSize: 11,
    fontWeight: '800',
  },
  emptyState: {
    gap: 8,
    padding: spacing.lg,
  },
  warningState: {
    gap: 8,
    padding: spacing.lg,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  emptyText: {
    color: colors.secondaryText,
    fontSize: 14,
    lineHeight: 21,
  },
  warningTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  warningText: {
    color: colors.secondaryText,
    fontSize: 14,
    lineHeight: 21,
  },
});
