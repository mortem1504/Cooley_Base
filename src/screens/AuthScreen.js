import React, { useState } from 'react';
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
import { useApp } from '../context/AppContext';
import { colors, radius, shadow, spacing } from '../theme';

const highlights = [
  { label: 'Nearby jobs', value: 'Walkable student gigs around campus' },
  { label: 'Fast trust', value: 'Verification badges and clear ratings' },
  { label: 'Quick pay', value: 'Short jobs with simple pricing upfront' },
];

export default function AuthScreen() {
  const { authMode, setAuthMode, login, signup } = useApp();
  const [name, setName] = useState('Minji Park');
  const [email, setEmail] = useState('minji@campus.edu');
  const [password, setPassword] = useState('password');
  const [bio, setBio] = useState('Reliable student for quick campus help and last-minute errands.');

  const isSignup = authMode === 'signup';

  const handleSubmit = () => {
    if (isSignup) {
      signup({ name, email, password, bio });
      return;
    }

    login({ name, email, password });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.badge}>Student quick jobs</Text>
          <Text style={styles.title}>Fast local help, powered by nearby students.</Text>
          <Text style={styles.subtitle}>
            Find runner jobs, event shifts, delivery help, and simple campus tasks in a calm,
            trustworthy marketplace.
          </Text>
        </View>

        <View style={styles.highlightRow}>
          {highlights.map((item) => (
            <View key={item.label} style={styles.highlightCard}>
              <Text style={styles.highlightLabel}>{item.label}</Text>
              <Text style={styles.highlightValue}>{item.value}</Text>
            </View>
          ))}
        </View>

        <View style={styles.formCard}>
          <View style={styles.modeSwitch}>
            <Pressable
              style={[styles.modeButton, !isSignup && styles.modeButtonActive]}
              onPress={() => setAuthMode('login')}
            >
              <Text style={[styles.modeText, !isSignup && styles.modeTextActive]}>Log in</Text>
            </Pressable>
            <Pressable
              style={[styles.modeButton, isSignup && styles.modeButtonActive]}
              onPress={() => setAuthMode('signup')}
            >
              <Text style={[styles.modeText, isSignup && styles.modeTextActive]}>Sign up</Text>
            </Pressable>
          </View>

          <Text style={styles.sectionTitle}>Simple onboarding</Text>
          <Text style={styles.sectionSubtitle}>
            Create your student profile, add your strengths, and start browsing nearby quick jobs.
          </Text>

          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Full name"
            placeholderTextColor={colors.subtleText}
            style={styles.input}
          />
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Campus email"
            placeholderTextColor={colors.subtleText}
            autoCapitalize="none"
            style={styles.input}
          />
          {isSignup ? (
            <TextInput
              value={bio}
              onChangeText={setBio}
              placeholder="Short bio"
              placeholderTextColor={colors.subtleText}
              multiline
              style={[styles.input, styles.bioInput]}
            />
          ) : null}
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor={colors.subtleText}
            secureTextEntry
            style={styles.input}
          />

          <Pressable style={styles.primaryButton} onPress={handleSubmit}>
            <Text style={styles.primaryButtonText}>{isSignup ? 'Create account' : 'Enter app'}</Text>
          </Pressable>

          <Text style={styles.footnote}>
            Student verification is shown as a green badge after onboarding.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, gap: spacing.xl },
  hero: { paddingTop: spacing.xxl + 8, gap: spacing.sm },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primarySoft,
    color: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    overflow: 'hidden',
    fontWeight: '700',
    fontSize: 12,
  },
  title: { fontSize: 34, lineHeight: 40, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 15, lineHeight: 23, color: colors.secondaryText },
  highlightRow: { gap: spacing.md },
  highlightCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow,
  },
  highlightLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
  },
  highlightValue: { fontSize: 14, lineHeight: 21, color: colors.secondaryText },
  formCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
    ...shadow,
  },
  modeSwitch: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: radius.pill,
    padding: 4,
  },
  modeButton: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: radius.pill },
  modeButtonActive: { backgroundColor: colors.card },
  modeText: { color: colors.subtleText, fontWeight: '700' },
  modeTextActive: { color: colors.text },
  sectionTitle: { fontSize: 22, fontWeight: '800', color: colors.text },
  sectionSubtitle: { fontSize: 14, lineHeight: 21, color: colors.secondaryText },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.text,
  },
  bioInput: { minHeight: 88, textAlignVertical: 'top' },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryButtonText: { color: colors.card, fontWeight: '800', fontSize: 15 },
  footnote: { fontSize: 12, lineHeight: 18, color: colors.subtleText },
});
