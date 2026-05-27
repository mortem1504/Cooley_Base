import AsyncStorage from '@react-native-async-storage/async-storage';

function buildPinnedListingsStorageKey(userId) {
  return `cooley:pinned-listings:${userId || 'guest'}`;
}

export async function loadPinnedListingIds(userId) {
  const storageKey = buildPinnedListingsStorageKey(userId);
  const storedValue = await AsyncStorage.getItem(storageKey);

  if (!storedValue) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(storedValue);
    return Array.isArray(parsedValue) ? parsedValue.filter(Boolean) : [];
  } catch (_error) {
    return [];
  }
}

export async function savePinnedListingIds(userId, listingIds) {
  const storageKey = buildPinnedListingsStorageKey(userId);
  await AsyncStorage.setItem(storageKey, JSON.stringify(listingIds));
}
