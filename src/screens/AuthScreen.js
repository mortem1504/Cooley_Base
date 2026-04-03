import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AppButton from '../components/AppButton';
import AppCard from '../components/AppCard';
import AppTextInput from '../components/AppTextInput';
import useAppState from '../hooks/useAppState';
import useScreenTopInset from '../hooks/useScreenTopInset';
import { authHighlights } from '../services/authService';
import { colors, radius, spacing } from '../utils/theme';

export default function AuthScreen() {
  const { authMode, authNotice, isAuthLoading, setAuthMode, login, signup } = useAppState();
  const topInset = useScreenTopInset(spacing.lg);
  const [name, setName] = useState('Minji Park');
  const [email, setEmail] = useState('minji@campus.edu');
  const [password, setPassword] = useState('password');
  const [bio, setBio] = useState('Reliable student for quick campus help and last-minute errands.');
  const [feedback, setFeedback] = useState('');
  const [feedbackTone, setFeedbackTone] = useState('muted');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isSignup = authMode === 'signup';
  const buttonLabel = isSubmitting
    ? isSignup
      ? 'Creating account...'
      : 'Signing in...'
    : isSignup
      ? 'Create account'
      : 'Enter app';

  useEffect(() => {
    if (!authNotice) {
      return;
    }

    setFeedback(authNotice);
    setFeedbackTone('error');
  }, [authNotice]);

  const handleSubmit = async () => {
    setFeedback('');
    setFeedbackTone('muted');
    setIsSubmitting(true);

    let result;

    if (isSignup) {
      result = await signup({ name, email, password, bio });
    } else {
      result = await login({ email, password });
    }

    setIsSubmitting(false);

    if (!result?.ok) {
      setFeedback(result?.error || 'Something went wrong while connecting your account.');
      setFeedbackTone('error');
      return;
    }

    if (result?.message) {
      setFeedback(result.message);
      setFeedbackTone('success');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: topInset }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Text style={styles.badge}>Student quick jobs</Text>
          <Text style={styles.title}>Fast local help, powered by nearby students.</Text>
          <Text style={styles.subtitle}>
            Find runner jobs, event shifts, delivery help, and simple campus tasks in a calm,
            trustworthy marketplace.
          </Text>
        </View>

        <View style={styles.highlightColumn}>
          {authHighlights.map((item) => (
            <AppCard key={item.label} style={styles.highlightCard}>
              <Text style={styles.highlightLabel}>{item.label}</Text>
              <Text style={styles.highlightValue}>{item.value}</Text>
            </AppCard>
          ))}
        </View>

        <AppCard style={styles.formCard}>
          <View style={styles.modeSwitch}>
            <Pressable
              onPress={() => setAuthMode('login')}
              style={[styles.modeButton, !isSignup && styles.modeButtonActive]}
            >
              <Text style={[styles.modeText, !isSignup && styles.modeTextActive]}>Log in</Text>
            </Pressable>
            <Pressable
              onPress={() => setAuthMode('signup')}
              style={[styles.modeButton, isSignup && styles.modeButtonActive]}
            >
              <Text style={[styles.modeText, isSignup && styles.modeTextActive]}>Sign up</Text>
            </Pressable>
          </View>

          <Text style={styles.sectionTitle}>Simple onboarding</Text>
          <Text style={styles.sectionSubtitle}>
            Create your student profile, add your strengths, and start browsing nearby quick jobs.
          </Text>

          <AppTextInput onChangeText={setName} placeholder="Full name" value={name} />
          <AppTextInput
            autoCapitalize="none"
            onChangeText={setEmail}
            placeholder="Campus email"
            value={email}
          />
          {isSignup ? (
            <AppTextInput
              multiline
              onChangeText={setBio}
              placeholder="Short bio"
              style={styles.bioInput}
              value={bio}
            />
          ) : null}
          <AppTextInput
            autoCapitalize="none"
            onChangeText={setPassword}
            placeholder="Password"
            secureTextEntry
            value={password}
          />

          {feedback ? (
            <Text
              style={[
                styles.feedbackText,
                feedbackTone === 'error' ? styles.feedbackError : styles.feedbackSuccess,
              ]}
            >
              {feedback}
            </Text>
          ) : null}

          <AppButton
            disabled={isSubmitting || isAuthLoading}
            label={buttonLabel}
            onPress={handleSubmit}
          />

          <Text style={styles.footnote}>
            Student verification is shown as a blue badge after onboarding.
          </Text>
        </AppCard>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
  },
  content: {
    gap: spacing.xl,
    padding: spacing.xl,
  },
  hero: {
    gap: spacing.sm,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  title: {
    color: colors.text,
    fontSize: 34,
    fontWeight: '800',
    lineHeight: 40,
  },
  subtitle: {
    color: colors.secondaryText,
    fontSize: 15,
    lineHeight: 23,
  },
  highlightColumn: {
    gap: spacing.md,
  },
  highlightCard: {
    padding: spacing.lg,
  },
  highlightLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  highlightValue: {
    color: colors.secondaryText,
    fontSize: 14,
    lineHeight: 21,
  },
  formCard: {
    gap: spacing.md,
    padding: spacing.lg,
  },
  modeSwitch: {
    backgroundColor: colors.background,
    borderRadius: radius.pill,
    flexDirection: 'row',
    padding: 4,
  },
  modeButton: {
    alignItems: 'center',
    borderRadius: radius.pill,
    flex: 1,
    paddingVertical: 12,
  },
  modeButtonActive: {
    backgroundColor: colors.card,
  },
  modeText: {
    color: colors.subtleText,
    fontWeight: '700',
  },
  modeTextActive: {
    color: colors.text,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  sectionSubtitle: {
    color: colors.secondaryText,
    fontSize: 14,
    lineHeight: 21,
  },
  bioInput: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  footnote: {
    color: colors.subtleText,
    fontSize: 12,
    lineHeight: 18,
  },
  feedbackText: {
    borderRadius: radius.md,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  feedbackError: {
    backgroundColor: '#FDECEC',
    color: colors.danger,
  },
  feedbackSuccess: {
    backgroundColor: '#EAF2FF',
    color: colors.primary,
  },
});
