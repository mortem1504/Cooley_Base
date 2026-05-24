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
import SidebarMenuButton from '../components/SidebarMenuButton';
import useAppState from '../hooks/useAppState';
import useScreenTopInset from '../hooks/useScreenTopInset';
import { useMainShell } from '../navigation/MainShellContext';
import { ROOT_ROUTES } from '../navigation/routes';
import { buildMapRegion } from '../services/locationService';
import { formatJobDistance, formatJobPrice } from '../utils/jobFormatters';
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

function getListingGroup(listing) {
  if (listing?.type === 'rental') {
    return 'item';
  }

  if (listing?.type === 'job') {
    return 'job';
  }

  if (listing?.listingMode === 'rent' || listing?.listingMode === 'sell') {
    return 'item';
  }

  return 'job';
}

function isSellItemListing(listing) {
  return getListingGroup(listing) === 'item' && (
    listing?.listingMode === 'sell' || Boolean(listing?.instantAccept)
  );
}

function filterListingsByType(collection, selectedFilter) {
  return collection.filter((listing) => {
    if (selectedFilter === 'job') {
      return getListingGroup(listing) === 'job';
    }

    if (selectedFilter === 'rental') {
      return getListingGroup(listing) === 'item';
    }

    return true;
  });
}

function buildClosestReasonChips(listing) {
  const reasons = [];

  if (Number.isFinite(Number(listing?.distance))) {
    reasons.push(`${formatJobDistance(listing.distance)} away`);
  }

  if (listing?.urgent) {
    reasons.push(
      getListingGroup(listing) === 'item'
        ? listing?.instantAccept
          ? 'Available now'
          : 'High demand nearby'
        : 'Urgent nearby'
    );
  }

  return reasons.slice(0, 2);
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
    listingsNotice,
    locationNotice,
    nearbyListings,
    nearbyMapListings,
    pinnedListings,
    refreshViewerLocation,
    resetFilters,
    setFilters,
    suggestedListings,
    recentNearbyListings,
    urgentNearbyListings,
    viewerLocation,
  } = useAppState();
  const {
    discoverSectionJumpRequest,
    openSidebar,
    setActiveDiscoverSectionKey,
  } = useMainShell();
  const [selectedListingFilter, setSelectedListingFilter] = useState('all');
  const [selectedView, setSelectedView] = useState('list');
  const mapRef = useRef(null);
  const scrollRef = useRef(null);
  const sectionLocalOffsetsRef = useRef({});
  const handledDiscoverJumpNonceRef = useRef(0);
  const topInset = useScreenTopInset(spacing.lg);
  const [stickyHeaderHeight, setStickyHeaderHeight] = useState(0);
  const [bodyContentOffsetY, setBodyContentOffsetY] = useState(0);
  const [sectionOffsets, setSectionOffsets] = useState({});
  const [activeSectionKey, setActiveSectionKey] = useState('suggested');
  const firstName = currentUser.name?.trim()?.split(' ')[0] || 'there';
  const visibleListings = useMemo(
    () => filterListingsByType(nearbyListings, selectedListingFilter),
    [nearbyListings, selectedListingFilter]
  );
  const mappableListings = useMemo(
    () => filterListingsByType(nearbyMapListings, selectedListingFilter),
    [nearbyMapListings, selectedListingFilter]
  );
  const visibleSuggestedListings = useMemo(
    () => filterListingsByType(suggestedListings, selectedListingFilter),
    [selectedListingFilter, suggestedListings]
  );
  const visibleRecentListings = useMemo(
    () => filterListingsByType(recentNearbyListings, selectedListingFilter),
    [recentNearbyListings, selectedListingFilter]
  );
  const visibleUrgentListings = useMemo(
    () => filterListingsByType(urgentNearbyListings, selectedListingFilter),
    [selectedListingFilter, urgentNearbyListings]
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
  const visiblePinnedListings = useMemo(
    () =>
      filterListingsByType(pinnedListings, selectedListingFilter),
    [pinnedListings, selectedListingFilter]
  );
  const featuredSuggestedListings = visibleSuggestedListings.slice(0, 3);
  const closestRightNowListings = visibleListings
    .filter((listing) => ['posted', 'available'].includes(listing.status) || listing.dbStatus === 'open')
    .slice(0, 3)
    .map((listing) => ({
      ...listing,
      suggestionReasons: buildClosestReasonChips(listing),
    }));
  const pulseListingsSource = visibleUrgentListings.length ? visibleUrgentListings : visibleRecentListings;
  const pulseListings = pulseListingsSource.slice(0, 3);
  const pulseSectionTitle = visibleUrgentListings.length ? 'Available now near you' : 'New nearby picks';
  const pulseSectionSubtitle = visibleUrgentListings.length
    ? 'Listings that need quicker attention around your area.'
    : 'Recently posted listings around you.';
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
  const locationSummaryText = viewerLocation?.address
    ? `Suggestions update around ${viewerLocation.address}.`
    : 'Turn on location to sharpen nearby suggestions and map ranking.';

  useEffect(() => {
    if (!mapRef.current || selectedView !== 'map') {
      return;
    }

    mapRef.current.animateToRegion(mapRegion, 450);
  }, [mapRegion, selectedView]);

  useEffect(() => {
    const nextOffsets = {};

    Object.entries(sectionLocalOffsetsRef.current).forEach(([key, localOffset]) => {
      nextOffsets[key] = bodyContentOffsetY + localOffset;
    });

    setSectionOffsets(nextOffsets);
  }, [bodyContentOffsetY]);

  useEffect(() => {
    if (selectedView === 'list') {
      setActiveDiscoverSectionKey(activeSectionKey);
      return;
    }

    setActiveDiscoverSectionKey('map');
  }, [activeSectionKey, selectedView, setActiveDiscoverSectionKey]);

  useEffect(() => {
    if (!discoverSectionJumpRequest?.nonce) {
      return;
    }

    if (handledDiscoverJumpNonceRef.current === discoverSectionJumpRequest.nonce) {
      return;
    }

    if (discoverSectionJumpRequest.key === 'map') {
      handledDiscoverJumpNonceRef.current = discoverSectionJumpRequest.nonce;
      if (selectedView !== 'map') {
        setSelectedView('map');
      }
      return;
    }

    if (selectedView !== 'list') {
      setSelectedView('list');
      return;
    }

    const targetOffset = sectionOffsets[discoverSectionJumpRequest.key];

    if (!Number.isFinite(targetOffset)) {
      return;
    }

    handledDiscoverJumpNonceRef.current = discoverSectionJumpRequest.nonce;
    handleJumpToSection(discoverSectionJumpRequest.key);
  }, [discoverSectionJumpRequest, sectionOffsets, selectedView]);

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

  const handleBodyContentLayout = ({ nativeEvent }) => {
    const nextY = nativeEvent.layout.y;
    setBodyContentOffsetY((prev) => (prev === nextY ? prev : nextY));
  };

  const handleSectionLayout = (key, localOffset) => {
    sectionLocalOffsetsRef.current[key] = localOffset;
    const nextAbsoluteOffset = bodyContentOffsetY + localOffset;

    setSectionOffsets((prev) => (
      prev[key] === nextAbsoluteOffset
        ? prev
        : {
            ...prev,
            [key]: nextAbsoluteOffset,
          }
    ));
  };

  const handleJumpToSection = (key) => {
    const targetOffset = sectionOffsets[key];

    if (!Number.isFinite(targetOffset)) {
      return;
    }

    const scrollTarget = Math.max(0, targetOffset - stickyHeaderHeight - spacing.md);
    scrollRef.current?.scrollTo({ animated: true, y: scrollTarget });
    setActiveSectionKey(key);
  };

  const handleScroll = ({ nativeEvent }) => {
    const orderedSectionKeys = ['suggested', 'closest', 'pulse', 'all'];
    const markerOffset = nativeEvent.contentOffset.y + stickyHeaderHeight + spacing.lg;
    let nextActiveKey = 'suggested';

    orderedSectionKeys.forEach((key) => {
      const targetOffset = sectionOffsets[key];

      if (Number.isFinite(targetOffset) && markerOffset >= targetOffset) {
        nextActiveKey = key;
      }
    });

    setActiveSectionKey((prev) => (prev === nextActiveKey ? prev : nextActiveKey));
  };

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      onScroll={handleScroll}
      ref={scrollRef}
      scrollEventThrottle={16}
      stickyHeaderIndices={[1]}
      style={styles.container}
    >
        <View style={[styles.heroWrap, { paddingTop: topInset }]}>
          <AppCard style={styles.heroCard}>
            <View style={styles.heroTopRow}>
              <SidebarMenuButton onPress={openSidebar} />
              <Text style={styles.greeting}>Hello, {firstName}</Text>
            </View>
            <AppTextInput
              onChangeText={(value) => setFilters((prev) => ({ ...prev, search: value }))}
              placeholder="Search jobs, cameras, books, delivery, moving"
              value={filters.search}
            />
            <View style={styles.locationSummaryRow}>
              <View style={styles.locationSummaryChip}>
                <Text style={styles.locationSummaryChipText}>
                  {viewerLocation ? 'Nearby mode on' : 'Location recommended'}
                </Text>
              </View>
              <Pressable onPress={handleRecenter}>
                <Text style={styles.locationSummaryAction}>
                  {isLocationLoading ? 'Refreshing...' : viewerLocation ? 'Refresh nearby' : 'Use my location'}
                </Text>
              </Pressable>
            </View>
            <Text style={styles.locationSummaryText}>{locationSummaryText}</Text>
          </AppCard>
        </View>

        <View
          onLayout={({ nativeEvent }) => setStickyHeaderHeight(nativeEvent.layout.height)}
          style={styles.stickyHeader}
        >
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

        <View
          onLayout={handleBodyContentLayout}
          style={styles.bodyContent}
        >
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
            <View onLayout={({ nativeEvent }) => handleSectionLayout('suggested', nativeEvent.layout.y)}>
              <AppCard style={styles.suggestionIntroCard}>
                <Text style={styles.suggestionIntroTitle}>Why these listings are suggested</Text>
                <Text style={styles.messageText}>
                  We rank nearby jobs and items using distance, freshness, urgency, and what you
                  search for.
                </Text>
              </AppCard>

              <View style={styles.sectionHeader}>
                <View style={styles.sectionCopy}>
                  <Text style={styles.sectionTitle}>Suggested for you</Text>
                  <Text style={styles.sectionSubtitle}>
                    Clear picks based on what is close, active, and relevant right now.
                  </Text>
                </View>
              </View>

              {featuredSuggestedListings.length ? (
                featuredSuggestedListings.map((listing) => (
                  <BrowseJobCard
                    job={listing}
                    key={`suggested-${listing.id}`}
                    onPress={() => navigation.navigate(ROOT_ROUTES.JOB_DETAIL, { jobId: listing.id })}
                    reasonChips={listing.suggestionReasons}
                  />
                ))
              ) : (
                <AppCard style={styles.messageCard}>
                  <Text style={styles.messageTitle}>Suggestions will appear here</Text>
                  <Text style={styles.messageText}>
                    {viewerLocation
                      ? 'As more open listings are posted nearby, we will highlight the best matches first.'
                      : 'Enable location and we will surface the best nearby jobs and items first.'}
                  </Text>
                </AppCard>
              )}
            </View>

            {closestRightNowListings.length ? (
              <View onLayout={({ nativeEvent }) => handleSectionLayout('closest', nativeEvent.layout.y)}>
                <AppCard style={styles.mapListCard}>
                  <View style={styles.sectionHeader}>
                    <View style={styles.sectionCopy}>
                      <Text style={styles.sectionTitle}>Closest right now</Text>
                      <Text style={styles.sectionSubtitle}>
                        The quickest listings to act on within your current distance filter.
                      </Text>
                    </View>
                  </View>

                  {closestRightNowListings.map((listing) => (
                    <MapJobRow
                      job={listing}
                      key={`closest-${listing.id}`}
                      onPress={() => navigation.navigate(ROOT_ROUTES.JOB_DETAIL, { jobId: listing.id })}
                      reasonChips={listing.suggestionReasons}
                    />
                  ))}
                </AppCard>
              </View>
            ) : null}

            {pulseListings.length ? (
              <View onLayout={({ nativeEvent }) => handleSectionLayout('pulse', nativeEvent.layout.y)}>
                <AppCard style={styles.mapListCard}>
                  <View style={styles.sectionHeader}>
                    <View style={styles.sectionCopy}>
                      <Text style={styles.sectionTitle}>{pulseSectionTitle}</Text>
                      <Text style={styles.sectionSubtitle}>{pulseSectionSubtitle}</Text>
                    </View>
                  </View>

                  {pulseListings.map((listing) => (
                    <MapJobRow
                      job={listing}
                      key={`pulse-${listing.id}`}
                      onPress={() => navigation.navigate(ROOT_ROUTES.JOB_DETAIL, { jobId: listing.id })}
                      reasonChips={listing.suggestionReasons}
                    />
                  ))}
                </AppCard>
              </View>
            ) : null}

            <View onLayout={({ nativeEvent }) => handleSectionLayout('all', nativeEvent.layout.y)}>
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
            </View>
          </>
        ) : (
          <>
            <AppCard style={styles.mapCard}>
              <View style={styles.mapHeader}>
                <View style={styles.sectionCopy}>
                  <Text style={styles.sectionTitle}>{activeListingLabel} on the map</Text>
                  <Text style={styles.sectionSubtitle}>
                    Pins update from the same nearby suggestion system used in list view.
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
                  <Text style={styles.sectionTitle}>Suggested on this map</Text>
                  <Text style={styles.sectionSubtitle}>
                    We explain each pick so users know why it appears here.
                  </Text>
                </View>
                {hasActiveFilters ? (
                  <Pressable onPress={handleResetDiscoverFilters}>
                    <Text style={styles.linkText}>Reset</Text>
                  </Pressable>
                ) : null}
              </View>

              {featuredSuggestedListings.length ? (
                featuredSuggestedListings.map((listing) => (
                  <MapJobRow
                    job={listing}
                    key={`map-suggested-${listing.id}`}
                    onPress={() => navigation.navigate(ROOT_ROUTES.JOB_DETAIL, { jobId: listing.id })}
                    reasonChips={listing.suggestionReasons}
                  />
                ))
              ) : (
                <Text style={styles.messageText}>
                  Move around the map or widen your distance filter to see more nearby suggestions.
                </Text>
              )}
            </AppCard>

            {visiblePinnedListings.length ? (
              <AppCard style={styles.mapListCard}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionCopy}>
                    <Text style={styles.sectionTitle}>Pinned listings</Text>
                    <Text style={styles.sectionSubtitle}>
                      Listings you saved for quick access later.
                    </Text>
                  </View>
                </View>

                {visiblePinnedListings.map((listing) => (
                  <MapJobRow
                    job={listing}
                    key={`pinned-${listing.id}`}
                    onPress={() => navigation.navigate(ROOT_ROUTES.JOB_DETAIL, { jobId: listing.id })}
                  />
                ))}
              </AppCard>
            ) : null}
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
    flex: 1,
  },
  heroTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  locationSummaryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  locationSummaryChip: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  locationSummaryChipText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  locationSummaryAction: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  locationSummaryText: {
    color: colors.secondaryText,
    fontSize: 13,
    lineHeight: 19,
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
  suggestionIntroCard: {
    gap: spacing.xs,
    padding: spacing.lg,
  },
  suggestionIntroTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
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
