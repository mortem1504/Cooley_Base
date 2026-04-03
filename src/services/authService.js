import { getSupabaseClient } from './supabaseClient';

export const authHighlights = [
  { label: 'Nearby jobs', value: 'Walkable student gigs around campus' },
  { label: 'Fast trust', value: 'Verification badges and clear ratings' },
  { label: 'Quick pay', value: 'Short jobs with simple pricing upfront' },
];

function getClient() {
  return getSupabaseClient();
}

export async function getCurrentSession() {
  const client = getClient();
  const { data, error } = await client.auth.getSession();

  if (error) {
    throw error;
  }

  return data.session;
}

export function onAuthStateChange(callback) {
  const client = getClient();
  return client.auth.onAuthStateChange(callback);
}

export async function signInWithEmail({ email, password }) {
  const client = getClient();
  const { data, error } = await client.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function signUpWithEmail({ email, fullName, password, shortBio }) {
  const client = getClient();
  const { data, error } = await client.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      data: {
        full_name: fullName.trim(),
        short_bio: shortBio.trim(),
      },
    },
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function signOutUser() {
  const client = getClient();
  const { error } = await client.auth.signOut();

  if (error) {
    throw error;
  }
}

export async function fetchProfileById(userId) {
  const client = getClient();
  const { data, error } = await client
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function ensureProfileForUser(authUser) {
  const client = getClient();
  const profilePayload = {
    email: authUser.email,
    full_name: authUser.user_metadata?.full_name || '',
    short_bio: authUser.user_metadata?.short_bio || '',
  };

  const { error } = await client.from('profiles').upsert(
    {
      id: authUser.id,
      ...profilePayload,
    },
    { onConflict: 'id' }
  );

  if (error) {
    throw error;
  }
}
