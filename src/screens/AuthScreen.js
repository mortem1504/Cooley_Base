import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import useAppState from '../hooks/useAppState';
import useScreenTopInset from '../hooks/useScreenTopInset';
import { radius, spacing } from '../utils/theme';

function AuthField({ label, style, ...props }) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput placeholderTextColor="#6E727C" style={[styles.input, style]} {...props} />
    </View>
  );
}

export default function AuthScreen() {
  const { authMode, authNotice, isAuthLoading, setAuthMode, login, signup, continueWithGoogle } =
    useAppState();
  const topInset = useScreenTopInset(spacing.lg);
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [feedback, setFeedback] = useState('');
  const [feedbackTone, setFeedbackTone] = useState('muted');
  const [activeAction, setActiveAction] = useState('');

  const isSignup = authMode === 'signup';
  const isSubmittingEmail = activeAction === 'email';
  const isSubmittingGoogle = activeAction === 'google';
  const buttonLabel = isSubmittingEmail
    ? isSignup
      ? 'Creating account...'
      : 'Signing in...'
    : 'Continue';

  useEffect(() => {
    if (!authNotice) {
      return;
    }

    setFeedback(authNotice);
    setFeedbackTone('error');
  }, [authNotice]);

  const handleModeChange = (nextMode) => {
    setFeedback('');
    setFeedbackTone('muted');
    setAuthMode(nextMode);
  };

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

    setActiveAction('email');

    let result;

    if (isSignup) {
      result = await signup({ name, username, email, password });
    } else {
      result = await login({ identifier: loginIdentifier, password });
    }

    setActiveAction('');

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

  const handleGoogleContinue = async () => {
    setFeedback('');
    setFeedbackTone('muted');
    setActiveAction('google');

    const result = await continueWithGoogle();

    setActiveAction('');

    if (result?.dismissed) {
      return;
    }

    if (!result?.ok) {
      setFeedback(result?.error || 'Could not continue with Google right now.');
      setFeedbackTone('error');
      return;
    }

    if (result?.message) {
      setFeedback(result.message);
      setFeedbackTone('success');
    }
  };

  return (
    <LinearGradient colors={['#081326', '#09162B', '#05070B']} style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingTop: topInset }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.backdropGlowTop} />
          <View style={styles.backdropGlowBottom} />

          <View style={styles.headerBlock}>
            <View style={styles.brandRow}>
              <View style={styles.brandMark}>
                <View style={[styles.brandStroke, styles.brandStrokeShort]} />
                <View style={[styles.brandStroke, styles.brandStrokeMedium]} />
                <View style={[styles.brandStroke, styles.brandStrokeTall]} />
              </View>
              <Text style={styles.brandText}>Cooley</Text>
            </View>

            <Text style={styles.headerEyebrow}>Student marketplace</Text>
            <Text style={styles.headerSubtitle}>
              Quick jobs, rentals, and trusted student services in one place.
            </Text>
          </View>

          <View style={styles.formCard}>
            <View style={styles.formHeaderRow}>
              <View style={styles.modeSwitch}>
                <Pressable
                  onPress={() => handleModeChange('login')}
                  style={[styles.modeChip, !isSignup && styles.modeChipActive]}
                >
                  <Text style={[styles.modeChipText, !isSignup && styles.modeChipTextActive]}>
                    Log in
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => handleModeChange('signup')}
                  style={[styles.modeChip, isSignup && styles.modeChipActive]}
                >
                  <Text style={[styles.modeChipText, isSignup && styles.modeChipTextActive]}>
                    Sign up
                  </Text>
                </Pressable>
              </View>

              <View style={styles.formHeaderTextBlock}>
                <Text style={styles.sectionTitle}>
                  {isSignup ? 'Create your account' : 'Welcome back'}
                </Text>
                <Text style={styles.sectionSubtitle}>
                  {isSignup
                    ? 'Use your full name, username, email, and password to get started.'
                    : 'Use your username or email and password to continue.'}
                </Text>
              </View>
            </View>

            {!isSignup ? (
              <AuthField
                autoCapitalize="none"
                autoCorrect={false}
                label="Username or email"
                onChangeText={setLoginIdentifier}
                placeholder="Enter your username or email"
                value={loginIdentifier}
              />
            ) : null}
            {isSignup ? (
              <AuthField
                autoCapitalize="words"
                label="Full name"
                onChangeText={setName}
                placeholder="Enter your full name"
                value={name}
              />
            ) : null}
            {isSignup ? (
              <AuthField
                autoCapitalize="none"
                autoCorrect={false}
                label="Username"
                onChangeText={setUsername}
                placeholder="Choose a username"
                value={username}
              />
            ) : null}
            {isSignup ? (
              <AuthField
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                label="Email"
                onChangeText={setEmail}
                placeholder="Enter your email address"
                value={email}
              />
            ) : null}
            <AuthField
              autoCapitalize="none"
              label="Password"
              onChangeText={setPassword}
              onSubmitEditing={handleSubmit}
              placeholder="Enter your password"
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

            <Pressable
              disabled={Boolean(activeAction) || isAuthLoading}
              onPress={handleSubmit}
              style={({ pressed }) => [
                styles.primaryButton,
                (Boolean(activeAction) || isAuthLoading) && styles.buttonDisabled,
                pressed && !activeAction && !isAuthLoading && styles.buttonPressed,
              ]}
            >
              <Text style={styles.primaryButtonText}>{buttonLabel}</Text>
            </Pressable>

            <Text style={styles.switchText}>
              {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
              <Text
                onPress={() => handleModeChange(isSignup ? 'login' : 'signup')}
                style={styles.switchLink}
              >
                {isSignup ? 'Sign in' : 'Sign up'}
              </Text>
            </Text>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <Pressable
              disabled={Boolean(activeAction) || isAuthLoading}
              onPress={handleGoogleContinue}
              style={({ pressed }) => [
                styles.socialButton,
                (Boolean(activeAction) || isAuthLoading) && styles.buttonDisabled,
                pressed && !activeAction && !isAuthLoading && styles.buttonPressed,
              ]}
            >
              <View style={styles.googleBadge}>
                <Text style={styles.googleBadgeText}>G</Text>
              </View>
              <Text style={styles.socialButtonText}>
                {isSubmittingGoogle
                  ? 'Connecting to Google...'
                  : isSignup
                    ? 'Sign up with Google'
                    : 'Sign in with Google'}
              </Text>
            </Pressable>

            <Text style={styles.footnote}>
              Google sign-in works in the Cooley development build or installed app.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#090B0F',
    flex: 1,
  },
  content: {
    flexGrow: 1,
    overflow: 'hidden',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  backdropGlowTop: {
    backgroundColor: 'rgba(52, 120, 255, 0.12)',
    borderRadius: 260,
    height: 260,
    position: 'absolute',
    right: -100,
    top: 20,
    width: 260,
  },
  backdropGlowBottom: {
    backgroundColor: 'rgba(123, 201, 255, 0.08)',
    borderRadius: 260,
    bottom: -10,
    height: 260,
    left: -120,
    position: 'absolute',
    width: 260,
  },
  headerBlock: {
    marginBottom: spacing.xl,
    maxWidth: 420,
    paddingTop: spacing.sm,
  },
  brandRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  brandMark: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
    marginRight: spacing.sm,
  },
  brandStroke: {
    backgroundColor: '#3F72FF',
    borderRadius: radius.pill,
    transform: [{ rotate: '26deg' }],
  },
  brandStrokeShort: {
    height: 16,
    width: 6,
  },
  brandStrokeMedium: {
    height: 22,
    width: 6,
  },
  brandStrokeTall: {
    height: 28,
    width: 6,
  },
  brandText: {
    color: '#F9FAFB',
    fontSize: 30,
    fontWeight: '800',
  },
  headerEyebrow: {
    color: '#8F96A3',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.6,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
  },
  headerSubtitle: {
    color: '#ABB1BC',
    fontSize: 14,
    lineHeight: 22,
    maxWidth: 320,
  },
  formCard: {
    alignSelf: 'center',
    backgroundColor: 'rgba(10, 13, 19, 0.96)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 30,
    borderWidth: 1,
    gap: spacing.md,
    maxWidth: 420,
    padding: spacing.xl,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.28,
    shadowRadius: 30,
    width: '100%',
  },
  formHeaderRow: {
    gap: spacing.md,
  },
  formHeaderTextBlock: {
    gap: 6,
  },
  modeSwitch: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: radius.pill,
    flexDirection: 'row',
    padding: 4,
  },
  modeChip: {
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  modeChipActive: {
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  modeChipText: {
    color: '#7F8898',
    fontSize: 13,
    fontWeight: '700',
  },
  modeChipTextActive: {
    color: '#F9FAFB',
  },
  sectionTitle: {
    color: '#F9FAFB',
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 32,
  },
  sectionSubtitle: {
    color: '#9AA1AC',
    fontSize: 14,
    lineHeight: 21,
  },
  fieldGroup: {
    gap: 8,
  },
  fieldLabel: {
    color: '#F2F4F8',
    fontSize: 14,
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#161A22',
    borderColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: 18,
    borderWidth: 1,
    color: '#F9FAFB',
    fontSize: 15,
    paddingHorizontal: spacing.md,
    paddingVertical: 15,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 20,
    justifyContent: 'center',
    minHeight: 56,
    paddingHorizontal: spacing.lg,
  },
  primaryButtonText: {
    color: '#0E1117',
    fontSize: 16,
    fontWeight: '800',
  },
  switchText: {
    color: '#8E95A2',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  switchLink: {
    color: '#F9FAFB',
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
  dividerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  dividerLine: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    flex: 1,
    height: 1,
  },
  dividerText: {
    color: '#717887',
    fontSize: 13,
    fontWeight: '700',
  },
  socialButton: {
    alignItems: 'center',
    backgroundColor: '#1A1F28',
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: 56,
    paddingHorizontal: spacing.lg,
  },
  googleBadge: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  googleBadgeText: {
    color: '#3F72FF',
    fontSize: 14,
    fontWeight: '900',
  },
  socialButtonText: {
    color: '#F9FAFB',
    fontSize: 16,
    fontWeight: '800',
  },
  footnote: {
    color: '#6F7786',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  feedbackText: {
    borderRadius: radius.md,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  feedbackError: {
    backgroundColor: 'rgba(209, 73, 91, 0.14)',
    color: '#FF8E99',
  },
  feedbackSuccess: {
    backgroundColor: 'rgba(63, 114, 255, 0.16)',
    color: '#AFC3FF',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonPressed: {
    opacity: 0.88,
  },
});
