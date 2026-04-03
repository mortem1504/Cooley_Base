import React, { useEffect, useMemo, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import AppButton from '../components/AppButton';
import AppCard from '../components/AppCard';
import MapJobRow from '../components/MapJobRow';
import useAppState from '../hooks/useAppState';
import { DISCOVER_ROUTES, ROOT_ROUTES } from '../navigation/routes';
import { buildMapRegion, isValidCoordinate } from '../services/locationService';
import { colors, radius, spacing } from '../utils/theme';
import { formatJobPrice } from '../utils/jobFormatters';

export default function MapBrowseScreen({ navigation }) {
  const {
    filteredJobs,
    filters,
    isListingsLoading,
    isLocationLoading,
    listingsNotice,
    locationNotice,
    resetFilters,
    refreshViewerLocation,
    setFilters,
    viewerLocation,
  } = useAppState();
  const mapRef = useRef(null);
  const mappableJobs = useMemo(
    () =>
      filteredJobs.filter(
        (job) => isValidCoordinate(job.latitude) && isValidCoordinate(job.longitude)
      ),
    [filteredJobs]
  );
  const mapRegion = useMemo(
    () =>
      buildMapRegion({
        jobs: mappableJobs,
        viewerLocation,
      }),
    [mappableJobs, viewerLocation]
  );
  const hasActiveFilters =
    Boolean(filters.search) ||
    filters.category !== 'All' ||
    filters.maxPrice < 500 ||
    filters.maxDistance < 25;

  useEffect(() => {
    if (!mapRef.current || !mapRegion) {
      return;
    }

    mapRef.current.animateToRegion(mapRegion, 450);
  }, [mapRegion]);

  const handleRecenter = async () => {
    try {
      const nextLocation = await refreshViewerLocation();
      const nextRegion = buildMapRegion({
        jobs: mappableJobs,
        viewerLocation: nextLocation,
      });

      mapRef.current?.animateToRegion(nextRegion, 450);
    } catch (_error) {
      // The location notice is already handled in shared state.
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.container}>
      <View style={styles.topRow}>
        <Pressable
          onPress={() =>
            setFilters((prev) => ({
              ...prev,
              maxDistance: prev.maxDistance === 25 ? 5 : 25,
            }))
          }
          style={styles.filterPressable}
        >
          <AppCard style={styles.filterCard}>
            <Text style={styles.filterLabel}>Distance {filters.maxDistance} km</Text>
          </AppCard>
        </Pressable>
        <Pressable
          onPress={() =>
            setFilters((prev) => ({
              ...prev,
              maxPrice: prev.maxPrice === 500 ? 100 : 500,
            }))
          }
          style={styles.filterPressable}
        >
          <AppCard style={styles.filterCard}>
            <Text style={styles.filterLabel}>Price up to ${filters.maxPrice}</Text>
          </AppCard>
        </Pressable>
      </View>

      <AppCard style={styles.mapCard}>
        <View style={styles.mapHeader}>
          <View style={styles.mapCopy}>
            <Text style={styles.mapLabel}>Live map</Text>
            <Text style={styles.mapHint}>Tap a blue pin to open the job.</Text>
          </View>
          <Pressable onPress={handleRecenter} style={styles.recenterChip}>
            <Text style={styles.recenterChipText}>
              {isLocationLoading ? 'Locating...' : 'Near me'}
            </Text>
          </Pressable>
        </View>
        <View style={styles.mapSurface}>
          <MapView
            initialRegion={mapRegion}
            ref={mapRef}
            showsMyLocationButton={false}
            showsUserLocation={Boolean(viewerLocation)}
            style={StyleSheet.absoluteFillObject}
            toolbarEnabled={false}
          >
            {mappableJobs.map((job) => (
              <Marker
                coordinate={{
                  latitude: Number(job.latitude),
                  longitude: Number(job.longitude),
                }}
                key={job.id}
                onPress={() => navigation.navigate(ROOT_ROUTES.JOB_DETAIL, { jobId: job.id })}
                title={job.title}
              >
                <View style={styles.markerBubble}>
                  <Text style={styles.markerPrice}>{formatJobPrice(job.price)}</Text>
                </View>
              </Marker>
            ))}
          </MapView>

          {locationNotice ? (
            <View style={styles.mapNotice}>
              <Text style={styles.mapNoticeText}>{locationNotice}</Text>
            </View>
          ) : null}

          {!mappableJobs.length ? (
            <View style={styles.mapEmptyState}>
              <Text style={styles.mapEmptyTitle}>No exact-address jobs yet</Text>
              <Text style={styles.mapEmptyText}>
                New posts with real addresses will appear here automatically.
              </Text>
            </View>
          ) : null}
        </View>
      </AppCard>

      <AppCard style={styles.bottomCard}>
        <View style={styles.bottomHeader}>
          <Text style={styles.sectionTitle}>Pinned nearby jobs</Text>
          <Pressable onPress={() => navigation.navigate(DISCOVER_ROUTES.LIST)}>
            <Text style={styles.linkText}>Switch to list</Text>
          </Pressable>
        </View>
        {isListingsLoading ? (
          <Text style={styles.messageText}>Loading map listings...</Text>
        ) : listingsNotice ? (
          <Text style={styles.messageText}>{listingsNotice}</Text>
        ) : filteredJobs.length ? (
          filteredJobs.map((job) => (
            <MapJobRow
              job={job}
              key={job.id}
              onPress={() => navigation.navigate(ROOT_ROUTES.JOB_DETAIL, { jobId: job.id })}
            />
          ))
        ) : (
          <>
            <Text style={styles.messageText}>No jobs are available for this map view yet.</Text>
            {hasActiveFilters ? (
              <AppButton
                label="Reset filters"
                onPress={resetFilters}
                style={styles.resetButton}
                variant="secondary"
              />
            ) : null}
          </>
        )}
      </AppCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
  },
  content: {
    gap: spacing.lg,
    padding: spacing.lg,
  },
  topRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  filterPressable: {
    flex: 1,
  },
  filterCard: {
    alignItems: 'center',
    borderRadius: radius.pill,
    paddingVertical: 12,
  },
  filterLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  mapCard: {
    gap: spacing.sm,
    padding: spacing.lg,
  },
  mapHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  mapCopy: {
    flex: 1,
  },
  mapLabel: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  mapHint: {
    color: colors.secondaryText,
    fontSize: 13,
  },
  mapSurface: {
    backgroundColor: colors.mapBase,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    height: 360,
    marginTop: spacing.sm,
    overflow: 'hidden',
    position: 'relative',
  },
  mapEmptyState: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.86)',
    borderRadius: radius.md,
    left: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    position: 'absolute',
    right: spacing.lg,
    top: spacing.lg,
  },
  mapEmptyTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  mapEmptyText: {
    color: colors.secondaryText,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
    textAlign: 'center',
  },
  mapNotice: {
    backgroundColor: 'rgba(12, 24, 44, 0.72)',
    borderRadius: radius.md,
    bottom: spacing.md,
    left: spacing.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    position: 'absolute',
    right: spacing.md,
  },
  mapNoticeText: {
    color: colors.card,
    fontSize: 12,
    lineHeight: 18,
  },
  markerBubble: {
    backgroundColor: colors.primary,
    borderColor: colors.card,
    borderRadius: radius.pill,
    borderWidth: 2,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  markerPrice: {
    color: colors.card,
    fontSize: 12,
    fontWeight: '800',
  },
  recenterChip: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  recenterChipText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  bottomCard: {
    gap: spacing.md,
    padding: spacing.lg,
  },
  bottomHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  linkText: {
    color: colors.primary,
    fontWeight: '700',
  },
  messageText: {
    color: colors.secondaryText,
    fontSize: 14,
    lineHeight: 21,
  },
  resetButton: {
    marginTop: spacing.sm,
  },
});
