import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import AppButton from '../components/AppButton';
import AppCard from '../components/AppCard';
import AppTextInput from '../components/AppTextInput';
import BadgePill from '../components/BadgePill';
import useAppState from '../hooks/useAppState';
import useScreenTopInset from '../hooks/useScreenTopInset';
import {
  calculateAverageRating,
  fetchProfileReviews,
} from '../services/profileService';
import {
  getAchievementBadgeCatalog,
  MAX_CUSTOM_BADGES,
  MAX_EQUIPPED_ACHIEVEMENTS,
  resolveUniversityBadge,
  sanitizeCustomBadges,
  sanitizeSelectedAchievementBadges,
} from '../utils/profileBadges';
import { colors, radius, shadow, spacing } from '../utils/theme';

const VERIFIED_CHECK = '\u2713';

function createEditableBadges(profile) {
  const nextBadges = Array.isArray(profile?.customBadges) ? [...profile.customBadges] : [];
  return nextBadges.slice(0, MAX_CUSTOM_BADGES);
}

export default function BadgeManagementScreen({ navigation }) {
  const { currentUser, myListings, updateCurrentUserProfile } = useAppState();
  const topInset = useScreenTopInset(spacing.lg);
  const activeListingCount = useMemo(
    () =>
      myListings.filter((listing) => listing.status !== 'completed' && listing.status !== 'cancelled')
        .length,
    [myListings]
  );
  const [customBadgeInputs, setCustomBadgeInputs] = useState(() => createEditableBadges(currentUser));
  const [selectedAchievements, setSelectedAchievements] = useState(() =>
    sanitizeSelectedAchievementBadges(currentUser.selectedAchievementBadges)
  );
  const [reviews, setReviews] = useState([]);
  const [isReviewsLoading, setIsReviewsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [screenNotice, setScreenNotice] = useState('');

  useEffect(() => {
    navigation.setOptions?.({
      title: 'Manage badges',
    });
  }, [navigation]);

  useEffect(() => {
    setCustomBadgeInputs(createEditableBadges(currentUser));
    setSelectedAchievements(sanitizeSelectedAchievementBadges(currentUser.selectedAchievementBadges));
  }, [currentUser]);

  useEffect(() => {
    let isActive = true;

    async function loadReviews() {
      if (!currentUser.id) {
        setReviews([]);
        setScreenNotice('');
        return;
      }

      setIsReviewsLoading(true);

      try {
        const nextReviews = await fetchProfileReviews(currentUser.id);

        if (!isActive) {
          return;
        }

        setReviews(nextReviews);
        setScreenNotice('');
      } catch (error) {
        if (!isActive) {
          return;
        }

        setReviews([]);
        setScreenNotice(error.message || 'We could not load achievement progress right now.');
      } finally {
        if (isActive) {
          setIsReviewsLoading(false);
        }
      }
    }

    loadReviews();

    return () => {
      isActive = false;
    };
  }, [currentUser.id]);

  const reviewCount = reviews.length;
  const averageRating = calculateAverageRating(reviews, currentUser.rating);
  const universityBadge = resolveUniversityBadge(currentUser);
  const badgeMetrics = useMemo(
    () => ({
      activeJobs: activeListingCount,
      completedJobs: Number(currentUser.completedJobs || 0),
      rating: averageRating,
      reviewCount,
    }),
    [activeListingCount, averageRating, currentUser.completedJobs, reviewCount]
  );
  const achievementCatalog = useMemo(
    () => getAchievementBadgeCatalog(badgeMetrics),
    [badgeMetrics]
  );
  const sanitizedCustomBadgePreview = useMemo(
    () => sanitizeCustomBadges(customBadgeInputs),
    [customBadgeInputs]
  );
  const equippedCount = sanitizeSelectedAchievementBadges(selectedAchievements).length;

  const handleAddCustomBadge = () => {
    if (customBadgeInputs.length >= MAX_CUSTOM_BADGES) {
      Alert.alert(
        'Badge limit reached',
        `Keep custom badges to ${MAX_CUSTOM_BADGES} or fewer so the profile stays clean.`
      );
      return;
    }

    setCustomBadgeInputs((prev) => [...prev, '']);
  };

  const handleDeleteCustomBadge = (index) => {
    setCustomBadgeInputs((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
  };

  const handleReplaceAchievement = (nextBadgeKey) => {
    const equippedKeys = sanitizeSelectedAchievementBadges(selectedAchievements);

    Alert.alert(
      'Replace equipped badge',
      `You can only display ${MAX_EQUIPPED_ACHIEVEMENTS} achievement badges at a time.`,
      [
        ...equippedKeys.map((key) => {
          const currentBadge = achievementCatalog.find((badge) => badge.key === key);

          return {
            text: currentBadge?.label || key,
            onPress: () =>
              setSelectedAchievements((prev) =>
                sanitizeSelectedAchievementBadges([
                  ...prev.filter((value) => value !== key),
                  nextBadgeKey,
                ])
              ),
          };
        }),
        { style: 'cancel', text: 'Cancel' },
      ]
    );
  };

  const handleToggleAchievement = (badgeKey) => {
    const achievement = achievementCatalog.find((item) => item.key === badgeKey);

    if (selectedAchievements.includes(badgeKey)) {
      setSelectedAchievements((prev) => prev.filter((key) => key !== badgeKey));
      return;
    }

    if (!achievement?.isUnlocked) {
      return;
    }

    if (selectedAchievements.length < MAX_EQUIPPED_ACHIEVEMENTS) {
      setSelectedAchievements((prev) => sanitizeSelectedAchievementBadges([...prev, badgeKey]));
      return;
    }

    handleReplaceAchievement(badgeKey);
  };

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const unlockedAchievementKeys = new Set(
        achievementCatalog.filter((badge) => badge.isUnlocked).map((badge) => badge.key)
      );
      const nextSelectedAchievements = sanitizeSelectedAchievementBadges(selectedAchievements).filter(
        (key) => unlockedAchievementKeys.has(key)
      );
      const result = await updateCurrentUserProfile({
        customBadges: sanitizeCustomBadges(customBadgeInputs),
        selectedAchievementBadges: nextSelectedAchievements,
      });

      const labelMap = {
        custom_badges: 'custom badges',
        selected_achievement_badges: 'achievement badges',
      };

      if (result.omittedFields.length) {
        const fieldList = result.omittedFields
          .map((field) => labelMap[field] || field)
          .join(', ');

        Alert.alert(
          'Saved with a note',
          `${fieldList} needs the latest Supabase migration before it can sync fully.`
        );
      } else {
        Alert.alert('Badges updated', 'Your profile badges are ready.');
      }

      navigation.goBack();
    } catch (error) {
      Alert.alert('Save failed', error.message || 'We could not save your badges right now.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingTop: topInset }]}
      style={styles.container}
    >
      <AppCard style={styles.card}>
        <Text style={styles.sectionTitle}>Verified university badge</Text>
        <Text style={styles.helperText}>
          This badge shows campus identity verification. It is always visible on your profile and
          cannot be removed from here.
        </Text>
        <BadgePill
          compact
          icon={universityBadge.logo ? null : VERIFIED_CHECK}
          imageSource={universityBadge.logo}
          label={universityBadge.label}
          tone={universityBadge.tone}
        />
      </AppCard>

      <AppCard style={styles.card}>
        <View style={styles.sectionHeadingRow}>
          <Text style={styles.sectionTitle}>Custom badges</Text>
          <Text style={styles.sectionCount}>
            {sanitizeCustomBadges(customBadgeInputs).length}/{MAX_CUSTOM_BADGES}
          </Text>
        </View>
        <Text style={styles.helperText}>
          Use custom badges for identity and skills like Photographer or Videographer.
        </Text>

        {sanitizedCustomBadgePreview.length ? (
          <View style={styles.badgeWrap}>
            {sanitizedCustomBadgePreview.map((badge) => (
              <BadgePill compact key={badge} label={badge} tone="blue" variant="outline" />
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>No custom badges yet. Add up to five.</Text>
        )}

        {customBadgeInputs.map((badge, index) => (
          <View key={`custom-badge-${index}`} style={styles.customBadgeRow}>
            <AppTextInput
              onChangeText={(value) =>
                setCustomBadgeInputs((prev) =>
                  prev.map((item, currentIndex) => (currentIndex === index ? value : item))
                )
              }
              placeholder={`Badge ${index + 1}`}
              style={styles.customBadgeInput}
              value={badge}
            />
            <Pressable hitSlop={10} onPress={() => handleDeleteCustomBadge(index)}>
              <Text style={styles.deleteLink}>Delete</Text>
            </Pressable>
          </View>
        ))}

        <Pressable onPress={handleAddCustomBadge} style={styles.addBadgeButton}>
          <Text style={styles.addBadgeText}>Add custom badge</Text>
        </Pressable>
      </AppCard>

      <AppCard style={styles.card}>
        <View style={styles.sectionHeadingRow}>
          <Text style={styles.sectionTitle}>Achievement badges</Text>
          <Text style={styles.sectionCount}>
            {equippedCount}/{MAX_EQUIPPED_ACHIEVEMENTS} equipped
          </Text>
        </View>
        <Text style={styles.helperText}>
          Achievement badges are system-earned. Tap unlocked badges to choose which ones appear on
          your profile.
        </Text>

        {isReviewsLoading ? <Text style={styles.emptyText}>Checking your badge progress...</Text> : null}
        {screenNotice ? <Text style={styles.emptyText}>{screenNotice}</Text> : null}

        {achievementCatalog.map((badge) => {
          const isSelected = selectedAchievements.includes(badge.key);

          return (
            <Pressable
              key={badge.key}
              onPress={() => handleToggleAchievement(badge.key)}
              style={[
                styles.achievementRow,
                badge.isUnlocked && styles.achievementRowUnlocked,
                isSelected && styles.achievementRowSelected,
              ]}
            >
              <View style={styles.flexOne}>
                <BadgePill
                  compact
                  icon={badge.icon}
                  label={badge.label}
                  tone={badge.tone}
                  variant={isSelected ? 'solid' : 'filled'}
                />
                <Text style={styles.achievementDescription}>{badge.description}</Text>
              </View>
              <Text
                style={[
                  styles.achievementState,
                  badge.isUnlocked ? styles.achievementStateUnlocked : styles.achievementStateLocked,
                ]}
              >
                {!badge.isUnlocked ? 'Locked' : isSelected ? 'Selected' : 'Tap to equip'}
              </Text>
            </Pressable>
          );
        })}
      </AppCard>

      <AppButton
        disabled={isSaving}
        label={isSaving ? 'Saving badges...' : 'Save badges'}
        onPress={handleSave}
      />
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
  card: {
    gap: spacing.md,
    padding: spacing.lg,
  },
  sectionHeadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  sectionCount: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  helperText: {
    color: colors.secondaryText,
    fontSize: 13,
    lineHeight: 20,
  },
  badgeWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  emptyText: {
    color: colors.secondaryText,
    fontSize: 13,
    lineHeight: 19,
  },
  customBadgeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  customBadgeInput: {
    flex: 1,
  },
  deleteLink: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '700',
  },
  addBadgeButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  addBadgeText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  achievementRow: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
    shadowColor: shadow.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 1,
  },
  achievementRowUnlocked: {
    backgroundColor: '#FBFCFF',
  },
  achievementRowSelected: {
    borderColor: '#BCD7FF',
    backgroundColor: '#F0F7FF',
  },
  achievementDescription: {
    color: colors.secondaryText,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 10,
  },
  achievementState: {
    fontSize: 12,
    fontWeight: '700',
  },
  achievementStateUnlocked: {
    color: colors.primary,
  },
  achievementStateLocked: {
    color: colors.subtleText,
  },
  flexOne: {
    flex: 1,
  },
});
