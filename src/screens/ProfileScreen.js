import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import AppButton from '../components/AppButton';
import AppCard from '../components/AppCard';
import AppTextInput from '../components/AppTextInput';
import BadgePill from '../components/BadgePill';
import UserAvatar from '../components/UserAvatar';
import useAppState from '../hooks/useAppState';
import useScreenTopInset from '../hooks/useScreenTopInset';
import { ROOT_ROUTES, TAB_ROUTES } from '../navigation/routes';
import { fetchProfileById } from '../services/authService';
import {
  buildUserProfile,
  calculateAverageRating,
  emptyUserProfile,
  fetchProfileReviews,
} from '../services/profileService';
import { uploadUserAvatarImage } from '../services/storageService';
import { getEquippedAchievementBadges, resolveUniversityBadge } from '../utils/profileBadges';
import { colors, radius, shadow, spacing } from '../utils/theme';

const RATING_STAR = '\u2605';
const VERIFIED_CHECK = '\u2713';

const ID_CARD_THEMES = [
  { accent: '#2B5B8F', badge: '#386FAF', cardColor: '#B9D9F7', label: 'Sky', text: '#14324C' },
  { accent: '#2F7A7A', badge: '#3F9292', cardColor: '#BFE8DF', label: 'Mint', text: '#163C3C' },
  { accent: '#8B5A3C', badge: '#A56A47', cardColor: '#F7D2B7', label: 'Peach', text: '#442515' },
  { accent: '#6D5AA8', badge: '#7C68B8', cardColor: '#D9CEF9', label: 'Lilac', text: '#2F2451' },
  { accent: '#8E8845', badge: '#AAA358', cardColor: '#F4EEA8', label: 'Lemon', text: '#433E1D' },
];

function createProfileDraft(profile) {
  return {
    fullName: profile?.name || '',
    idCardColor: profile?.idCardColor || ID_CARD_THEMES[0].cardColor,
    schoolName: profile?.schoolName || '',
    shortBio: profile?.shortBio || '',
    username: profile?.username || '',
    yearLevel: profile?.yearLevel || emptyUserProfile.yearLevel,
  };
}

function getIdCardTheme(colorValue) {
  return (
    ID_CARD_THEMES.find((theme) => theme.cardColor === colorValue) || {
      accent: '#2B5B8F',
      badge: '#386FAF',
      cardColor: colorValue || ID_CARD_THEMES[0].cardColor,
      label: 'Custom',
      text: '#14324C',
    }
  );
}

function formatStatus(status) {
  return String(status || '')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function getListingBadgeLabel(listing) {
  if (listing.type === 'job') {
    return 'Job';
  }

  return listing.listingMode === 'sell' ? 'Sell' : 'Rent';
}

function mapListingToProfileCard(listing) {
  const isItemListing = listing.type === 'rental';
  const isSellListing = isItemListing && listing.instantAccept;
  const detail = isItemListing
    ? isSellListing
      ? listing.urgent
        ? 'For sale - Available now'
        : 'For sale'
      : listing.urgent
        ? `${listing.durationText || listing.duration || 'Flexible'} - Available now`
        : listing.durationText || listing.duration || 'Flexible'
    : `${listing.date} - ${listing.time}`;

  return {
    category: listing.category,
    createdAt: listing.createdAt || 0,
    detail,
    id: listing.id,
    listingMode: isItemListing ? (isSellListing ? 'sell' : 'rent') : 'job',
    location: listing.location,
    price: listing.price,
    status: listing.status,
    title: listing.title,
    type: listing.type,
  };
}

function formatReviewDate(value) {
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function formatGreetingDate(value = new Date()) {
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
  }).format(value);
}

function getGreetingName(profile) {
  const fullName = String(profile?.name || '').trim();

  if (fullName) {
    return fullName.split(' ')[0];
  }

  const username = String(profile?.username || '')
    .trim()
    .replace(/^@+/, '');

  return username || 'Student';
}

function buildUniversityYearLine(profile) {
  const schoolName = String(profile?.schoolName || emptyUserProfile.schoolName).trim();
  const yearLevel = String(profile?.yearLevel || emptyUserProfile.yearLevel).trim();
  return [schoolName, yearLevel].filter(Boolean).join(' \u2022 ');
}

function buildReviewStars(rating) {
  const roundedRating = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
  return Array.from({ length: 5 }, (_, index) => (index < roundedRating ? '\u2605' : '\u2606')).join(
    ''
  );
}

function clampRating(rating) {
  return Math.max(0, Math.min(5, Number(rating) || 0));
}

function buildCardProfile(profile, draft, isEditMode) {
  if (!isEditMode) {
    return profile;
  }

  return {
    ...profile,
    idCardColor: draft.idCardColor || profile.idCardColor,
    name: draft.fullName || profile.name,
    schoolName: draft.schoolName || profile.schoolName,
    shortBio: draft.shortBio || profile.shortBio,
    username: draft.username || profile.username,
    yearLevel: draft.yearLevel || profile.yearLevel,
  };
}

function StudentIdCard({ isEditable, isEditing, onPressEdit, onPressPhoto, profile, rating }) {
  const theme = getIdCardTheme(profile.idCardColor);
  const cardRating = clampRating(rating);
  const universityBadge = resolveUniversityBadge(profile);

  return (
    <View
      style={[styles.idCard, { backgroundColor: theme.cardColor, borderColor: theme.accent }]}
    >
      <View style={styles.idGradientPane} />
      <View style={styles.idGlowLarge} />
      <View style={styles.idGlowSmall} />
      {isEditable ? (
        <Pressable hitSlop={10} onPress={onPressEdit} style={styles.idEditButton}>
          <Text style={styles.idEditButtonText}>{isEditing ? 'Cancel' : 'Edit Profile'}</Text>
        </Pressable>
      ) : null}

      <View style={[styles.idBody, isEditable && styles.idBodyWithAction]}>
        <Pressable
          disabled={!onPressPhoto}
          onPress={onPressPhoto}
          style={[styles.idPhotoFrame, onPressPhoto && styles.idPhotoFrameInteractive]}
        >
          {profile.avatarUrl ? (
            <Image source={{ uri: profile.avatarUrl }} style={styles.idPhotoImage} />
          ) : (
            <View style={styles.idPhotoFallback}>
              <Text style={styles.idPhotoInitials}>{profile.avatar}</Text>
            </View>
          )}
        </Pressable>

        <View style={styles.idInfoColumn}>
          <Text numberOfLines={2} style={[styles.idValueHero, { color: theme.text }]}>
            {profile.name || 'Student User'}
          </Text>
          <Text numberOfLines={1} style={styles.idUsername}>
            {profile.username ? `@${profile.username}` : '@student'}
          </Text>
          <Text numberOfLines={1} style={styles.idUniversityLine}>
            {buildUniversityYearLine(profile)}
          </Text>
          <View style={styles.idMetaRow}>
            <View style={styles.idRatingPill}>
              <Text style={styles.idRatingIcon}>{RATING_STAR}</Text>
              <Text style={[styles.idRatingInlineValue, { color: theme.text }]}>
                {cardRating.toFixed(1)}
              </Text>
            </View>
            <BadgePill
              compact
              icon={universityBadge.logo ? null : VERIFIED_CHECK}
              imageSource={universityBadge.logo}
              label={universityBadge.label}
              style={styles.idUniversityBadge}
              tone={universityBadge.tone}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

function BadgeGroup({ badges, emptyMessage, renderBadge, title }) {
  return (
    <View style={styles.badgeGroup}>
      <Text style={styles.badgeGroupTitle}>{title}</Text>
      {badges.length ? (
        <View style={styles.badgeWrap}>{badges.map(renderBadge)}</View>
      ) : (
        <Text style={styles.badgeEmptyText}>{emptyMessage}</Text>
      )}
    </View>
  );
}

function ListingCard({ isOwnProfile, listing, onPress }) {
  const isItemListing = listing.type === 'rental';
  const isSellListing = isItemListing && listing.listingMode === 'sell';

  return (
    <Pressable onPress={onPress} style={styles.listingRow}>
      <View style={styles.listingHeaderRow}>
        <View
          style={[
            styles.listingTypePill,
            isItemListing && styles.listingTypePillRent,
            isSellListing && styles.listingTypePillSell,
          ]}
        >
          <Text
            style={[
              styles.listingTypeText,
              isItemListing && styles.listingTypeTextRent,
              isSellListing && styles.listingTypeTextSell,
            ]}
          >
            {getListingBadgeLabel(listing)}
          </Text>
        </View>
        <Text style={styles.listingStatus}>{formatStatus(listing.status)}</Text>
      </View>
      <Text style={styles.listingTitle}>{listing.title}</Text>
      <Text style={styles.listingMeta}>
        {listing.category} - {listing.location}
      </Text>
      <View style={styles.listingFooterRow}>
        <Text style={styles.listingMeta}>{listing.detail}</Text>
        <View style={styles.listingFooterRight}>
          <Text style={styles.listingEdit}>{isOwnProfile ? 'Edit' : 'Open'}</Text>
          <Text style={styles.listingPrice}>${listing.price}</Text>
        </View>
      </View>
    </Pressable>
  );
}

function ReviewCard({ onOpenReviewerProfile, review }) {
  return (
    <View style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        <View style={styles.reviewAuthorRow}>
          <UserAvatar
            avatarUrl={review.reviewer.avatarUrl}
            initials={review.reviewer.avatar}
            name={review.reviewer.name}
            onPress={() => onOpenReviewerProfile(review.reviewer.id)}
            size={42}
          />
          <View style={styles.flexOne}>
            <Pressable onPress={() => onOpenReviewerProfile(review.reviewer.id)}>
              <Text style={styles.reviewAuthorName}>{review.reviewer.name}</Text>
            </Pressable>
            <Text style={styles.reviewAuthorMeta}>
              {review.reviewer.schoolName} - {formatReviewDate(review.createdAt)}
            </Text>
          </View>
        </View>
        <Text style={styles.reviewStars}>{buildReviewStars(review.rating)}</Text>
      </View>
      {review.comment ? <Text style={styles.reviewComment}>{review.comment}</Text> : null}
    </View>
  );
}

export default function ProfileScreen({ navigation, route }) {
  const {
    currentUser,
    isListingsLoading,
    jobs,
    listingsNotice,
    logout,
    myListings,
    rentals,
    updateCurrentUserProfile,
  } = useAppState();
  const topInset = useScreenTopInset(spacing.lg);
  const routeUserId = route?.params?.userId || currentUser.id;
  const isOwnProfile = !route?.params?.userId || routeUserId === currentUser.id;
  const [selectedListingsTab, setSelectedListingsTab] = useState('job');
  const [loadedProfile, setLoadedProfile] = useState(emptyUserProfile);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [profileNotice, setProfileNotice] = useState('');
  const [reviews, setReviews] = useState([]);
  const [isReviewsLoading, setIsReviewsLoading] = useState(false);
  const [reviewsNotice, setReviewsNotice] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState(() => createProfileDraft(currentUser));
  const [pendingAvatarAsset, setPendingAvatarAsset] = useState(null);

  const displayProfile = isOwnProfile ? currentUser : loadedProfile;
  const previewProfile = useMemo(
    () =>
      buildCardProfile(
        {
          ...displayProfile,
          avatarUrl: pendingAvatarAsset?.uri || displayProfile.avatarUrl,
        },
        profileDraft,
        isOwnProfile && isEditMode
      ),
    [displayProfile, isEditMode, isOwnProfile, pendingAvatarAsset?.uri, profileDraft]
  );

  useEffect(() => {
    navigation.setOptions?.({
      title: isOwnProfile ? 'Profile' : displayProfile?.name || 'Profile',
    });
  }, [displayProfile?.name, isOwnProfile, navigation]);

  useEffect(() => {
    if (!isOwnProfile) {
      setIsEditMode(false);
      setPendingAvatarAsset(null);
      return;
    }

    if (!isEditMode) {
      setProfileDraft(createProfileDraft(currentUser));
      setPendingAvatarAsset(null);
    }
  }, [currentUser, isEditMode, isOwnProfile]);

  useEffect(() => {
    if (isOwnProfile) {
      setLoadedProfile(currentUser);
      setProfileNotice('');
      setIsProfileLoading(false);
      return;
    }

    let isActive = true;

    async function loadProfile() {
      setIsProfileLoading(true);

      try {
        const profile = await fetchProfileById(routeUserId);

        if (!isActive) {
          return;
        }

        if (!profile) {
          setLoadedProfile({
            ...emptyUserProfile,
            id: routeUserId,
          });
          setProfileNotice('This student profile could not be found.');
          return;
        }

        setLoadedProfile(buildUserProfile(profile));
        setProfileNotice('');
      } catch (error) {
        if (!isActive) {
          return;
        }

        setLoadedProfile({
          ...emptyUserProfile,
          id: routeUserId,
        });
        setProfileNotice(error.message || 'We could not load this profile right now.');
      } finally {
        if (isActive) {
          setIsProfileLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      isActive = false;
    };
  }, [currentUser, isOwnProfile, routeUserId]);

  useEffect(() => {
    let isActive = true;

    async function loadReviews() {
      if (!routeUserId) {
        setReviews([]);
        setReviewsNotice('');
        setIsReviewsLoading(false);
        return;
      }

      setIsReviewsLoading(true);

      try {
        const nextReviews = await fetchProfileReviews(routeUserId);

        if (!isActive) {
          return;
        }

        setReviews(nextReviews);
        setReviewsNotice('');
      } catch (error) {
        if (!isActive) {
          return;
        }

        setReviews([]);
        setReviewsNotice(error.message || 'We could not load profile reviews right now.');
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
  }, [routeUserId]);

  const visibleListings = useMemo(() => {
    if (isOwnProfile) {
      return myListings.filter(
        (listing) => listing.status !== 'completed' && listing.status !== 'cancelled'
      );
    }

    return [...jobs, ...rentals]
      .filter(
        (listing) =>
          listing.createdBy === routeUserId &&
          listing.status !== 'completed' &&
          listing.status !== 'cancelled'
      )
      .map(mapListingToProfileCard)
      .sort((first, second) => (second.createdAt || 0) - (first.createdAt || 0));
  }, [isOwnProfile, jobs, myListings, rentals, routeUserId]);

  const jobListings = useMemo(
    () => visibleListings.filter((listing) => listing.type === 'job'),
    [visibleListings]
  );
  const itemListings = useMemo(
    () => visibleListings.filter((listing) => listing.type === 'rental'),
    [visibleListings]
  );
  const listingTabs = [
    { key: 'job', count: jobListings.length, label: 'Jobs' },
    { key: 'rental', count: itemListings.length, label: 'Item listings' },
  ];
  const selectedListings = selectedListingsTab === 'job' ? jobListings : itemListings;
  const reviewCount = reviews.length;
  const averageRating = calculateAverageRating(reviews, displayProfile.rating);
  const activeJobCount = jobListings.length;
  const greetingDate = useMemo(() => formatGreetingDate(new Date()), []);
  const greetingName = getGreetingName(previewProfile);
  const customBadges = Array.isArray(displayProfile.customBadges) ? displayProfile.customBadges : [];
  const badgeMetrics = useMemo(
    () => ({
      activeJobs: activeJobCount,
      completedJobs: Number(displayProfile.completedJobs || 0),
      rating: averageRating,
      reviewCount,
    }),
    [activeJobCount, averageRating, displayProfile.completedJobs, reviewCount]
  );
  const equippedAchievementBadges = useMemo(
    () =>
      getEquippedAchievementBadges(displayProfile.selectedAchievementBadges, badgeMetrics),
    [badgeMetrics, displayProfile.selectedAchievementBadges]
  );
  const statCards = [
    { isPrimary: true, key: 'rating', label: 'Rating', value: averageRating.toFixed(1) },
    { key: 'reviews', label: 'Reviews', value: String(reviewCount) },
    { key: 'active-jobs', label: 'Active jobs', value: String(activeJobCount) },
  ];

  const handleOpenProfile = (userId) => {
    if (!userId) {
      return;
    }

    navigation.navigate(ROOT_ROUTES.USER_PROFILE, {
      userId,
    });
  };

  const handleOpenBadgeManager = () => {
    navigation.navigate(ROOT_ROUTES.BADGE_MANAGEMENT);
  };

  const handlePickAvatar = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (permission.status !== 'granted') {
        Alert.alert(
          'Photo access needed',
          'Allow photo library access to choose a profile picture.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [1, 1],
        base64: true,
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });

      if (result.canceled) {
        return;
      }

      setPendingAvatarAsset(result.assets[0] || null);
    } catch (error) {
      Alert.alert('Photo unavailable', error.message || 'We could not open your photo library.');
    }
  };

  const handleSaveProfile = async () => {
    if (!profileDraft.fullName.trim()) {
      Alert.alert('Missing name', 'Add your full name before saving your profile.');
      return;
    }

    if (!profileDraft.username.trim()) {
      Alert.alert('Missing username', 'Choose a username before saving your profile.');
      return;
    }

    if (!profileDraft.schoolName.trim()) {
      Alert.alert('Missing school', 'Add your school name before saving your profile.');
      return;
    }

    if (!profileDraft.yearLevel.trim()) {
      Alert.alert('Missing year', 'Add your study year before saving your profile.');
      return;
    }

    setIsSavingProfile(true);

    try {
      let nextAvatarUrl = currentUser.avatarUrl;

      if (pendingAvatarAsset) {
        nextAvatarUrl = await uploadUserAvatarImage({
          photo: pendingAvatarAsset,
          userId: currentUser.id,
        });
      }

      const result = await updateCurrentUserProfile({
        avatarUrl: nextAvatarUrl,
        fullName: profileDraft.fullName,
        idCardColor: profileDraft.idCardColor,
        schoolName: profileDraft.schoolName,
        shortBio: profileDraft.shortBio,
        username: profileDraft.username,
        yearLevel: profileDraft.yearLevel,
      });

      setIsEditMode(false);
      setPendingAvatarAsset(null);

      if (result.omittedFields.length) {
        const labelMap = {
          custom_badges: 'custom badges',
          id_card_color: 'card color',
          selected_achievement_badges: 'achievement badges',
          university_key: 'university badge',
          username: 'username',
          year_level: 'year',
        };
        const fieldList = result.omittedFields
          .map((field) => labelMap[field] || field)
          .join(', ');

        Alert.alert(
          'Profile updated',
          `Saved most changes. ${fieldList} still needs the latest Supabase migration before it can sync fully.`
        );
        return;
      }

      Alert.alert('Profile updated', 'Your student card and profile are now live.');
    } catch (error) {
      Alert.alert('Save failed', error.message || 'We could not save your profile right now.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleOpenListing = (listing) => {
    if (isOwnProfile) {
      navigation.navigate(ROOT_ROUTES.MAIN_TABS, {
        params: {
          editListingId: listing.id,
        },
        screen: TAB_ROUTES.POST_JOB,
      });
      return;
    }

    navigation.navigate(ROOT_ROUTES.JOB_DETAIL, {
      jobId: listing.id,
    });
  };

  const universityBadge = resolveUniversityBadge(displayProfile);

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingTop: topInset }]}
      style={styles.container}
    >
      <View style={styles.heroSection}>
        <View style={styles.greetingBlock}>
          <Text style={styles.greetingTitle}>Hello, {greetingName}</Text>
          <Text style={styles.greetingDate}>{greetingDate}</Text>
        </View>

        <StudentIdCard
          isEditable={isOwnProfile}
          isEditing={isEditMode}
          onPressEdit={() => {
            if (isEditMode) {
              setIsEditMode(false);
              return;
            }

            setProfileDraft(createProfileDraft(currentUser));
            setPendingAvatarAsset(null);
            setIsEditMode(true);
          }}
          onPressPhoto={isOwnProfile && isEditMode ? handlePickAvatar : undefined}
          profile={previewProfile}
          rating={averageRating}
        />

        {previewProfile.shortBio && previewProfile.shortBio !== emptyUserProfile.shortBio ? (
          <Text style={styles.bio}>{previewProfile.shortBio}</Text>
        ) : null}

        <View style={styles.statRow}>
          {statCards.map((item) => (
            <View
              key={item.key}
              style={[styles.statItem, item.isPrimary && styles.statItemPrimary]}
            >
              <Text style={[styles.statValue, item.isPrimary && styles.statValuePrimary]}>
                {item.value}
              </Text>
              <Text style={[styles.statLabel, item.isPrimary && styles.statLabelPrimary]}>
                {item.label}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {profileNotice ? (
        <AppCard style={styles.card}>
          <Text style={styles.sectionTitle}>
            {isProfileLoading ? 'Loading profile' : 'Profile unavailable'}
          </Text>
          <Text style={styles.emptyText}>{profileNotice}</Text>
        </AppCard>
      ) : null}

      {isOwnProfile && isEditMode ? (
        <AppCard style={styles.card}>
          <View style={styles.sectionHeadingRow}>
            <Text style={styles.sectionTitle}>Edit card details</Text>
            <Pressable hitSlop={10} onPress={handlePickAvatar}>
              <Text style={styles.inlineLink}>Change photo</Text>
            </Pressable>
          </View>

          <Text style={styles.helperText}>
            Pick a card color and update the details shown on your student card. University
            verification and badges are managed separately.
          </Text>

          <View style={styles.paletteRow}>
            {ID_CARD_THEMES.map((theme) => {
              const isActive = profileDraft.idCardColor === theme.cardColor;

              return (
                <Pressable
                  key={theme.cardColor}
                  onPress={() =>
                    setProfileDraft((prev) => ({
                      ...prev,
                      idCardColor: theme.cardColor,
                    }))
                  }
                  style={[styles.paletteSwatchWrap, isActive && styles.paletteSwatchWrapActive]}
                >
                  <View
                    style={[
                      styles.paletteSwatch,
                      { backgroundColor: theme.cardColor, borderColor: theme.accent },
                    ]}
                  />
                  <Text style={styles.paletteLabel}>{theme.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.readOnlyField}>
            <Text style={styles.readOnlyLabel}>EMAIL</Text>
            <Text numberOfLines={1} style={styles.readOnlyValue}>
              {displayProfile.email || 'No email available'}
            </Text>
          </View>

          <View style={styles.readOnlyField}>
            <Text style={styles.readOnlyLabel}>UNIVERSITY BADGE</Text>
            <View style={styles.readOnlyBadgeWrap}>
              <BadgePill
                compact
                icon={universityBadge.logo ? null : VERIFIED_CHECK}
                imageSource={universityBadge.logo}
                label={universityBadge.label}
                tone={universityBadge.tone}
              />
            </View>
          </View>

          <AppTextInput
            onChangeText={(value) =>
              setProfileDraft((prev) => ({
                ...prev,
                fullName: value,
              }))
            }
            placeholder="Full name"
            value={profileDraft.fullName}
          />
          <AppTextInput
            autoCapitalize="none"
            onChangeText={(value) =>
              setProfileDraft((prev) => ({
                ...prev,
                username: value,
              }))
            }
            placeholder="Username"
            value={profileDraft.username}
          />
          <AppTextInput
            onChangeText={(value) =>
              setProfileDraft((prev) => ({
                ...prev,
                schoolName: value,
              }))
            }
            placeholder="School name"
            value={profileDraft.schoolName}
          />
          <AppTextInput
            onChangeText={(value) =>
              setProfileDraft((prev) => ({
                ...prev,
                yearLevel: value,
              }))
            }
            placeholder="Year"
            value={profileDraft.yearLevel}
          />
          <AppTextInput
            multiline
            onChangeText={(value) =>
              setProfileDraft((prev) => ({
                ...prev,
                shortBio: value,
              }))
            }
            placeholder="Short bio"
            style={styles.bioInput}
            value={profileDraft.shortBio}
          />

          <AppButton
            disabled={isSavingProfile}
            label={isSavingProfile ? 'Saving card...' : 'Save profile'}
            onPress={handleSaveProfile}
          />
        </AppCard>
      ) : null}

      <AppCard style={styles.card}>
        <View style={styles.sectionHeadingRow}>
          <Text style={styles.sectionTitle}>Badges</Text>
          {isOwnProfile ? (
            <Pressable hitSlop={10} onPress={handleOpenBadgeManager}>
              <Text style={styles.inlineLink}>Edit</Text>
            </Pressable>
          ) : null}
        </View>

        <Text style={styles.helperText}>
          Custom badges show identity and skills. Achievement badges are earned automatically and
          only up to three can be shown at a time.
        </Text>

        <BadgeGroup
          badges={customBadges}
          emptyMessage={
            isOwnProfile
              ? 'Add custom badges like Photographer or Videographer from the badge manager.'
              : 'This student has not added any custom badges yet.'
          }
          renderBadge={(badge) => (
            <BadgePill compact key={badge} label={badge} tone="blue" variant="outline" />
          )}
          title="Custom badges"
        />

        <BadgeGroup
          badges={equippedAchievementBadges}
          emptyMessage={
            isOwnProfile
              ? 'Unlocked achievement badges will appear here after you equip them.'
              : 'This student has not equipped any achievement badges yet.'
          }
          renderBadge={(badge) => (
            <BadgePill
              compact
              icon={badge.icon}
              key={badge.key}
              label={badge.label}
              tone={badge.tone}
            />
          )}
          title={isOwnProfile ? 'Achievement badges' : 'Earned badges'}
        />
      </AppCard>

      <AppCard style={styles.card}>
        <View style={styles.sectionHeadingRow}>
          <Text style={styles.sectionTitle}>
            {isOwnProfile ? 'Your listings' : 'Current listings'}
          </Text>
          <Text style={styles.sectionCount}>{visibleListings.length}</Text>
        </View>
        <View style={styles.segmentedControl}>
          {listingTabs.map((tab) => {
            const isActive = selectedListingsTab === tab.key;

            return (
              <Pressable
                key={tab.key}
                onPress={() => setSelectedListingsTab(tab.key)}
                style={[styles.segmentButton, isActive && styles.segmentButtonActive]}
              >
                <Text style={[styles.segmentText, isActive && styles.segmentTextActive]}>
                  {tab.label}
                </Text>
                <View
                  style={[styles.segmentCountBadge, isActive && styles.segmentCountBadgeActive]}
                >
                  <Text
                    style={[styles.segmentCountText, isActive && styles.segmentCountTextActive]}
                  >
                    {tab.count}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {isListingsLoading ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Loading listings</Text>
            <Text style={styles.emptyText}>Pulling the latest live listings from Supabase.</Text>
          </View>
        ) : listingsNotice && !selectedListings.length ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Could not load listings</Text>
            <Text style={styles.emptyText}>{listingsNotice}</Text>
          </View>
        ) : selectedListings.length ? (
          selectedListings.map((listing) => (
            <ListingCard
              isOwnProfile={isOwnProfile}
              key={listing.id}
              listing={listing}
              onPress={() => handleOpenListing(listing)}
            />
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>
              {selectedListingsTab === 'job' ? 'No jobs yet' : 'No item listings yet'}
            </Text>
            <Text style={styles.emptyText}>
              {isOwnProfile
                ? selectedListingsTab === 'job'
                  ? 'Your posted jobs will show up here after you publish them.'
                  : 'Your item listings will show up here after you publish them.'
                : selectedListingsTab === 'job'
                  ? 'This student does not have any active job listings right now.'
                  : 'This student does not have any active item listings right now.'}
            </Text>
          </View>
        )}
      </AppCard>

      <AppCard style={styles.card}>
        <View style={styles.sectionHeadingRow}>
          <Text style={styles.sectionTitle}>Reviews</Text>
          <Text style={styles.sectionCount}>{reviewCount}</Text>
        </View>
        {isReviewsLoading ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Loading reviews</Text>
            <Text style={styles.emptyText}>Gathering the latest profile feedback.</Text>
          </View>
        ) : reviewsNotice ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Could not load reviews</Text>
            <Text style={styles.emptyText}>{reviewsNotice}</Text>
          </View>
        ) : reviews.length ? (
          reviews.map((review) => (
            <ReviewCard
              key={review.id}
              onOpenReviewerProfile={handleOpenProfile}
              review={review}
            />
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No reviews yet</Text>
            <Text style={styles.emptyText}>
              {isOwnProfile
                ? 'Reviews from completed rentals will appear here for other students to see.'
                : 'This student has not received any public reviews yet.'}
            </Text>
          </View>
        )}
      </AppCard>

      {isOwnProfile ? <AppButton label="Log out" onPress={logout} variant="ghost" /> : null}
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
  heroSection: {
    gap: spacing.lg,
  },
  greetingBlock: {
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  greetingTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
  },
  greetingDate: {
    color: colors.subtleText,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  idCard: {
    borderRadius: 24,
    borderWidth: 1,
    minHeight: 176,
    overflow: 'hidden',
    padding: spacing.lg,
    position: 'relative',
    shadowColor: '#8FB8E8',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 6,
  },
  idGradientPane: {
    backgroundColor: 'rgba(255,255,255,0.28)',
    borderBottomLeftRadius: 80,
    borderTopLeftRadius: 80,
    bottom: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    width: '56%',
  },
  idGlowLarge: {
    backgroundColor: 'rgba(255,255,255,0.28)',
    borderRadius: 120,
    height: 180,
    position: 'absolute',
    right: -34,
    top: -30,
    width: 180,
  },
  idGlowSmall: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 70,
    bottom: -18,
    height: 110,
    position: 'absolute',
    right: 12,
    width: 110,
  },
  idEditButton: {
    alignItems: 'center',
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: radius.pill,
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    position: 'absolute',
    right: spacing.lg,
    top: spacing.lg,
    zIndex: 2,
  },
  idEditButtonText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  idBody: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  idBodyWithAction: {
    marginTop: 20,
  },
  idPhotoFrame: {
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderColor: 'rgba(255,255,255,0.42)',
    borderRadius: 18,
    borderWidth: 1,
    height: 112,
    overflow: 'hidden',
    width: 96,
  },
  idPhotoImage: {
    height: '100%',
    width: '100%',
  },
  idPhotoFallback: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.7)',
    flex: 1,
    justifyContent: 'center',
  },
  idPhotoInitials: {
    color: colors.primary,
    fontSize: 28,
    fontWeight: '800',
  },
  idPhotoFrameInteractive: {
    borderStyle: 'dashed',
  },
  idInfoColumn: {
    flex: 1,
    gap: spacing.xs,
    justifyContent: 'center',
    minWidth: 0,
  },
  idValueHero: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.3,
    lineHeight: 30,
  },
  idUsername: {
    color: colors.subtleText,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  idUniversityLine: {
    color: colors.secondaryText,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  idMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: 2,
  },
  idRatingPill: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  idRatingIcon: {
    color: '#F4C542',
    fontSize: 16,
    fontWeight: '800',
  },
  idRatingInlineValue: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  idUniversityBadge: {
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderColor: 'rgba(255,255,255,0.68)',
  },
  bio: {
    color: colors.secondaryText,
    fontSize: 14,
    lineHeight: 21,
    paddingHorizontal: spacing.xs,
  },
  statRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statItem: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: '#E9EFF9',
    borderRadius: 20,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.lg,
    shadowColor: shadow.shadowColor,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 2,
  },
  statItemPrimary: {
    backgroundColor: '#ECF5FF',
    borderColor: '#D6E7FF',
  },
  statValue: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
  },
  statValuePrimary: {
    color: colors.primary,
  },
  statLabel: {
    color: colors.subtleText,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center',
  },
  statLabelPrimary: {
    color: colors.primary,
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
  inlineLink: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  helperText: {
    color: colors.secondaryText,
    fontSize: 13,
    lineHeight: 20,
  },
  paletteRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  paletteSwatchWrap: {
    alignItems: 'center',
    gap: 6,
  },
  paletteSwatchWrapActive: {
    transform: [{ scale: 1.03 }],
  },
  paletteSwatch: {
    borderRadius: 20,
    borderWidth: 2,
    height: 40,
    width: 40,
  },
  paletteLabel: {
    color: colors.subtleText,
    fontSize: 11,
    fontWeight: '700',
  },
  readOnlyField: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  readOnlyLabel: {
    color: colors.subtleText,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  readOnlyValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 8,
  },
  readOnlyBadgeWrap: {
    marginTop: 10,
  },
  bioInput: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  badgeGroup: {
    gap: spacing.sm,
  },
  badgeGroupTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  badgeWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  badgeEmptyText: {
    color: colors.secondaryText,
    fontSize: 13,
    lineHeight: 19,
  },
  segmentedControl: {
    backgroundColor: colors.background,
    borderRadius: radius.pill,
    flexDirection: 'row',
    padding: 4,
  },
  segmentButton: {
    alignItems: 'center',
    borderRadius: radius.pill,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  segmentButtonActive: {
    backgroundColor: colors.card,
  },
  segmentText: {
    color: colors.subtleText,
    fontSize: 13,
    fontWeight: '700',
  },
  segmentTextActive: {
    color: colors.text,
  },
  segmentCountBadge: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    justifyContent: 'center',
    minWidth: 24,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  segmentCountBadgeActive: {
    backgroundColor: colors.primarySoft,
  },
  segmentCountText: {
    color: colors.subtleText,
    fontSize: 11,
    fontWeight: '800',
  },
  segmentCountTextActive: {
    color: colors.primary,
  },
  listingRow: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 8,
    padding: spacing.md,
  },
  listingHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  listingTypePill: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  listingTypePillRent: {
    backgroundColor: '#FFF0DD',
  },
  listingTypePillSell: {
    backgroundColor: '#E6F6EC',
  },
  listingTypeText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  listingTypeTextRent: {
    color: '#D97904',
  },
  listingTypeTextSell: {
    color: '#23834C',
  },
  listingStatus: {
    color: colors.secondaryText,
    fontSize: 12,
    fontWeight: '700',
  },
  listingTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  listingMeta: {
    color: colors.secondaryText,
    fontSize: 13,
  },
  listingFooterRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  listingFooterRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  listingEdit: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  listingPrice: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  emptyState: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 6,
    padding: spacing.md,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  emptyText: {
    color: colors.secondaryText,
    fontSize: 13,
    lineHeight: 19,
  },
  reviewCard: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 10,
    padding: spacing.md,
  },
  reviewHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  reviewAuthorRow: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  reviewAuthorName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  reviewAuthorMeta: {
    color: colors.secondaryText,
    fontSize: 12,
    marginTop: 4,
  },
  reviewStars: {
    color: '#E0A100',
    fontSize: 17,
    letterSpacing: 1.2,
    marginTop: 2,
  },
  reviewComment: {
    color: colors.secondaryText,
    fontSize: 14,
    lineHeight: 21,
  },
  flexOne: {
    flex: 1,
  },
});
