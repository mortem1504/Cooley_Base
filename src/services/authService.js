import { getSupabaseClient } from './supabaseClient';

export const authHighlights = [
  { label: 'Nearby jobs', value: 'Walkable student gigs around campus' },
  { label: 'Fast trust', value: 'Verification badges and clear ratings' },
  { label: 'Quick pay', value: 'Short jobs with simple pricing upfront' },
];

const USERNAME_LOGIN_REPAIR_FILE = '004_username_support.sql';

function getClient() {
  return getSupabaseClient();
}

function normalizeIdentifier(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase();
}

function isMissingUsernameColumnError(error) {
  const message = error?.message || '';

  return (
    message.includes("Could not find the 'username' column of 'profiles' in the schema cache") ||
    message.includes('column "username" of relation "profiles" does not exist')
  );
}

function looksLikeEmail(value) {
  return value.includes('@');
}

function normalizeLoginLookupError(error) {
  const message = error?.message || '';

  if (
    message.includes('Could not find the function public.resolve_login_email') ||
    message.includes('function public.resolve_login_email') ||
    message.includes('column "username" does not exist')
  ) {
    return new Error(
      `Username login needs the latest Supabase migration. Run ${USERNAME_LOGIN_REPAIR_FILE}, or use your full email for now.`
    );
  }

  return error;
}

async function resolveLoginEmail(identifier) {
  const normalizedIdentifier = normalizeIdentifier(identifier);

  if (!normalizedIdentifier) {
    throw new Error('Enter your username or email to continue.');
  }

  if (looksLikeEmail(normalizedIdentifier)) {
    return normalizedIdentifier;
  }

  const client = getClient();
  const { data, error } = await client.rpc('resolve_login_email', {
    input_identifier: normalizedIdentifier,
  });

  if (error) {
    throw normalizeLoginLookupError(error);
  }

  if (!data) {
    throw new Error('We could not find that username. Try your full email instead.');
  }

  return data;
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

export async function signInWithIdentifier({ identifier, password }) {
  const email = await resolveLoginEmail(identifier);
  return signInWithEmail({ email, password });
}

export async function signUpWithEmail({ email, fullName, password, shortBio, username }) {
  const client = getClient();
  const { data, error } = await client.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      data: {
        full_name: fullName.trim(),
        short_bio: shortBio.trim(),
        username: normalizeUsername(username),
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
    username: normalizeUsername(authUser.user_metadata?.username || ''),
  };

  const { error } = await client.from('profiles').upsert(
    {
      id: authUser.id,
      ...profilePayload,
    },
    { onConflict: 'id' }
  );

  if (error && isMissingUsernameColumnError(error)) {
    const { username: _username, ...legacyProfilePayload } = profilePayload;
    const { error: legacyError } = await client.from('profiles').upsert(
      {
        id: authUser.id,
        ...legacyProfilePayload,
      },
      { onConflict: 'id' }
    );

    if (legacyError) {
      throw legacyError;
    }

    return;
  }

  if (error) {
    throw error;
  }
}
