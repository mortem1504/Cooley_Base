import React, { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { categories } from '../data/mockData';
import { useApp } from '../context/AppContext';
import { colors, radius, shadow, spacing } from '../theme';

export default function PostJobScreen({ navigation }) {
  const { postJob } = useApp();
  const [form, setForm] = useState({
    title: 'Library runner to return borrowed camera',
    description:
      'Need someone to return a borrowed camera kit to the media desk before it closes.',
    price: '22',
    location: 'Media Center',
    date: 'Today',
    time: '6:10 PM',
    category: 'Runner',
    instantAccept: true,
  });

  const updateField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const submit = () => {
    if (!form.title || !form.description || !form.location) {
      Alert.alert('Missing info', 'Please add a title, description, and location.');
      return;
    }

    const newJob = postJob(form);
    Alert.alert('Job posted', 'Your quick job is live nearby.');
    navigation.navigate('JobDetail', { jobId: newJob.id });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerCard}>
        <Text style={styles.heading}>Post a quick job</Text>
        <Text style={styles.subheading}>
          Share the task, set a clear price, and let nearby students respond fast.
        </Text>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.label}>Title</Text>
        <TextInput
          value={form.title}
          onChangeText={(value) => updateField('title', value)}
          placeholder="Job title"
          placeholderTextColor={colors.subtleText}
          style={styles.input}
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          value={form.description}
          onChangeText={(value) => updateField('description', value)}
          placeholder="Describe the task"
          placeholderTextColor={colors.subtleText}
          multiline
          style={[styles.input, styles.textArea]}
        />

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Price</Text>
            <TextInput
              value={form.price}
              onChangeText={(value) => updateField('price', value)}
              keyboardType="numeric"
              placeholder="$0"
              placeholderTextColor={colors.subtleText}
              style={styles.input}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
              {categories.filter((item) => item !== 'All').map((category) => {
                const selected = form.category === category;
                return (
                  <Pressable
                    key={category}
                    style={[styles.categoryChip, selected && styles.categoryChipActive]}
                    onPress={() => updateField('category', category)}
                  >
                    <Text style={[styles.categoryText, selected && styles.categoryTextActive]}>
                      {category}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>

        <Text style={styles.label}>Location</Text>
        <TextInput
          value={form.location}
          onChangeText={(value) => updateField('location', value)}
          placeholder="Pickup or task location"
          placeholderTextColor={colors.subtleText}
          style={styles.input}
        />

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Date</Text>
            <TextInput
              value={form.date}
              onChangeText={(value) => updateField('date', value)}
              placeholder="Today"
              placeholderTextColor={colors.subtleText}
              style={styles.input}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Time</Text>
            <TextInput
              value={form.time}
              onChangeText={(value) => updateField('time', value)}
              placeholder="6:00 PM"
              placeholderTextColor={colors.subtleText}
              style={styles.input}
            />
          </View>
        </View>

        <View style={styles.toggleCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleTitle}>Instant accept</Text>
            <Text style={styles.toggleSubtitle}>
              Turn this on for urgent tasks that can move straight into progress.
            </Text>
          </View>
          <Switch
            trackColor={{ false: '#D8D4CB', true: '#8FD3B3' }}
            thumbColor={colors.card}
            value={form.instantAccept}
            onValueChange={(value) => updateField('instantAccept', value)}
          />
        </View>

        <Pressable style={styles.primaryButton} onPress={submit}>
          <Text style={styles.primaryButtonText}>Post job</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingTop: spacing.xxl, gap: spacing.lg },
  headerCard: { gap: spacing.sm },
  heading: { color: colors.text, fontSize: 30, lineHeight: 36, fontWeight: '800' },
  subheading: { color: colors.secondaryText, fontSize: 14, lineHeight: 21 },
  formCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
    ...shadow,
  },
  label: { color: colors.text, fontSize: 13, fontWeight: '700', marginBottom: -6 },
  input: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    color: colors.text,
    fontSize: 15,
  },
  textArea: { minHeight: 96, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  categoryRow: { gap: spacing.xs, paddingVertical: 2 },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryChipActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  categoryText: { color: colors.secondaryText, fontWeight: '700', fontSize: 12 },
  categoryTextActive: { color: colors.primary },
  toggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  toggleTitle: { color: colors.text, fontSize: 15, fontWeight: '700', marginBottom: 4 },
  toggleSubtitle: { color: colors.secondaryText, fontSize: 13, lineHeight: 19 },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 6,
  },
  primaryButtonText: { color: colors.card, fontSize: 15, fontWeight: '800' },
});
