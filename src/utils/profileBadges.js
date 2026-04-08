const HANYANG_LOGO = require('../../assets/university-hanyang.png');

export const MAX_CUSTOM_BADGES = 5;
export const MAX_EQUIPPED_ACHIEVEMENTS = 3;

export const UNIVERSITY_BADGE_LIBRARY = {
  hanyang: {
    key: 'hanyang',
    label: 'Hanyang Verified',
    logo: HANYANG_LOGO,
    name: 'Hanyang University',
    tone: 'blue',
  },
};

export const ACHIEVEMENT_BADGE_LIBRARY = {
  top_rated: {
    description: 'Keep a 4.8+ rating with at least 3 reviews.',
    icon: '\u2605',
    key: 'top_rated',
    label: 'Top Rated',
    tone: 'gold',
  },
  hustler: {
    description: 'Complete 5 or more jobs or rentals.',
    icon: '\u26A1',
    key: 'hustler',
    label: 'Hustler',
    tone: 'blue',
  },
  fast_runner: {
    description: 'Complete 2 jobs with a 4.5+ rating.',
    icon: '\u27A6',
    key: 'fast_runner',
    label: 'Fast Runner',
    tone: 'green',
  },
};

function normalizeBadgeText(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ');
}

export function sanitizeCustomBadges(values, maxCount = MAX_CUSTOM_BADGES) {
  const seen = new Set();

  return (Array.isArray(values) ? values : [])
    .map(normalizeBadgeText)
    .filter(Boolean)
    .filter((value) => {
      const normalizedValue = value.toLowerCase();

      if (seen.has(normalizedValue)) {
        return false;
      }

      seen.add(normalizedValue);
      return true;
    })
    .slice(0, maxCount);
}

export function sanitizeSelectedAchievementBadges(
  values,
  maxCount = MAX_EQUIPPED_ACHIEVEMENTS
) {
  const allowedKeys = new Set(Object.keys(ACHIEVEMENT_BADGE_LIBRARY));
  const seen = new Set();

  return (Array.isArray(values) ? values : [])
    .map((value) => String(value || '').trim())
    .filter((value) => allowedKeys.has(value))
    .filter((value) => {
      if (seen.has(value)) {
        return false;
      }

      seen.add(value);
      return true;
    })
    .slice(0, maxCount);
}

export function inferUniversityKey({ email, schoolName, universityKey } = {}) {
  if (universityKey && UNIVERSITY_BADGE_LIBRARY[universityKey]) {
    return universityKey;
  }

  const target = `${schoolName || ''} ${email || ''}`.toLowerCase();

  if (target.includes('hanyang') || target.includes('hanyang.ac.kr')) {
    return 'hanyang';
  }

  return null;
}

export function resolveUniversityBadge(profile) {
  const universityKey = inferUniversityKey({
    email: profile?.email,
    schoolName: profile?.schoolName,
    universityKey: profile?.universityKey,
  });

  if (universityKey && UNIVERSITY_BADGE_LIBRARY[universityKey]) {
    return UNIVERSITY_BADGE_LIBRARY[universityKey];
  }

  return {
    key: 'verified_student',
    label: 'Verified Student',
    logo: null,
    name: profile?.schoolName || 'University Verified',
    tone: 'blue',
  };
}

export function getAchievementUnlockState({
  activeJobs = 0,
  completedJobs = 0,
  rating = 0,
  reviewCount = 0,
} = {}) {
  return {
    fast_runner: completedJobs >= 2 && rating >= 4.5,
    hustler: completedJobs >= 5 || activeJobs >= 5,
    top_rated: rating >= 4.8 && reviewCount >= 3,
  };
}

export function getAchievementBadgeCatalog(metrics = {}) {
  const unlockState = getAchievementUnlockState(metrics);

  return Object.values(ACHIEVEMENT_BADGE_LIBRARY).map((badge) => ({
    ...badge,
    isUnlocked: Boolean(unlockState[badge.key]),
  }));
}

export function getEquippedAchievementBadges(selectedKeys = [], metrics = {}) {
  const selectedKeySet = new Set(sanitizeSelectedAchievementBadges(selectedKeys));
  const catalog = getAchievementBadgeCatalog(metrics);
  const unlockedBadges = catalog.filter((badge) => badge.isUnlocked);
  const selectedUnlocked = unlockedBadges.filter((badge) => selectedKeySet.has(badge.key));

  if (selectedUnlocked.length) {
    return selectedUnlocked.slice(0, MAX_EQUIPPED_ACHIEVEMENTS);
  }

  return unlockedBadges.slice(0, MAX_EQUIPPED_ACHIEVEMENTS);
}
