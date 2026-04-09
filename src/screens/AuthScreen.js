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
import { colors, radius, spacing } from '../utils/theme';

export default function AuthScreen() {
  const { authMode, authNotice, isAuthLoading, setAuthMode, login, signup } = useAppState();
  const topInset = useScreenTopInset(spacing.lg);
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [bio, setBio] = useState('');
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

    if (isSignup) {
      if (!name.trim() || !username.trim() || !email.trim() || !password.trim()) {
        setFeedback('Fill in your full name, username, email, and password to create an account.');
        setFeedbackTone('error');
        return;
      }
    } else if (!loginIdentifier.trim() || !password.trim()) {
      setFeedback('Enter your username or email and password to log in.');
      setFeedbackTone('error');
      return;
    }

    setIsSubmitting(true);

    let result;

    if (isSignup) {
      result = await signup({ name, username, email, password, bio });
    } else {
      result = await login({ identifier: loginIdentifier, password });
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

          <Text style={styles.sectionTitle}>{isSignup ? 'Create your account' : 'Welcome back'}</Text>
          <Text style={styles.sectionSubtitle}>
            {isSignup
              ? 'Set up your account to start posting and browsing nearby listings.'
              : 'Log in to continue to your nearby jobs and item listings.'}
          </Text>

          {!isSignup ? (
            <AppTextInput
              autoCapitalize="none"
              onChangeText={setLoginIdentifier}
              placeholder="Username or email"
              value={loginIdentifier}
            />
          ) : null}
          {isSignup ? <AppTextInput onChangeText={setName} placeholder="Full name" value={name} /> : null}
          {isSignup ? (
            <AppTextInput
              autoCapitalize="none"
              onChangeText={setUsername}
              placeholder="Username"
              value={username}
            />
          ) : null}
          {isSignup ? (
            <AppTextInput
              autoCapitalize="none"
              onChangeText={setEmail}
              placeholder="Campus email"
              value={email}
            />
          ) : null}
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
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  formCard: {
    gap: spacing.md,
    alignSelf: 'center',
    padding: spacing.xl,
    width: '100%',
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
    fontSize: 26,
    fontWeight: '800',
  },
  sectionSubtitle: {
    color: colors.secondaryText,
    fontSize: 15,
    lineHeight: 22,
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
