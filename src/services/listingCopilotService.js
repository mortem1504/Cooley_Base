import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient';
import { jobPostCategories, rentalPostCategories } from './postService';

function getAllowedCategories(listingType) {
  return listingType === 'rental' ? rentalPostCategories : jobPostCategories;
}

function normalizeString(value) {
  return String(value || '').trim();
}

function normalizeWarnings(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeString(item))
    .filter(Boolean)
    .slice(0, 4);
}

export function buildListingCopilotPayload({
  listingType,
  listingMode,
  title,
  description,
  category,
  budget,
  duration,
  location,
  urgent,
  prompt,
}) {
  const normalizedListingType = listingType === 'rental' ? 'rental' : 'job';
  const normalizedListingMode =
    normalizedListingType === 'rental' && listingMode === 'sell' ? 'sell' : 'rent';
  const allowedCategories = getAllowedCategories(normalizedListingType);

  return {
    allowedCategories,
    draft: {
      budget: normalizeString(budget),
      category: allowedCategories.includes(category) ? category : allowedCategories[0],
      description: normalizeString(description),
      duration: normalizeString(duration),
      location: normalizeString(location),
      title: normalizeString(title),
      urgent: Boolean(urgent),
    },
    listingMode: normalizedListingMode,
    listingType: normalizedListingType,
    prompt: normalizeString(prompt),
  };
}

export function normalizeListingCopilotSuggestion(rawSuggestion, payload) {
  const allowedCategories = payload.allowedCategories || getAllowedCategories(payload.listingType);
  const nextCategory = normalizeString(rawSuggestion?.category);

  return {
    budget: normalizeString(rawSuggestion?.budget),
    category: allowedCategories.includes(nextCategory)
      ? nextCategory
      : payload.draft.category || allowedCategories[0],
    description: normalizeString(rawSuggestion?.description),
    duration:
      payload.listingType === 'rental' && payload.listingMode === 'sell'
        ? ''
        : normalizeString(rawSuggestion?.duration),
    qualityWarnings: normalizeWarnings(rawSuggestion?.qualityWarnings),
    title: normalizeString(rawSuggestion?.title),
    urgent:
      typeof rawSuggestion?.urgent === 'boolean'
        ? rawSuggestion.urgent
        : Boolean(payload.draft.urgent),
  };
}

export async function requestListingCopilotSuggestions(input) {
  if (!isSupabaseConfigured) {
    throw new Error(
      'Supabase is not configured yet. Add your project credentials before using AI Listing Copilot.'
    );
  }

  const payload = buildListingCopilotPayload(input);

  if (
    !payload.prompt &&
    !payload.draft.title &&
    !payload.draft.description &&
    !payload.draft.location
  ) {
    throw new Error('Add a short prompt or a few draft details first so AI has something to improve.');
  }

  const client = getSupabaseClient();
  const { data, error } = await client.functions.invoke('listing-copilot', {
    body: payload,
  });

  if (error) {
    throw new Error(error.message || 'We could not reach AI Listing Copilot right now.');
  }

  if (!data?.suggestion) {
    throw new Error('AI Listing Copilot did not return a usable suggestion.');
  }

  return normalizeListingCopilotSuggestion(data.suggestion, payload);
}
