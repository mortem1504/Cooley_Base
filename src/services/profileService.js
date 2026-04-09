import { getSupabaseClient } from './supabaseClient';
import {
  inferUniversityKey,
  sanitizeCustomBadges,
  sanitizeSelectedAchievementBadges,
} from '../utils/profileBadges';

export const defaultSkills = ['Runner', 'Usher', 'Helper', 'Delivery'];
export const defaultYearLevel = 'Year 1';
export const defaultIdCardColor = '#B9D9F7';

export const emptyUserProfile = {
  avatar: 'SU',
  avatarUrl: null,
  completedJobs: 0,
  customBadges: defaultSkills,
  email: '',
  id: '',
  idCardColor: defaultIdCardColor,
  isVerified: false,
  name: 'Student User',
  rating: 5,
  schoolName: 'Seoul Global University',
  selectedAchievementBadges: [],
  shortBio: 'Set up your profile to start finding nearby student jobs and rentals.',
  skills: defaultSkills,
  universityKey: null,
  username: '',
  yearLevel: defaultYearLevel,
};

function getArrayOrFallback(primaryValue, fallbackValue, defaultValue) {
  if (Array.isArray(primaryValue)) {
    return primaryValue;
  }

  if (Array.isArray(fallbackValue)) {
    return fallbackValue;
  }

  return defaultValue;
}

export function buildInitials(name) {
  return (name || 'Student User')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function normalizeUsername(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^@+/, '');
}

export function buildUserProfile(profile, fallback = {}) {
  const fullName = profile?.full_name || fallback.fullName || fallback.name || emptyUserProfile.name;
  const customBadges = sanitizeCustomBadges(
    getArrayOrFallback(
      profile?.custom_badges,
      fallback.customBadges,
      getArrayOrFallback(profile?.skills, fallback.skills, defaultSkills)
    )
  );
  const selectedAchievementBadges = sanitizeSelectedAchievementBadges(
    getArrayOrFallback(
      profile?.selected_achievement_badges,
      fallback.selectedAchievementBadges,
      []
    )
  );
  const schoolName = profile?.school_name || fallback.schoolName || emptyUserProfile.schoolName;
  const email = profile?.email || fallback.email || emptyUserProfile.email;
  const universityKey = inferUniversityKey({
    email,
    schoolName,
    universityKey: profile?.university_key || fallback.universityKey || null,
  });

  return {
    avatar: buildInitials(fullName),
    avatarUrl: profile?.avatar_url || fallback.avatarUrl || null,
    completedJobs: Number(
      profile?.completed_jobs ?? fallback.completedJobs ?? emptyUserProfile.completedJobs
    ),
    customBadges,
    email,
    id: profile?.id || fallback.id || emptyUserProfile.id,
    idCardColor: profile?.id_card_color || fallback.idCardColor || emptyUserProfile.idCardColor,
    isVerified: Boolean(profile?.student_verified ?? fallback.isVerified),
    name: fullName,
    rating: Number(profile?.rating ?? fallback.rating ?? emptyUserProfile.rating),
    schoolName,
    selectedAchievementBadges,
    shortBio: profile?.short_bio || fallback.shortBio || emptyUserProfile.shortBio,
    skills: customBadges,
    universityKey,
    username:
      profile?.username ||
      normalizeUsername(fallback.username || fallback.userName || emptyUserProfile.username),
    yearLevel: profile?.year_level || fallback.yearLevel || emptyUserProfile.yearLevel,
  };
}

export function buildCurrentUserProfile(authUser, profile) {
  return buildUserProfile(profile, {
    customBadges: defaultSkills,
    email: authUser?.email || emptyUserProfile.email,
    fullName: authUser?.user_metadata?.full_name || authUser?.email || emptyUserProfile.name,
    id: authUser?.id || emptyUserProfile.id,
    schoolName: authUser?.user_metadata?.school_name || emptyUserProfile.schoolName,
    shortBio: authUser?.user_metadata?.short_bio || emptyUserProfile.shortBio,
    universityKey: authUser?.user_metadata?.university_key || null,
    username: authUser?.user_metadata?.username || emptyUserProfile.username,
    yearLevel: authUser?.user_metadata?.year_level || emptyUserProfile.yearLevel,
  });
}

function normalizeProfileUpdateError(error) {
  const message = error?.message || 'We could not save your profile right now.';

  if (
    message.includes('duplicate key value violates unique constraint') &&
    message.includes('profiles_username')
  ) {
    return new Error('That username is already taken. Try a different one.');
  }

  return new Error(message);
}

function extractMissingProfilesColumn(error) {
  const message = error?.message || '';
  const schemaCacheMatch = message.match(/Could not find the '([^']+)' column of 'profiles'/);

  if (schemaCacheMatch?.[1]) {
    return schemaCacheMatch[1];
  }

  const relationMatch = message.match(/column "([^"]+)" of relation "profiles" does not exist/);
  return relationMatch?.[1] || null;
}

function mapProfileReviewRow(row) {
  const reviewer = row.reviewer || {};
  const reviewerName = reviewer.full_name || 'Student User';

  return {
    comment: row.comment || '',
    createdAt: new Date(row.created_at).getTime(),
    id: row.id,
    rating: Number(row.rating) || 0,
    requestId: row.request_id,
    revieweeId: row.reviewee_id,
    reviewer: {
      avatar: buildInitials(reviewerName),
      avatarUrl: reviewer.avatar_url || null,
      id: reviewer.id || row.reviewer_id,
      isVerified: Boolean(reviewer.student_verified),
      name: reviewerName,
      schoolName: reviewer.school_name || emptyUserProfile.schoolName,
    },
    reviewerId: row.reviewer_id,
  };
}

export function calculateAverageRating(reviews, fallbackRating = emptyUserProfile.rating) {
  if (!reviews?.length) {
    return Number(fallbackRating ?? emptyUserProfile.rating);
  }

  const ratingTotal = reviews.reduce((sum, review) => sum + (Number(review.rating) || 0), 0);
  return Number((ratingTotal / reviews.length).toFixed(1));
}

export async function fetchProfileReviews(userId) {
  if (!userId) {
    return [];
  }

  const client = getSupabaseClient();
  const { data, error } = await client
    .from('rental_reviews')
    .select(
      `
      id,
      request_id,
      reviewer_id,
      reviewee_id,
      rating,
      comment,
      created_at,
      reviewer:profiles!rental_reviews_reviewer_id_fkey (
        id,
        full_name,
        school_name,
        student_verified,
        avatar_url
      )
    `
    )
    .eq('reviewee_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []).map(mapProfileReviewRow);
}

export async function updateProfileById(userId, profileInput, fallbackProfile = {}) {
  const client = getSupabaseClient();
  const nextFullName =
    profileInput.fullName !== undefined
      ? String(profileInput.fullName || '').trim()
      : String(fallbackProfile.name || emptyUserProfile.name).trim();
  const nextAvatarUrl =
    profileInput.avatarUrl !== undefined
      ? profileInput.avatarUrl || null
      : fallbackProfile.avatarUrl || null;
  const nextShortBio =
    profileInput.shortBio !== undefined
      ? String(profileInput.shortBio || '').trim()
      : String(fallbackProfile.shortBio || emptyUserProfile.shortBio).trim();
  const nextUsername =
    profileInput.username !== undefined
      ? normalizeUsername(profileInput.username)
      : normalizeUsername(fallbackProfile.username || emptyUserProfile.username);
  const nextSchoolName =
    profileInput.schoolName !== undefined
      ? String(profileInput.schoolName || '').trim() || emptyUserProfile.schoolName
      : String(fallbackProfile.schoolName || emptyUserProfile.schoolName).trim();
  const nextYearLevel =
    profileInput.yearLevel !== undefined
      ? String(profileInput.yearLevel || '').trim() || emptyUserProfile.yearLevel
      : String(fallbackProfile.yearLevel || emptyUserProfile.yearLevel).trim();
  const nextIdCardColor =
    profileInput.idCardColor !== undefined
      ? profileInput.idCardColor || emptyUserProfile.idCardColor
      : fallbackProfile.idCardColor || emptyUserProfile.idCardColor;
  const nextCustomBadges = sanitizeCustomBadges(
    getArrayOrFallback(
      profileInput.customBadges,
      fallbackProfile.customBadges,
      getArrayOrFallback(profileInput.skills, fallbackProfile.skills, defaultSkills)
    )
  );
  const nextSelectedAchievementBadges = sanitizeSelectedAchievementBadges(
    getArrayOrFallback(
      profileInput.selectedAchievementBadges,
      fallbackProfile.selectedAchievementBadges,
      []
    )
  );
  const nextUniversityKey =
    profileInput.universityKey ||
    fallbackProfile.universityKey ||
    inferUniversityKey({
      email: fallbackProfile.email,
      schoolName: nextSchoolName,
    });

  const payload = {
    avatar_url: nextAvatarUrl,
    custom_badges: nextCustomBadges,
    full_name: nextFullName,
    id_card_color: nextIdCardColor,
    school_name: nextSchoolName,
    selected_achievement_badges: nextSelectedAchievementBadges,
    short_bio: nextShortBio,
    skills: nextCustomBadges,
    university_key: nextUniversityKey,
    updated_at: new Date().toISOString(),
    year_level: nextYearLevel,
    username: nextUsername,
  };
  const omittedFields = [];
  let nextPayload = { ...payload };

  while (true) {
    const { data, error } = await client
      .from('profiles')
      .update(nextPayload)
      .eq('id', userId)
      .select('*')
      .single();

    const missingColumn = extractMissingProfilesColumn(error);

    if (error && missingColumn && Object.prototype.hasOwnProperty.call(nextPayload, missingColumn)) {
      omittedFields.push(missingColumn);
      const { [missingColumn]: _omittedColumn, ...reducedPayload } = nextPayload;
      nextPayload = reducedPayload;
      continue;
    }

    if (error) {
      throw normalizeProfileUpdateError(error);
    }

    return {
      omittedFields,
      profile: buildUserProfile(data, fallbackProfile),
    };
  }
}
