import { decode } from 'base64-arraybuffer';
import { getSupabaseClient } from './supabaseClient';

const LISTING_IMAGES_BUCKET = 'listing-images';
const AVATARS_BUCKET = 'avatars';

function stripBase64Prefix(value) {
  if (!value) {
    return '';
  }

  return value.includes(',') ? value.split(',').pop() : value;
}

function getPhotoUri(photo) {
  if (typeof photo === 'string') {
    return photo;
  }

  return photo?.uri || '';
}

function getPhotoFileName(photo) {
  if (typeof photo === 'string') {
    return '';
  }

  return photo?.fileName || '';
}

function inferExtension(photo) {
  const fileName = getPhotoFileName(photo);

  if (fileName.includes('.')) {
    return fileName.split('.').pop().toLowerCase();
  }

  const mimeType = typeof photo === 'string' ? '' : photo?.mimeType || '';

  if (mimeType.includes('/')) {
    const mimeExtension = mimeType.split('/').pop().toLowerCase();
    return mimeExtension === 'jpeg' ? 'jpg' : mimeExtension;
  }

  const uri = getPhotoUri(photo);
  const uriMatch = uri.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);

  if (uriMatch?.[1]) {
    return uriMatch[1].toLowerCase();
  }

  return 'jpg';
}

function inferMimeType(photo, extension) {
  const mimeType = typeof photo === 'string' ? '' : photo?.mimeType || '';

  if (mimeType.startsWith('image/')) {
    return mimeType;
  }

  if (extension === 'jpg' || extension === 'jpeg') {
    return 'image/jpeg';
  }

  return `image/${extension}`;
}

async function readPhotoArrayBuffer(photo) {
  const base64Payload = typeof photo === 'string' ? '' : stripBase64Prefix(photo?.base64 || '');

  if (base64Payload) {
    return decode(base64Payload);
  }

  const uri = getPhotoUri(photo);

  if (!uri) {
    throw new Error('Selected photo data is unavailable. Please choose the image again.');
  }

  const response = await fetch(uri);

  if (!response.ok) {
    throw new Error('One of the selected photos could not be read.');
  }

  return response.arrayBuffer();
}

async function removeUploadedListingImages(paths) {
  if (!paths.length) {
    return;
  }

  const client = getSupabaseClient();
  const { error } = await client.storage.from(LISTING_IMAGES_BUCKET).remove(paths);

  if (error) {
    throw error;
  }
}

export async function removeListingImagesByPaths(paths) {
  await removeUploadedListingImages(paths);
}

export async function uploadListingImages({ listingId, ownerId, photos }) {
  if (!photos?.length) {
    return [];
  }

  const client = getSupabaseClient();
  const uploadedPaths = [];
  const imageRows = [];

  try {
    for (const [index, photo] of photos.entries()) {
      const extension = inferExtension(photo);
      const mimeType = inferMimeType(photo, extension);
      const storagePath = `${ownerId}/${listingId}/${Date.now()}-${index + 1}.${extension}`;
      const fileBuffer = await readPhotoArrayBuffer(photo);

      const { error: uploadError } = await client.storage
        .from(LISTING_IMAGES_BUCKET)
        .upload(storagePath, fileBuffer, {
          contentType: mimeType,
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      uploadedPaths.push(storagePath);

      const { data: publicUrlData } = client.storage
        .from(LISTING_IMAGES_BUCKET)
        .getPublicUrl(storagePath);

      imageRows.push({
        listing_id: listingId,
        public_url: publicUrlData.publicUrl,
        sort_order: index,
        storage_path: storagePath,
      });
    }

    const { error: insertError } = await client.from('listing_images').insert(imageRows);

    if (insertError) {
      throw insertError;
    }

    return imageRows;
  } catch (error) {
    try {
      await removeUploadedListingImages(uploadedPaths);
    } catch (_cleanupError) {
      // Ignore cleanup failures so the original upload error is preserved.
    }

    throw new Error(error.message || 'We could not upload your listing photos.');
  }
}

export async function uploadUserAvatarImage({ photo, userId }) {
  if (!photo || !userId) {
    throw new Error('Choose a profile photo before saving your profile.');
  }

  const client = getSupabaseClient();

  try {
    const extension = inferExtension(photo);
    const mimeType = inferMimeType(photo, extension);
    const storagePath = `${userId}/avatar`;
    const fileBuffer = await readPhotoArrayBuffer(photo);

    const { error: uploadError } = await client.storage
      .from(AVATARS_BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data: publicUrlData } = client.storage
      .from(AVATARS_BUCKET)
      .getPublicUrl(storagePath);

    return publicUrlData.publicUrl;
  } catch (error) {
    throw new Error(error.message || 'We could not upload your profile photo.');
  }
}
