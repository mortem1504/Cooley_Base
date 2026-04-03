import * as Location from 'expo-location';

const DEFAULT_REGION = {
  latitude: 37.5665,
  latitudeDelta: 0.06,
  longitude: 126.978,
  longitudeDelta: 0.06,
};

function uniqueParts(parts) {
  return [...new Set(parts.filter(Boolean).map((part) => String(part).trim()))];
}

function buildStreetLine(address) {
  if (!address) {
    return '';
  }

  const streetNumber = address.streetNumber || '';
  const street = address.street || address.name || '';

  return [streetNumber, street].filter(Boolean).join(' ').trim();
}

function buildLocalityLine(address) {
  if (!address) {
    return '';
  }

  return [address.district, address.city || address.subregion, address.region]
    .filter(Boolean)
    .join(', ')
    .trim();
}

export function buildReadableAddress(address) {
  if (!address) {
    return '';
  }

  const streetLine = buildStreetLine(address);
  const localityLine = buildLocalityLine(address);
  const parts = uniqueParts([streetLine, localityLine, address.postalCode, address.country]);

  return parts.join(', ');
}

export function isValidCoordinate(value) {
  return Number.isFinite(Number(value));
}

export function calculateDistanceKm(origin, destination) {
  if (
    !origin ||
    !destination ||
    !isValidCoordinate(origin.latitude) ||
    !isValidCoordinate(origin.longitude) ||
    !isValidCoordinate(destination.latitude) ||
    !isValidCoordinate(destination.longitude)
  ) {
    return null;
  }

  const toRadians = (degrees) => (Number(degrees) * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const latitudeDelta = toRadians(Number(destination.latitude) - Number(origin.latitude));
  const longitudeDelta = toRadians(Number(destination.longitude) - Number(origin.longitude));
  const startLatitude = toRadians(origin.latitude);
  const endLatitude = toRadians(destination.latitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Number((earthRadiusKm * c).toFixed(1));
}

async function getLocationPermissionStatus() {
  const existingPermission = await Location.getForegroundPermissionsAsync();

  if (existingPermission.status === 'granted' || existingPermission.canAskAgain === false) {
    return existingPermission;
  }

  return Location.requestForegroundPermissionsAsync();
}

export async function getCurrentLocationSnapshot() {
  const permission = await getLocationPermissionStatus();

  if (permission.status !== 'granted') {
    throw new Error('Location access is off. Enable it to use nearby jobs and real addresses.');
  }

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  let resolvedAddress = null;

  try {
    const addressResults = await Location.reverseGeocodeAsync({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    });
    resolvedAddress = addressResults[0] || null;
  } catch (_error) {
    resolvedAddress = null;
  }

  return {
    address: buildReadableAddress(resolvedAddress) || 'Current location',
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    rawAddress: resolvedAddress,
  };
}

export async function resolveAddressFromInput(addressText) {
  const normalizedAddress = addressText.trim();

  if (!normalizedAddress) {
    throw new Error('Enter a valid address before publishing.');
  }

  const matches = await Location.geocodeAsync(normalizedAddress);

  if (!matches.length) {
    throw new Error('We could not find that address. Try a fuller street or campus address.');
  }

  const firstMatch = matches[0];
  let resolvedAddress = null;

  try {
    const reverseMatches = await Location.reverseGeocodeAsync({
      latitude: firstMatch.latitude,
      longitude: firstMatch.longitude,
    });
    resolvedAddress = reverseMatches[0] || null;
  } catch (_error) {
    resolvedAddress = null;
  }

  return {
    address: buildReadableAddress(resolvedAddress) || normalizedAddress,
    latitude: firstMatch.latitude,
    longitude: firstMatch.longitude,
    rawAddress: resolvedAddress,
  };
}

export function buildMapRegion({ jobs = [], viewerLocation } = {}) {
  const points = [];

  if (
    viewerLocation &&
    isValidCoordinate(viewerLocation.latitude) &&
    isValidCoordinate(viewerLocation.longitude)
  ) {
    points.push({
      latitude: Number(viewerLocation.latitude),
      longitude: Number(viewerLocation.longitude),
    });
  }

  jobs.forEach((job) => {
    if (isValidCoordinate(job.latitude) && isValidCoordinate(job.longitude)) {
      points.push({
        latitude: Number(job.latitude),
        longitude: Number(job.longitude),
      });
    }
  });

  if (!points.length) {
    return DEFAULT_REGION;
  }

  if (points.length === 1) {
    return {
      latitude: points[0].latitude,
      latitudeDelta: 0.014,
      longitude: points[0].longitude,
      longitudeDelta: 0.014,
    };
  }

  const latitudes = points.map((point) => point.latitude);
  const longitudes = points.map((point) => point.longitude);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);
  const latitudePadding = Math.max((maxLatitude - minLatitude) * 1.6, 0.02);
  const longitudePadding = Math.max((maxLongitude - minLongitude) * 1.6, 0.02);

  return {
    latitude: (minLatitude + maxLatitude) / 2,
    latitudeDelta: latitudePadding,
    longitude: (minLongitude + maxLongitude) / 2,
    longitudeDelta: longitudePadding,
  };
}
