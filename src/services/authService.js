import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { getSupabaseClient } from './supabaseClient';

WebBrowser.maybeCompleteAuthSession();

export const authHighlights = [
  { label: 'Nearby jobs', value: 'Walkable student gigs around campus' },
  { label: 'Fast trust', value: 'Verification badges and clear ratings' },
  { label: 'Quick pay', value: 'Short jobs with simple pricing upfront' },
];

const USERNAME_LOGIN_REPAIR_FILE = '004_username_support.sql';
const GOOGLE_NATIVE_REDIRECT_URI = 'cooley://auth/callback';
export const GOOGLE_CANCELLED_ERROR = 'Google sign in was cancelled.';
const GOOGLE_BUILD_HINT =
  'Google sign in needs a Cooley development build or installed app because Expo Go cannot complete the redirect.';

function getClient() {
  return getSupabaseClient();
}

function normalizeIdentifier(value) {
  const normalizedValue = String(value || '').trim().toLowerCase();

  if (normalizedValue.includes('@') && !normalizedValue.startsWith('@')) {
    return normalizedValue;
  }

  return normalizedValue.replace(/^@+/, '');
}

function normalizeUsername(value) {
  return String(value || '')
    .trim()
    .replace(/^@+/, '')
    .toLowerCase();
}

function pickFullName(userMetadata) {
  if (!userMetadata) {
    return '';
  }

  if (userMetadata.full_name) {
    return String(userMetadata.full_name).trim();
  }

  if (userMetadata.name) {
    return String(userMetadata.name).trim();
  }

  return [userMetadata.given_name, userMetadata.family_name]
    .filter(Boolean)
    .join(' ')
    .trim();
}

function buildProfilePayload(authUser) {
  const userMetadata = authUser?.user_metadata || {};

  return {
    email: authUser?.email || '',
    full_name: pickFullName(userMetadata),
    short_bio: String(userMetadata.short_bio || '').trim(),
    username: normalizeUsername(userMetadata.username || ''),
  };
}

function parseOAuthCallbackParams(callbackUrl) {
  const parsedUrl = new URL(callbackUrl);
  const mergedParams = new URLSearchParams(parsedUrl.search || '');
  const hashParams = new URLSearchParams(
    parsedUrl.hash?.startsWith('#') ? parsedUrl.hash.slice(1) : parsedUrl.hash || ''
  );

  hashParams.forEach((value, key) => {
    mergedParams.set(key, value);
  });

  return Object.fromEntries(mergedParams.entries());
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
        short_bio: String(shortBio || '').trim(),
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

export async function signInWithGoogle() {
  const client = getClient();

  if (Platform.OS === 'web') {
    const { data, error } = await client.auth.signInWithOAuth({
      provider: 'google',
    });

    if (error) {
      throw error;
    }

    return data;
  }

  const { data, error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: {
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
      redirectTo: GOOGLE_NATIVE_REDIRECT_URI,
      skipBrowserRedirect: true,
    },
  });

  if (error) {
    throw error;
  }

  if (!data?.url) {
    throw new Error('Could not start Google sign in right now.');
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, GOOGLE_NATIVE_REDIRECT_URI);

  if (result.type !== 'success' || !result.url) {
    if (result.type === 'cancel' || result.type === 'dismiss') {
      throw new Error(GOOGLE_CANCELLED_ERROR);
    }

    throw new Error(GOOGLE_BUILD_HINT);
  }

  const callbackParams = parseOAuthCallbackParams(result.url);

  if (callbackParams.error_description || callbackParams.error) {
    throw new Error(callbackParams.error_description || callbackParams.error);
  }

  if (callbackParams.code) {
    const { data: codeData, error: codeError } = await client.auth.exchangeCodeForSession(
      callbackParams.code
    );

    if (codeError) {
      throw codeError;
    }

    return codeData;
  }

  if (!callbackParams.access_token || !callbackParams.refresh_token) {
    throw new Error('Google sign in did not return a valid session.');
  }

  const { data: sessionData, error: sessionError } = await client.auth.setSession({
    access_token: callbackParams.access_token,
    refresh_token: callbackParams.refresh_token,
  });

  if (sessionError) {
    throw sessionError;
  }

  return sessionData;
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
  const profilePayload = buildProfilePayload(authUser);

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
