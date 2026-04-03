export const postTypeOptions = [
  {
    key: 'job',
    title: 'Post a Job',
    subtitle: 'Need help? Find a student nearby',
    accent: '#2F80ED',
    accentSoft: '#EAF2FF',
    badge: 'J',
  },
  {
    key: 'rental',
    title: 'List a Rental',
    subtitle: 'Rent out your items & earn',
    accent: '#4A67F2',
    accentSoft: '#EEF1FF',
    badge: 'R',
  },
];

export const jobPostCategories = [
  'Quick Jobs',
  'Runner',
  'Events',
  'Moving',
  'Delivery',
  'Services',
  'Labor',
];

export const rentalPostCategories = [
  'Tech',
  'Camera',
  'Books',
  'Furniture',
  'Sports',
  'Study Gear',
];

export function normalizePickedPhoto(asset, index) {
  return {
    base64: asset.base64 || '',
    fileName: asset.fileName || `listing-photo-${index + 1}.jpg`,
    id: asset.assetId || `${asset.uri}-${index}`,
    mimeType: asset.mimeType || 'image/jpeg',
    uri: asset.uri,
  };
}

export function buildInitialPostForm(type) {
  return {
    title: '',
    description: '',
    budget: '',
    duration: '',
    location: '',
    locationDetails: null,
    category: type === 'job' ? jobPostCategories[0] : rentalPostCategories[0],
    urgent: false,
    photos: [],
  };
}

export function buildPostFormFromListing(listing) {
  return {
    title: listing?.title || '',
    description: listing?.description || '',
    budget:
      listing?.price || listing?.price === 0 ? String(listing.price) : '',
    duration: listing?.durationText || listing?.duration || '',
    location: listing?.location || '',
    locationDetails:
      listing?.latitude && listing?.longitude
        ? {
            address: listing.location || '',
            latitude: listing.latitude,
            longitude: listing.longitude,
          }
        : null,
    category:
      listing?.category ||
      (listing?.type === 'job' ? jobPostCategories[0] : rentalPostCategories[0]),
    urgent: Boolean(listing?.urgent),
    photos:
      listing?.images?.map((image) => ({
        existing: true,
        id: image.id,
        uri: image.url,
      })) || [],
  };
}
