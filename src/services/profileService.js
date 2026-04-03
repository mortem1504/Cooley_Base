export const skillTags = [
  'Campus runner',
  'Event support',
  'Flyer handout',
  'Queue helper',
  'Pickup and drop',
];

export const defaultSkills = ['Runner', 'Usher', 'Helper', 'Delivery'];

export const emptyUserProfile = {
  id: '',
  email: '',
  name: 'Student User',
  shortBio: 'Set up your profile to start finding nearby student jobs and rentals.',
  rating: 5,
  completedJobs: 0,
  skills: defaultSkills,
  isVerified: false,
  avatar: 'SU',
  avatarUrl: null,
  schoolName: 'Seoul Global University',
};

export function buildInitials(name) {
  return (name || 'Student User')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function buildCurrentUserProfile(authUser, profile) {
  const fullName =
    profile?.full_name || authUser?.user_metadata?.full_name || authUser?.email || emptyUserProfile.name;

  return {
    id: authUser?.id || profile?.id || emptyUserProfile.id,
    email: authUser?.email || profile?.email || emptyUserProfile.email,
    name: fullName,
    shortBio: profile?.short_bio || emptyUserProfile.shortBio,
    rating: Number(profile?.rating ?? emptyUserProfile.rating),
    completedJobs: Number(profile?.completed_jobs ?? emptyUserProfile.completedJobs),
    skills: Array.isArray(profile?.skills) && profile.skills.length ? profile.skills : defaultSkills,
    isVerified: Boolean(profile?.student_verified),
    avatar: buildInitials(fullName),
    avatarUrl: profile?.avatar_url || null,
    schoolName: profile?.school_name || emptyUserProfile.schoolName,
  };
}
