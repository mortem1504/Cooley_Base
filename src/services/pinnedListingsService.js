import AsyncStorage from '@react-native-async-storage/async-storage';

const PINNED_LISTINGS_KEY_PREFIX = '@cooley_pinned_listings_';

function getStorageKey(userId) {
  return `${PINNED_LISTINGS_KEY_PREFIX}${userId}`;
}

/**
 * Load pinned listing IDs for a user from local storage.
 * @param {string} userId
 * @returns {Promise<string[]>}
 */
export async function loadPinnedListingIds(userId) {
  if (!userId) {
    return [];
  }

  try {
    const stored = await AsyncStorage.getItem(getStorageKey(userId));

    if (!stored) {
      return [];
    }

    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    return [];
  }
}

/**
 * Save pinned listing IDs for a user to local storage.
 * @param {string} userId
 * @param {string[]} listingIds
 * @returns {Promise<void>}
 */
export async function savePinnedListingIds(userId, listingIds) {
  if (!userId) {
    return;
  }

  const sanitized = Array.isArray(listingIds) ? listingIds : [];
  await AsyncStorage.setItem(getStorageKey(userId), JSON.stringify(sanitized));
}
