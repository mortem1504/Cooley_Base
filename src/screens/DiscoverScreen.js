import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import AppButton from '../components/AppButton';
import AppCard from '../components/AppCard';
import AppTextInput from '../components/AppTextInput';
import BrowseJobCard from '../components/BrowseJobCard';
import MapJobRow from '../components/MapJobRow';
import useAppState from '../hooks/useAppState';
import useScreenTopInset from '../hooks/useScreenTopInset';
import { ROOT_ROUTES } from '../navigation/routes';
import { buildMapRegion, isValidCoordinate } from '../services/locationService';
import { formatJobPrice } from '../utils/jobFormatters';
import { colors, radius, shadow, spacing } from '../utils/theme';

const DEFAULT_MAX_DISTANCE_KM = 25;
const DEFAULT_MAX_PRICE = 500;
const LISTING_FILTER_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: 'job', label: 'Jobs' },
  { key: 'rental', label: 'Item' },
];
const VIEW_OPTIONS = [
  { key: 'list', label: 'List' },
  { key: 'map', label: 'Map' },
];

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function matchesDiscoverSearch(listing, query) {
  if (!query) {
    return true;
  }

  const target = `${listing.title} ${listing.description} ${listing.category} ${listing.location}`.toLowerCase();
  return target.includes(query.trim().toLowerCase());
}

function getListingGroup(listing) {
  if (
    listing?.type === 'rental' ||
    listing?.listingMode === 'rent' ||
    listing?.listingMode === 'sell'
  ) {
    return 'item';
  }

  return 'job';
}

function isSellItemListing(listing) {
  return getListingGroup(listing) === 'item' && (
    listing?.listingMode === 'sell' || Boolean(listing?.instantAccept)
  );
}

function dedupeListings(collection) {
  const seenKeys = new Set();

  return collection.filter((listing) => {
    const nextKey = `${listing?.type || getListingGroup(listing)}:${listing?.id || ''}`;

    if (!listing?.id || seenKeys.has(nextKey)) {
      return false;
    }

    seenKeys.add(nextKey);
    return true;
  });
}

function SegmentedControl({ onChange, options, selectedValue }) {
  return (
    <View style={styles.segmentedControl}>
      {options.map((option) => {
        const isActive = selectedValue === option.key;

        return (
          <Pressable
            key={option.key}
            onPress={() => onChange(option.key)}
            style={[styles.segmentButton, isActive && styles.segmentButtonActive]}
          >
            <Text style={[styles.segmentText, isActive && styles.segmentTextActive]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function DiscoverScreen({ navigation }) {
  const {
    currentUser,
    filters,
    isListingsLoading,
    isLocationLoading,
    jobs,
    listingsNotice,
    locationNotice,
    refreshViewerLocation,
    rentals,
    resetFilters,
    setFilters,
    viewerLocation,
  } = useAppState();
  const [selectedListingFilter, setSelectedListingFilter] = useState('all');
  const [selectedView, setSelectedView] = useState('list');
  const mapRef = useRef(null);
  const topInset = useScreenTopInset(spacing.lg);
  const firstName = currentUser.name?.trim()?.split(' ')[0] || 'there';
  const allListings = useMemo(
    () =>
      dedupeListings([...jobs, ...rentals]).sort(
        (first, second) => (second.createdAt || 0) - (first.createdAt || 0)
      ),
    [jobs, rentals]
  );
  const visibleListings = useMemo(
    () =>
      allListings.filter((listing) => {
        const matchesType =
          selectedListingFilter === 'all' ||
          (selectedListingFilter === 'job' && getListingGroup(listing) === 'job') ||
          (selectedListingFilter === 'rental' && getListingGroup(listing) === 'item');
        const listingDistance = Number.isFinite(Number(listing.distance))
          ? Number(listing.distance)
          : DEFAULT_MAX_DISTANCE_KM;

        return (
          matchesType &&
          matchesDiscoverSearch(listing, filters.search) &&
          listing.price <= filters.maxPrice &&
          listingDistance <= filters.maxDistance
        );
      }),
    [allListings, filters.maxDistance, filters.maxPrice, filters.search, selectedListingFilter]
  );
  const mappableListings = useMemo(
    () =>
      visibleListings.filter(
        (listing) => isValidCoordinate(listing.latitude) && isValidCoordinate(listing.longitude)
      ),
    [visibleListings]
  );
  const mapRegion = useMemo(
    () =>
      buildMapRegion({
        jobs: mappableListings,
        viewerLocation,
      }),
    [mappableListings, viewerLocation]
  );
  const visibleJobCount = visibleListings.filter((listing) => getListingGroup(listing) === 'job').length;
  const visibleItemCount = visibleListings.filter((listing) => getListingGroup(listing) === 'item').length;
  const hasActiveFilters =
    Boolean(filters.search) ||
    filters.maxPrice < DEFAULT_MAX_PRICE ||
    filters.maxDistance < DEFAULT_MAX_DISTANCE_KM ||
    selectedListingFilter !== 'all';
  const activeListingLabel =
    selectedListingFilter === 'job'
      ? 'Jobs'
      : selectedListingFilter === 'rental'
        ? 'Items'
        : 'All listings';

  useEffect(() => {
    if (!mapRef.current || selectedView !== 'map') {
      return;
    }

    mapRef.current.animateToRegion(mapRegion, 450);
  }, [mapRegion, selectedView]);

  const handleSelectListingFilter = (nextFilter) => {
    if (nextFilter === selectedListingFilter) {
      return;
    }

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelectedListingFilter(nextFilter);
  };

  const handleSelectView = (nextView) => {
    if (nextView === selectedView) {
      return;
    }

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelectedView(nextView);
  };

  const handleResetDiscoverFilters = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelectedListingFilter('all');
    resetFilters();
  };

  const handleRecenter = async () => {
    try {
      const nextLocation = await refreshViewerLocation();
      const nextRegion = buildMapRegion({
        jobs: mappableListings,
        viewerLocation: nextLocation,
      });

      mapRef.current?.animateToRegion(nextRegion, 450);
    } catch (_error) {
      // The shared location notice already explains the failure.
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} stickyHeaderIndices={[1]} style={styles.container}>
      <View style={[styles.heroWrap, { paddingTop: topInset }]}>
        <AppCard style={styles.heroCard}>
          <Text style={styles.greeting}>Hello, {firstName}</Text>
          <Text style={styles.heading}>Discover nearby jobs and item listings.</Text>
          <Text style={styles.subheading}>
            Switch between cards and the map, then narrow the feed to just jobs, just items,
            or everything nearby.
          </Text>
          <AppTextInput
            onChangeText={(value) => setFilters((prev) => ({ ...prev, search: value }))}
            placeholder="Search jobs, cameras, books, delivery, moving"
            value={filters.search}
          />
        </AppCard>
      </View>

      <View style={styles.stickyHeader}>
        <View style={styles.controlGroup}>
          <Text style={styles.controlLabel}>Category</Text>
          <SegmentedControl
            onChange={handleSelectListingFilter}
            options={LISTING_FILTER_OPTIONS}
            selectedValue={selectedListingFilter}
          />
        </View>

        <View style={styles.controlGroup}>
          <Text style={styles.controlLabel}>View</Text>
          <SegmentedControl
            onChange={handleSelectView}
            options={VIEW_OPTIONS}
            selectedValue={selectedView}
          />
        </View>

        <View style={styles.quickFilterRow}>
          <Pressable
            onPress={() =>
              setFilters((prev) => ({
                ...prev,
                maxPrice: prev.maxPrice === DEFAULT_MAX_PRICE ? 100 : DEFAULT_MAX_PRICE,
              }))
            }
            style={styles.quickFilterPressable}
          >
            <AppCard style={styles.quickFilterCard}>
              <Text style={styles.quickFilterLabel}>Price</Text>
              <Text style={styles.quickFilterValue}>Up to ${filters.maxPrice}</Text>
            </AppCard>
          </Pressable>

          <Pressable
            onPress={() =>
              setFilters((prev) => ({
                ...prev,
                maxDistance: prev.maxDistance === DEFAULT_MAX_DISTANCE_KM ? 5 : DEFAULT_MAX_DISTANCE_KM,
              }))
            }
            style={styles.quickFilterPressable}
          >
            <AppCard style={styles.quickFilterCard}>
              <Text style={styles.quickFilterLabel}>Distance</Text>
              <Text style={styles.quickFilterValue}>{filters.maxDistance} km</Text>
            </AppCard>
          </Pressable>
        </View>
      </View>

      <View style={styles.bodyContent}>
        <View style={styles.statRow}>
          <AppCard style={styles.statCard}>
            <Text style={styles.statValue}>{visibleListings.length}</Text>
            <Text style={styles.statLabel}>Showing now</Text>
          </AppCard>
          <AppCard style={styles.statCard}>
            <Text style={styles.statValue}>{visibleJobCount}</Text>
            <Text style={styles.statLabel}>Jobs</Text>
          </AppCard>
          <AppCard style={styles.statCard}>
            <Text style={styles.statValue}>{visibleItemCount}</Text>
            <Text style={styles.statLabel}>Items</Text>
          </AppCard>
        </View>

        {isListingsLoading ? (
          <AppCard style={styles.messageCard}>
            <Text style={styles.messageTitle}>Loading nearby listings</Text>
            <Text style={styles.messageText}>Fetching the latest jobs and item posts for you.</Text>
          </AppCard>
        ) : listingsNotice ? (
          <AppCard style={styles.messageCard}>
            <Text style={styles.messageTitle}>Could not load listings</Text>
            <Text style={styles.messageText}>{listingsNotice}</Text>
          </AppCard>
        ) : selectedView === 'list' ? (
          <>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionCopy}>
                <Text style={styles.sectionTitle}>{activeListingLabel} near you</Text>
                <Text style={styles.sectionSubtitle}>
                  Showing {visibleListings.length} result{visibleListings.length === 1 ? '' : 's'} in
                  card view.
                </Text>
              </View>
              {hasActiveFilters ? (
                <Pressable onPress={handleResetDiscoverFilters}>
                  <Text style={styles.linkText}>Reset</Text>
                </Pressable>
              ) : null}
            </View>

            {visibleListings.length ? (
              visibleListings.map((listing) => (
                <BrowseJobCard
                  job={listing}
                  key={`${listing.type || getListingGroup(listing)}-${listing.id}`}
                  onPress={() => navigation.navigate(ROOT_ROUTES.JOB_DETAIL, { jobId: listing.id })}
                />
              ))
            ) : (
              <AppCard style={styles.messageCard}>
                <Text style={styles.messageTitle}>No listings match right now</Text>
                <Text style={styles.messageText}>
                  {hasActiveFilters
                    ? 'Try widening the price or distance filters, or switch back to All.'
                    : 'New campus jobs and item listings will show up here automatically.'}
                </Text>
                {hasActiveFilters ? (
                  <AppButton
                    label="Reset filters"
                    onPress={handleResetDiscoverFilters}
                    style={styles.resetButton}
                    variant="secondary"
                  />
                ) : null}
              </AppCard>
            )}
          </>
        ) : (
          <>
            <AppCard style={styles.mapCard}>
              <View style={styles.mapHeader}>
                <View style={styles.sectionCopy}>
                  <Text style={styles.sectionTitle}>{activeListingLabel} on the map</Text>
                  <Text style={styles.sectionSubtitle}>
                    Filtered pins update automatically as you switch tabs above.
                  </Text>
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
                  {mappableListings.map((listing) => (
                    <Marker
                      coordinate={{
                        latitude: Number(listing.latitude),
                        longitude: Number(listing.longitude),
                      }}
                      key={`${listing.type || getListingGroup(listing)}-${listing.id}`}
                      onPress={() => navigation.navigate(ROOT_ROUTES.JOB_DETAIL, { jobId: listing.id })}
                      title={listing.title}
                    >
                      <View
                        style={[
                          styles.markerBubble,
                          getListingGroup(listing) === 'item' &&
                            !isSellItemListing(listing) &&
                            styles.markerBubbleRent,
                          isSellItemListing(listing) && styles.markerBubbleSell,
                        ]}
                      >
                        <Text style={styles.markerPrice}>{formatJobPrice(listing.price)}</Text>
                      </View>
                    </Marker>
                  ))}
                </MapView>

                {locationNotice ? (
                  <View style={styles.mapNotice}>
                    <Text style={styles.mapNoticeText}>{locationNotice}</Text>
                  </View>
                ) : null}

                {!mappableListings.length ? (
                  <View style={styles.mapEmptyState}>
                    <Text style={styles.mapEmptyTitle}>No mappable listings yet</Text>
                    <Text style={styles.mapEmptyText}>
                      Listings with a real address will appear on the map automatically.
                    </Text>
                  </View>
                ) : null}
              </View>
            </AppCard>

            <AppCard style={styles.mapListCard}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionCopy}>
                  <Text style={styles.sectionTitle}>Pinned listings</Text>
                  <Text style={styles.sectionSubtitle}>
                    The same filtered results shown below the map.
                  </Text>
                </View>
                {hasActiveFilters ? (
                  <Pressable onPress={handleResetDiscoverFilters}>
                    <Text style={styles.linkText}>Reset</Text>
                  </Pressable>
                ) : null}
              </View>

              {visibleListings.length ? (
                visibleListings.map((listing) => (
                  <MapJobRow
                    job={listing}
                    key={`${listing.type || getListingGroup(listing)}-${listing.id}`}
                    onPress={() => navigation.navigate(ROOT_ROUTES.JOB_DETAIL, { jobId: listing.id })}
                  />
                ))
              ) : (
                <Text style={styles.messageText}>
                  No listings are available for this map view yet.
                </Text>
              )}
            </AppCard>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  heroWrap: {
    paddingHorizontal: spacing.lg,
  },
  heroCard: {
    gap: spacing.sm,
    padding: spacing.lg,
  },
  greeting: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  heading: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
  },
  subheading: {
    color: colors.secondaryText,
    fontSize: 14,
    lineHeight: 22,
  },
  stickyHeader: {
    backgroundColor: colors.background,
    borderBottomColor: 'rgba(217, 226, 242, 0.9)',
    borderBottomWidth: 1,
    gap: spacing.md,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  controlGroup: {
    gap: spacing.sm,
  },
  controlLabel: {
    color: colors.subtleText,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  segmentedControl: {
    backgroundColor: '#E3E8F2',
    borderColor: 'rgba(217, 226, 242, 0.95)',
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    padding: 5,
  },
  segmentButton: {
    alignItems: 'center',
    borderRadius: radius.pill,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  segmentButtonActive: {
    backgroundColor: colors.primary,
    ...shadow,
  },
  segmentText: {
    color: colors.subtleText,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  segmentTextActive: {
    color: colors.card,
  },
  quickFilterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  quickFilterPressable: {
    flex: 1,
  },
  quickFilterCard: {
    ...shadow,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  quickFilterLabel: {
    color: colors.subtleText,
    fontSize: 12,
  },
  quickFilterValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    marginTop: 4,
  },
  bodyContent: {
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  statRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    padding: spacing.md,
  },
  statValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  statLabel: {
    color: colors.subtleText,
    fontSize: 12,
    marginTop: 6,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  sectionCopy: {
    flex: 1,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  sectionSubtitle: {
    color: colors.secondaryText,
    fontSize: 13,
    marginTop: 4,
  },
  linkText: {
    color: colors.primary,
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
  markerBubble: {
    backgroundColor: colors.primary,
    borderColor: colors.card,
    borderRadius: radius.pill,
    borderWidth: 2,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  markerBubbleRent: {
    backgroundColor: '#D97904',
  },
  markerBubbleSell: {
    backgroundColor: '#23834C',
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
  mapEmptyState: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
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
  mapListCard: {
    gap: spacing.md,
    padding: spacing.lg,
  },
  messageCard: {
    gap: spacing.xs,
    padding: spacing.lg,
  },
  messageTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
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
