import { getSupabaseClient } from './supabaseClient';
import { removeListingImagesByPaths, uploadListingImages } from './storageService';

const LISTING_SELECT = `
  id,
  owner_id,
  type,
  title,
  description,
  category,
  price,
  duration_text,
  location_name,
  latitude,
  longitude,
  starts_at,
  urgent,
  instant_accept,
  status,
  created_at,
  updated_at,
  owner:profiles!listings_owner_id_fkey (
    id,
    full_name,
    rating,
    school_name,
    student_verified,
    avatar_url
  ),
  images:listing_images (
    id,
    storage_path,
    public_url,
    sort_order
  )
`;

function hashValue(value) {
  return String(value)
    .split('')
    .reduce((total, char, index) => total + char.charCodeAt(0) * (index + 1), 0);
}

function buildFallbackCoordinates(seed) {
  const top = 20 + (seed % 50);
  const left = 18 + ((seed * 7) % 58);

  return {
    top: `${Math.min(top, 76)}%`,
    left: `${Math.min(left, 78)}%`,
  };
}

function buildFallbackDistance(seed) {
  return Number((0.3 + (seed % 18) * 0.1).toFixed(1));
}

function normalizeCoordinate(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function buildUiStatus(type, dbStatus) {
  if (dbStatus === 'open') {
    return type === 'job' ? 'posted' : 'live';
  }

  if (dbStatus === 'in_progress') {
    return 'in progress';
  }

  return dbStatus || (type === 'job' ? 'posted' : 'live');
}

function buildDbStatus(uiStatus) {
  if (uiStatus === 'posted' || uiStatus === 'live') {
    return 'open';
  }

  if (uiStatus === 'in progress') {
    return 'in_progress';
  }

  return uiStatus;
}

function buildWhenParts(row) {
  if (row.starts_at) {
    const startDate = new Date(row.starts_at);

    return {
      date: new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
      }).format(startDate),
      time: new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      }).format(startDate),
    };
  }

  if (row.type === 'job') {
    return {
      date: row.urgent ? 'ASAP' : 'Flexible',
      time: row.duration_text || 'TBD',
    };
  }

  return {
    date: row.urgent ? 'Available now' : 'Open',
    time: row.duration_text || 'Flexible',
  };
}

function buildListingImages(row) {
  return [...(row.images || [])]
    .sort((first, second) => first.sort_order - second.sort_order)
    .map((image) => ({
      id: image.id,
      sortOrder: image.sort_order,
      storagePath: image.storage_path,
      url: image.public_url,
    }));
}

async function deleteListingRecord(listingId) {
  const client = getSupabaseClient();
  const { error } = await client.from('listings').delete().eq('id', listingId);

  if (error) {
    throw error;
  }
}

export function mapListingRowToAppListing(row) {
  const seed = hashValue(row.id);
  const whenParts = buildWhenParts(row);
  const owner = row.owner || {};
  const images = buildListingImages(row);

  return {
    id: row.id,
    createdAt: new Date(row.created_at).getTime(),
    createdBy: row.owner_id,
    type: row.type,
    title: row.title,
    description: row.description,
    price: Number(row.price) || 0,
    location: row.location_name,
    distance: buildFallbackDistance(seed),
    category: row.category,
    date: whenParts.date,
    time: whenParts.time,
    urgent: Boolean(row.urgent),
    instantAccept: Boolean(row.instant_accept),
    status: buildUiStatus(row.type, row.status),
    dbStatus: row.status,
    coverImageUrl: images[0]?.url || null,
    durationText: row.duration_text,
    duration: row.duration_text,
    imageCount: images.length,
    imageUrls: images.map((image) => image.url),
    images,
    startsAt: row.starts_at,
    latitude: normalizeCoordinate(row.latitude),
    longitude: normalizeCoordinate(row.longitude),
    coordinates: buildFallbackCoordinates(seed),
    requester: {
      name: owner.full_name || 'Student User',
      rating: Number(owner.rating ?? 5),
      school: owner.school_name || 'Seoul Global University',
    },
    owner: {
      id: owner.id || row.owner_id,
      name: owner.full_name || 'Student User',
      rating: Number(owner.rating ?? 5),
      school: owner.school_name || 'Seoul Global University',
      isVerified: Boolean(owner.student_verified),
      avatarUrl: owner.avatar_url || null,
    },
  };
}

export async function fetchListings() {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('listings')
    .select(LISTING_SELECT)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []).map(mapListingRowToAppListing);
}

export async function fetchListingById(listingId) {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('listings')
    .select(LISTING_SELECT)
    .eq('id', listingId)
    .single();

  if (error) {
    throw error;
  }

  return mapListingRowToAppListing(data);
}

export async function createListing({
  ownerId,
  type,
  title,
  description,
  category,
  price,
  durationText,
  locationName,
  latitude = null,
  longitude = null,
  urgent = false,
  instantAccept = false,
  photos = [],
}) {
  const client = getSupabaseClient();
  const payload = {
    owner_id: ownerId,
    type,
    title: title.trim(),
    description: description.trim(),
    category,
    price: Number(price) || 0,
    duration_text: durationText?.trim() || null,
    location_name: locationName.trim(),
    latitude: normalizeCoordinate(latitude),
    longitude: normalizeCoordinate(longitude),
    urgent,
    instant_accept: instantAccept,
    status: 'open',
  };

  const { data, error } = await client
    .from('listings')
    .insert(payload)
    .select('id')
    .single();

  if (error) {
    throw error;
  }

  try {
    await uploadListingImages({
      listingId: data.id,
      ownerId,
      photos,
    });
  } catch (uploadError) {
    try {
      await deleteListingRecord(data.id);
    } catch (_cleanupError) {
      // Ignore cleanup failures so the original upload error is preserved.
    }

    throw uploadError;
  }

  return fetchListingById(data.id);
}

export async function updateListingDetails({
  listingId,
  title,
  description,
  category,
  price,
  durationText,
  locationName,
  latitude = null,
  longitude = null,
  urgent = false,
  instantAccept = false,
}) {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('listings')
    .update({
      title: title.trim(),
      description: description.trim(),
      category,
      price: Number(price) || 0,
      duration_text: durationText?.trim() || null,
      location_name: locationName.trim(),
      latitude: normalizeCoordinate(latitude),
      longitude: normalizeCoordinate(longitude),
      urgent,
      instant_accept: instantAccept,
      updated_at: new Date().toISOString(),
    })
    .eq('id', listingId)
    .select(LISTING_SELECT)
    .single();

  if (error) {
    throw error;
  }

  return mapListingRowToAppListing(data);
}

export async function deleteOwnedListing({ imagePaths = [], listingId }) {
  const client = getSupabaseClient();
  const { error } = await client.from('listings').delete().eq('id', listingId);

  if (error) {
    throw error;
  }

  if (imagePaths.length) {
    try {
      await removeListingImagesByPaths(imagePaths);
    } catch (_error) {
      // Ignore storage cleanup failures so the listing deletion still succeeds.
    }
  }
}

export async function updateListingStatus(listingId, uiStatus) {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('listings')
    .update({
      status: buildDbStatus(uiStatus),
      updated_at: new Date().toISOString(),
    })
    .eq('id', listingId)
    .select(LISTING_SELECT)
    .single();

  if (error) {
    throw error;
  }

  return mapListingRowToAppListing(data);
}
