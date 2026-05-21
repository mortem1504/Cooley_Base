import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const supabaseHostname = (() => {
  try {
    return new URL(supabaseUrl).hostname;
  } catch (_error) {
    return '';
  }
})();

export const supabaseAuthStorageKey = supabaseHostname
  ? `sb-${supabaseHostname.split('.')[0]}-auth-token`
  : 'supabase-auth-token';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: false,
        persistSession: true,
        storage: AsyncStorage,
      },
    })
  : null;

export function getSupabaseClient() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      'Supabase is not configured yet. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to your .env file.'
    );
  }

  return supabase;
}

export async function clearSupabaseAuthStorage() {
  const keysToRemove = [
    supabaseAuthStorageKey,
    `${supabaseAuthStorageKey}-code-verifier`,
    `${supabaseAuthStorageKey}-user`,
  ];

  await Promise.all(keysToRemove.map((key) => AsyncStorage.removeItem(key)));
}
