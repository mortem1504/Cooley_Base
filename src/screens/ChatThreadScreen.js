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
import useAppState from '../hooks/useAppState';
import { formatMessageTimestamp } from '../utils/chatFormatters';
import { colors, radius, spacing } from '../utils/theme';

const EMOJI_SHORTCUTS = [
  '\u{1F44D}',
  '\u{1F60A}',
  '\u{1F64F}',
  '\u{1F525}',
  '\u{1F389}',
  '\u{1F602}',
];

export default function ChatThreadScreen({ navigation, route }) {
  const { threadId } = route.params;
  const {
    currentUser,
    getThreadMessagesNotice,
    getMessagesForThread,
    getThreadById,
    isThreadMessagesLoading,
    loadMessagesForThread,
    markThreadRead,
    sendMessage,
  } = useAppState();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
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
      title: thread?.participant.name || 'Chat',
    });
  }, [navigation, thread]);

  if (!thread) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>Conversation not found</Text>
        <AppButton label="Go back" onPress={() => navigation.goBack()} style={styles.inlineButton} />
      </View>
    );
  }

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

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: 'padding', android: 'height' })}
      keyboardVerticalOffset={headerHeight}
      style={styles.container}
    >
      <View style={styles.content}>
        <AppCard style={styles.contextCard}>
          <View style={styles.contextHeader}>
            <View style={styles.contextAvatar}>
              <Text style={styles.contextAvatarText}>{thread.participant.initials}</Text>
            </View>
            <View style={styles.contextCopy}>
              <Text style={styles.contextEyebrow}>
                {thread.listingType === 'job' ? 'Job chat' : 'Rental chat'}
              </Text>
              <Text style={styles.contextTitle}>{thread.listingTitle}</Text>
              <Text style={styles.contextMeta}>
                {thread.participant.school} - {thread.subtitle}
              </Text>
            </View>
          </View>
        </AppCard>

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
              const isCurrentUser = message.senderId === currentUser.id;

              return (
                <View
                  key={message.id}
                  style={[styles.messageRow, isCurrentUser && styles.messageRowCurrentUser]}
                >
                  {!isCurrentUser ? (
                    <View style={styles.messageAvatar}>
                      <Text style={styles.messageAvatarText}>{thread.participant.initials}</Text>
                    </View>
                  ) : null}

                  <View
                    style={[
                      styles.messageBubble,
                      isCurrentUser ? styles.messageBubbleCurrentUser : styles.messageBubbleOther,
                    ]}
                  >
                    <Text
                      style={[
                        styles.messageText,
                        isCurrentUser && styles.messageTextCurrentUser,
                      ]}
                    >
                      {message.text}
                    </Text>
                    <Text
                      style={[
                        styles.messageTime,
                        isCurrentUser && styles.messageTimeCurrentUser,
                      ]}
                    >
                      {formatMessageTimestamp(message.createdAt)}
                    </Text>
                  </View>
                </View>
              );
            })
          ) : (
            <AppCard style={styles.inlineStateCard}>
              <Text style={styles.inlineStateTitle}>No messages yet</Text>
              <Text style={styles.inlineStateText}>
                Start the conversation and your messages will appear here.
              </Text>
            </AppCard>
          )}
        </ScrollView>
      </View>

      <View style={[styles.composerWrap, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
        <ScrollView
          contentContainerStyle={styles.emojiRow}
          horizontal
          keyboardShouldPersistTaps="always"
          showsHorizontalScrollIndicator={false}
        >
          {EMOJI_SHORTCUTS.map((emoji) => (
            <Pressable
              key={emoji}
              onPress={() => handleAppendEmoji(emoji)}
              style={styles.emojiChip}
            >
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
  container: {
    backgroundColor: colors.background,
    flex: 1,
  },
  content: {
    flex: 1,
    gap: spacing.md,
    padding: spacing.lg,
    paddingBottom: 0,
  },
  contextCard: {
    padding: spacing.md,
  },
  contextHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  contextAvatar: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 26,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  contextAvatarText: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '800',
  },
  contextCopy: {
    flex: 1,
    gap: 4,
  },
  contextEyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  contextTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  contextMeta: {
    color: colors.secondaryText,
    fontSize: 13,
  },
  inlineStateCard: {
    gap: spacing.xs,
    padding: spacing.md,
  },
  inlineStateText: {
    color: colors.secondaryText,
    fontSize: 14,
    lineHeight: 21,
  },
  inlineStateTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  messagesScroll: {
    flex: 1,
  },
  messagesContent: {
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
  messageRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 10,
    maxWidth: '90%',
  },
  messageRowCurrentUser: {
    alignSelf: 'flex-end',
    justifyContent: 'flex-end',
  },
  messageAvatar: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  messageAvatarText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  messageBubble: {
    borderRadius: radius.lg,
    maxWidth: '100%',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  messageBubbleOther: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
  },
  messageBubbleCurrentUser: {
    backgroundColor: colors.primary,
  },
  messageText: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  messageTextCurrentUser: {
    color: colors.card,
  },
  messageTime: {
    color: colors.subtleText,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 8,
  },
  messageTimeCurrentUser: {
    color: '#DDEBFF',
  },
  composerWrap: {
    backgroundColor: colors.background,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  emojiRow: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  emojiChip: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  emojiText: {
    fontSize: 20,
  },
  composerRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  composerInput: {
    backgroundColor: colors.card,
    flex: 1,
    maxHeight: 112,
    minHeight: 52,
    paddingTop: 14,
  },
  sendButton: {
    minWidth: 88,
  },
  emptyState: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    gap: spacing.md,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  inlineButton: {
    minWidth: 120,
  },
});
