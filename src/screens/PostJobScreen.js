import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import AppButton from '../components/AppButton';
import AppCard from '../components/AppCard';
import AppTextInput from '../components/AppTextInput';
import useAppState from '../hooks/useAppState';
import useScreenTopInset from '../hooks/useScreenTopInset';
import { TAB_ROUTES } from '../navigation/routes';
import { resolveAddressFromInput } from '../services/locationService';
import {
  buildPostFormFromListing,
  buildInitialPostForm,
  jobPostCategories,
  normalizePickedPhoto,
  postTypeOptions,
  rentalPostCategories,
} from '../services/postService';
import { colors, radius, shadow } from '../utils/theme';

function PostTypeCard({ option, onPress }) {
  return (
    <Pressable onPress={onPress}>
      <AppCard style={styles.typeCard}>
        <View style={[styles.typeIconWrap, { backgroundColor: option.accentSoft }]}>
          <Text style={[styles.typeIconText, { color: option.accent }]}>{option.badge}</Text>
        </View>
        <View style={styles.typeCopy}>
          <Text style={styles.typeTitle}>{option.title}</Text>
          <Text style={styles.typeSubtitle}>{option.subtitle}</Text>
        </View>
        <Text style={styles.typeArrow}>{'>'}</Text>
      </AppCard>
    </Pressable>
  );
}

function PostTypeTab({ active, onPress, title }) {
  return (
    <Pressable onPress={onPress} style={[styles.modeTab, active && styles.modeTabActive]}>
      <Text style={[styles.modeTabText, active && styles.modeTabTextActive]}>{title}</Text>
    </Pressable>
  );
}

function CategoryChip({ active, label, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.categoryChip, active && styles.categoryChipActive]}>
      <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function SectionLabel({ children }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

function formatStatus(status) {
  return String(status || '')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function CurrentListingCard({ listing, onPress }) {
  return (
    <Pressable onPress={onPress}>
      <AppCard style={styles.currentListingCard}>
        <View style={styles.currentListingHeader}>
          <View
            style={[
              styles.currentListingTypePill,
              listing.type === 'rental' && styles.currentListingTypePillAlt,
            ]}
          >
            <Text
              style={[
                styles.currentListingTypeText,
                listing.type === 'rental' && styles.currentListingTypeTextAlt,
              ]}
            >
              {listing.type === 'job' ? 'Job' : 'Rental'}
            </Text>
          </View>
          <Text style={styles.currentListingStatus}>{formatStatus(listing.status)}</Text>
        </View>
        <Text style={styles.currentListingTitle}>{listing.title}</Text>
        <Text style={styles.currentListingMeta}>
          {listing.category} - {listing.location}
        </Text>
        <View style={styles.currentListingFooter}>
          <Text style={styles.currentListingPrice}>${listing.price}</Text>
          <Text style={styles.currentListingAction}>Tap to edit</Text>
        </View>
      </AppCard>
    </Pressable>
  );
}

export default function PostJobScreen({ navigation, route }) {
  const {
    getListingForEdit,
    isLocationLoading,
    locationNotice,
    myListings,
    postJob,
    postRental,
    resetFilters,
    refreshViewerLocation,
    removeOwnedListing,
    updateOwnedListing,
    viewerLocation,
  } = useAppState();
  const topInset = useScreenTopInset(12);
  const [selectedType, setSelectedType] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResolvingLocation, setIsResolvingLocation] = useState(false);
  const [forms, setForms] = useState({
    job: buildInitialPostForm('job'),
    rental: buildInitialPostForm('rental'),
  });
  const editListingId = route?.params?.editListingId || null;
  const editingListing = editListingId ? getListingForEdit(editListingId) : null;
  const isEditing = Boolean(editingListing);

  const activeForm = selectedType ? forms[selectedType] : null;
  const activeCategories = selectedType === 'rental' ? rentalPostCategories : jobPostCategories;
  const activeOption = postTypeOptions.find((option) => option.key === selectedType);
  const canSubmit = !isSubmitting && Boolean(
    activeForm &&
      activeForm.title.trim() &&
      activeForm.description.trim() &&
      activeForm.budget.trim() &&
      activeForm.duration.trim() &&
      activeForm.location.trim()
  );

  useEffect(() => {
    if (!editingListing) {
      return;
    }

    setSelectedType(editingListing.type);
    setForms((prev) => ({
      ...prev,
      [editingListing.type]: buildPostFormFromListing(editingListing),
    }));
  }, [editingListing]);

  const clearEditIntent = () => {
    if (route?.params?.editListingId) {
      navigation.setParams({ editListingId: undefined });
    }
  };

  const openListingEditor = (listingId) => {
    const listing = getListingForEdit(listingId);

    if (!listing) {
      Alert.alert('Listing unavailable', 'We could not load this listing for editing.');
      return;
    }

    navigation.setParams({ editListingId: listingId });
    setSelectedType(listing.type);
    setForms((prev) => ({
      ...prev,
      [listing.type]: buildPostFormFromListing(listing),
    }));
  };

  const updateForm = (key, value) => {
    setForms((prev) => ({
      ...prev,
      [selectedType]: {
        ...prev[selectedType],
        [key]: value,
      },
    }));
  };

  const updateLocationInput = (value) => {
    setForms((prev) => ({
      ...prev,
      [selectedType]: {
        ...prev[selectedType],
        location: value,
        locationDetails: null,
      },
    }));
  };

  const goBack = () => {
    if (isEditing) {
      clearEditIntent();
      setSelectedType(null);
      return;
    }

    if (selectedType) {
      setSelectedType(null);
      return;
    }

    navigation.navigate(TAB_ROUTES.DISCOVER);
  };

  const pickPhotos = async () => {
    if (isEditing) {
      Alert.alert('Photos stay the same for now', 'Edit the listing details below. Photo replacement can be added next.');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: false,
        allowsMultipleSelection: true,
        base64: true,
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        selectionLimit: 4,
      });

      if (result.canceled) {
        return;
      }

      updateForm(
        'photos',
        result.assets.map((asset, index) => normalizePickedPhoto(asset, index))
      );
    } catch (error) {
      Alert.alert('Photo access failed', 'Please try selecting your photos again.');
    }
  };

  const useCurrentAddress = async () => {
    setIsResolvingLocation(true);

    try {
      const nextLocation = viewerLocation || (await refreshViewerLocation());

      if (!nextLocation) {
        throw new Error('We could not load your current address yet.');
      }

      setForms((prev) => ({
        ...prev,
        [selectedType]: {
          ...prev[selectedType],
          location: nextLocation.address,
          locationDetails: nextLocation,
        },
      }));
    } catch (error) {
      Alert.alert('Location unavailable', error.message || 'Please enter an address manually.');
    } finally {
      setIsResolvingLocation(false);
    }
  };

  const submit = async () => {
    if (!canSubmit) {
      Alert.alert('Missing details', 'Please complete the form before reviewing your post.');
      return;
    }

    setIsSubmitting(true);

    try {
      const locationInput = activeForm.location.trim();
      const hasResolvedLocation =
        activeForm.locationDetails &&
        activeForm.locationDetails.address &&
        activeForm.locationDetails.address.toLowerCase() === locationInput.toLowerCase();
      const resolvedLocation = hasResolvedLocation
        ? activeForm.locationDetails
        : await resolveAddressFromInput(locationInput);

      if (isEditing && editingListing) {
        await updateOwnedListing(editingListing.id, {
          title: activeForm.title,
          description: activeForm.description,
          category: activeForm.category,
          budget: activeForm.budget,
          duration: activeForm.duration,
          location: resolvedLocation.address,
          latitude: resolvedLocation.latitude,
          longitude: resolvedLocation.longitude,
          price: activeForm.budget,
          time: activeForm.duration,
          urgent: activeForm.urgent,
        });

        Alert.alert('Listing updated', 'Your listing details are now live.');
        clearEditIntent();
        setForms((prev) => ({
          ...prev,
          [editingListing.type]: buildInitialPostForm(editingListing.type),
        }));
        setSelectedType(null);
        return;
      }

      if (selectedType === 'job') {
        const newJob = await postJob({
          title: activeForm.title,
          description: activeForm.description,
          price: activeForm.budget,
          location: resolvedLocation.address,
          latitude: resolvedLocation.latitude,
          longitude: resolvedLocation.longitude,
          date: activeForm.urgent ? 'ASAP' : 'Flexible',
          time: activeForm.duration,
          category: activeForm.category,
          instantAccept: activeForm.urgent,
          photos: activeForm.photos,
        });

        resetFilters();
        Alert.alert('Job posted', 'Your post is now live for nearby students.');
        navigation.navigate('JobDetail', { jobId: newJob.id });
        return;
      }

      await postRental({
        ...activeForm,
        location: resolvedLocation.address,
        latitude: resolvedLocation.latitude,
        longitude: resolvedLocation.longitude,
      });
      resetFilters();
      Alert.alert('Rental listed', 'Your rental post is ready for nearby students to discover.');
      setForms((prev) => ({ ...prev, rental: buildInitialPostForm('rental') }));
      setSelectedType(null);
    } catch (error) {
      Alert.alert('Post failed', error.message || 'We could not publish your post right now.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDeleteListing = () => {
    if (!editingListing) {
      return;
    }

    Alert.alert(
      'Delete listing?',
      'This will remove the listing from the marketplace for everyone.',
      [
        { style: 'cancel', text: 'Keep listing' },
        {
          style: 'destructive',
          text: 'Delete',
          onPress: async () => {
            try {
              await removeOwnedListing(editingListing.id);
              clearEditIntent();
              setForms((prev) => ({
                ...prev,
                [editingListing.type]: buildInitialPostForm(editingListing.type),
              }));
              setSelectedType(null);
              Alert.alert('Listing deleted', 'Your post has been removed.');
            } catch (error) {
              Alert.alert(
                'Delete failed',
                error.message || 'We could not delete this listing right now.'
              );
            }
          },
        },
      ]
    );
  };

  if (!selectedType) {
    return (
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: topInset }]} style={styles.container}>
        <View style={styles.headerRow}>
          <Pressable onPress={goBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>{'<'}</Text>
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.headerTitle}>Create Post</Text>
            <Text style={styles.headerSubtitle}>What do you want to post?</Text>
          </View>
        </View>

        <View style={styles.typeCardColumn}>
          {postTypeOptions.map((option) => (
            <PostTypeCard key={option.key} onPress={() => setSelectedType(option.key)} option={option} />
          ))}
        </View>

        <AppCard style={styles.currentListingsSection}>
          <View style={styles.currentListingsHeader}>
            <Text style={styles.currentListingsTitle}>Your current listings</Text>
            <Text style={styles.currentListingsCount}>{myListings.length}</Text>
          </View>

          {myListings.length ? (
            <View style={styles.currentListingsColumn}>
              {myListings.slice(0, 4).map((listing) => (
                <CurrentListingCard
                  key={listing.id}
                  listing={listing}
                  onPress={() => openListingEditor(listing.id)}
                />
              ))}
            </View>
          ) : (
            <Text style={styles.currentListingsEmpty}>
              Your posted jobs and rentals will show up here with their current status.
            </Text>
          )}
        </AppCard>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingTop: topInset }]} style={styles.container}>
      <View style={styles.headerRow}>
        <Pressable onPress={goBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>{'<'}</Text>
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>{isEditing ? `Edit ${activeOption.title}` : activeOption.title}</Text>
          <Text style={styles.headerSubtitle}>
            {isEditing ? 'Update your live listing details' : 'Fill in the details below'}
          </Text>
        </View>
      </View>

      {!isEditing ? (
        <View style={styles.modeTabs}>
          {postTypeOptions.map((option) => (
            <PostTypeTab
              active={selectedType === option.key}
              key={option.key}
              onPress={() => setSelectedType(option.key)}
              title={option.title}
            />
          ))}
        </View>
      ) : null}

      <AppCard style={styles.photoCard}>
        <Pressable disabled={isEditing} onPress={pickPhotos} style={styles.photoDropZone}>
          {activeForm.photos.length ? (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.photoRow}>
                  {activeForm.photos.map((photo) => (
                    <Image
                      key={photo.id || photo.uri}
                      source={{ uri: photo.uri }}
                      style={styles.photoPreview}
                    />
                  ))}
                </View>
              </ScrollView>
              <Text style={styles.photoHint}>
                {isEditing
                  ? `${activeForm.photos.length} current photo(s)`
                  : `${activeForm.photos.length} photo(s) selected`}
              </Text>
            </>
          ) : (
            <>
              <View style={styles.photoIconWrap}>
                <Text style={styles.photoIcon}>+</Text>
              </View>
              <Text style={styles.photoTitle}>{isEditing ? 'Current Photos' : 'Add Photos'}</Text>
            </>
          )}
        </Pressable>
        {isEditing ? (
          <Text style={styles.photoEditNote}>
            Photo replacement is not included in this edit flow yet. Your current images will stay as they are.
          </Text>
        ) : null}
      </AppCard>

      <AppCard style={styles.formSection}>
        <SectionLabel>Title</SectionLabel>
        <AppTextInput
          onChangeText={(value) => updateForm('title', value)}
          placeholder={
            selectedType === 'job' ? 'e.g. Help move furniture' : 'e.g. Canon camera for rent'
          }
          style={styles.softInput}
          value={activeForm.title}
        />

        <SectionLabel>Description</SectionLabel>
        <AppTextInput
          multiline
          onChangeText={(value) => updateForm('description', value)}
          placeholder={
            selectedType === 'job'
              ? 'Describe what you need...'
              : 'Describe the item, condition, and what is included...'
          }
          style={[styles.softInput, styles.descriptionInput]}
          value={activeForm.description}
        />
      </AppCard>

      <AppCard style={styles.formSection}>
        <SectionLabel>Category</SectionLabel>
        <View style={styles.categoryWrap}>
          {activeCategories.map((category) => (
            <CategoryChip
              active={activeForm.category === category}
              key={category}
              label={category}
              onPress={() => updateForm('category', category)}
            />
          ))}
        </View>
      </AppCard>

      <AppCard style={styles.formSection}>
        <View style={styles.detailRow}>
          <View style={styles.flexOne}>
            <SectionLabel>{selectedType === 'job' ? 'Budget' : 'Rate'}</SectionLabel>
            <AppTextInput
              keyboardType="numeric"
              onChangeText={(value) => updateForm('budget', value)}
              placeholder="$0.00"
              style={styles.softInput}
              value={activeForm.budget}
            />
          </View>
          <View style={styles.flexOne}>
            <SectionLabel>Duration</SectionLabel>
            <AppTextInput
              onChangeText={(value) => updateForm('duration', value)}
              placeholder={selectedType === 'job' ? 'e.g. 2 hrs' : 'e.g. 3 days'}
              style={styles.softInput}
              value={activeForm.duration}
            />
          </View>
        </View>

        <SectionLabel>Location</SectionLabel>
        <AppTextInput
          onChangeText={updateLocationInput}
          placeholder={
            selectedType === 'job'
              ? 'e.g. 123 Main St, Los Angeles'
              : 'e.g. 45 Oak Ave, Student Center'
          }
          style={styles.softInput}
          value={activeForm.location}
        />
        <Text style={styles.locationHint}>
          Enter a real street or campus address so nearby students can find this on the map.
        </Text>

        <Pressable
          onPress={useCurrentAddress}
          style={[
            styles.toggleChip,
            styles.locationChip,
            (isResolvingLocation || isLocationLoading) && styles.toggleChipActive,
          ]}
        >
          <Text
            style={[
              styles.toggleChipText,
              (isResolvingLocation || isLocationLoading) && styles.toggleChipTextActive,
            ]}
          >
            {isResolvingLocation || isLocationLoading ? 'Finding current address...' : 'Use current address'}
          </Text>
        </Pressable>

        {locationNotice ? <Text style={styles.locationNotice}>{locationNotice}</Text> : null}

        <Pressable
          onPress={() => updateForm('urgent', !activeForm.urgent)}
          style={[styles.toggleChip, activeForm.urgent && styles.toggleChipActive]}
        >
          <Text style={[styles.toggleChipText, activeForm.urgent && styles.toggleChipTextActive]}>
            {selectedType === 'job' ? 'Mark as Urgent' : 'Available Now'}
          </Text>
        </Pressable>
      </AppCard>

      <AppButton
        disabled={!canSubmit}
        label={isSubmitting ? (isEditing ? 'Saving...' : 'Publishing...') : isEditing ? 'Save Changes' : 'Review Post'}
        onPress={submit}
        style={[styles.reviewButton, !canSubmit && styles.reviewButtonDisabled]}
        textStyle={!canSubmit ? styles.reviewButtonTextDisabled : null}
      />

      {isEditing ? (
        <AppButton
          label="Delete Listing"
          onPress={confirmDeleteListing}
          style={styles.deleteButton}
          variant="ghost"
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F4F7FD',
    flex: 1,
  },
  content: {
    gap: 16,
    padding: 16,
    paddingBottom: 32,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 999,
    height: 40,
    justifyContent: 'center',
    width: 40,
    ...shadow,
  },
  backButtonText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginTop: -1,
  },
  headerCopy: {
    flex: 1,
  },
  headerTitle: {
    color: '#1C2434',
    fontSize: 30,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: '#7B8596',
    fontSize: 14,
    marginTop: 2,
  },
  typeCardColumn: {
    gap: 14,
    marginTop: 8,
  },
  currentListingsSection: {
    gap: 12,
    padding: 18,
  },
  currentListingsHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  currentListingsTitle: {
    color: '#1D2433',
    fontSize: 18,
    fontWeight: '800',
  },
  currentListingsCount: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  currentListingsColumn: {
    gap: 12,
  },
  currentListingsEmpty: {
    color: '#7B8596',
    fontSize: 14,
    lineHeight: 21,
  },
  currentListingCard: {
    gap: 8,
    padding: 16,
  },
  currentListingHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  currentListingTypePill: {
    backgroundColor: '#EAF2FF',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  currentListingTypePillAlt: {
    backgroundColor: '#F1F5FF',
  },
  currentListingTypeText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  currentListingTypeTextAlt: {
    color: '#4566C9',
  },
  currentListingStatus: {
    color: '#7B8596',
    fontSize: 12,
    fontWeight: '700',
  },
  currentListingTitle: {
    color: '#1D2433',
    fontSize: 16,
    fontWeight: '800',
  },
  currentListingMeta: {
    color: '#7B8596',
    fontSize: 13,
  },
  currentListingFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  currentListingPrice: {
    color: '#1D2433',
    fontSize: 18,
    fontWeight: '800',
  },
  currentListingAction: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  typeCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
    padding: 20,
  },
  typeIconWrap: {
    alignItems: 'center',
    borderRadius: 22,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  typeIconText: {
    fontSize: 20,
    fontWeight: '800',
  },
  typeCopy: {
    flex: 1,
    gap: 4,
  },
  typeTitle: {
    color: '#1D2433',
    fontSize: 18,
    fontWeight: '800',
  },
  typeSubtitle: {
    color: '#7B8596',
    fontSize: 14,
  },
  typeArrow: {
    color: '#7B8596',
    fontSize: 26,
    lineHeight: 28,
  },
  modeTabs: {
    backgroundColor: '#E8EEF9',
    borderRadius: radius.pill,
    flexDirection: 'row',
    padding: 4,
  },
  modeTab: {
    alignItems: 'center',
    borderRadius: radius.pill,
    flex: 1,
    paddingVertical: 12,
  },
  modeTabActive: {
    backgroundColor: colors.card,
  },
  modeTabText: {
    color: '#7B8596',
    fontSize: 13,
    fontWeight: '700',
  },
  modeTabTextActive: {
    color: '#1D2433',
  },
  photoCard: {
    padding: 16,
  },
  photoDropZone: {
    alignItems: 'center',
    borderColor: '#D6E2F4',
    borderRadius: 22,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    justifyContent: 'center',
    minHeight: 142,
    padding: 16,
  },
  photoIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 28,
  },
  photoIcon: {
    color: '#7B8596',
    fontSize: 28,
    fontWeight: '400',
  },
  photoTitle: {
    color: '#7B8596',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 8,
  },
  photoHint: {
    color: '#7B8596',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 12,
  },
  photoEditNote: {
    color: '#7B8596',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 12,
  },
  photoRow: {
    flexDirection: 'row',
    gap: 10,
  },
  photoPreview: {
    borderRadius: 16,
    height: 82,
    width: 82,
  },
  formSection: {
    gap: 12,
    padding: 20,
  },
  sectionLabel: {
    color: '#243040',
    fontSize: 14,
    fontWeight: '700',
  },
  locationHint: {
    color: '#7B8596',
    fontSize: 12,
    lineHeight: 18,
    marginTop: -4,
  },
  locationNotice: {
    color: colors.secondaryText,
    fontSize: 12,
    lineHeight: 18,
    marginTop: -4,
  },
  softInput: {
    backgroundColor: '#E9EDF3',
    borderWidth: 0,
    color: '#243040',
    paddingVertical: 14,
  },
  descriptionInput: {
    minHeight: 112,
    textAlignVertical: 'top',
  },
  categoryWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryChip: {
    backgroundColor: '#E9EDF3',
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  categoryChipActive: {
    backgroundColor: '#EAF2FF',
  },
  categoryChipText: {
    color: '#718096',
    fontSize: 13,
    fontWeight: '700',
  },
  categoryChipTextActive: {
    color: colors.primary,
  },
  detailRow: {
    flexDirection: 'row',
    gap: 12,
  },
  flexOne: {
    flex: 1,
  },
  toggleChip: {
    alignSelf: 'flex-start',
    backgroundColor: '#E9EDF3',
    borderRadius: radius.pill,
    marginTop: 2,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  toggleChipActive: {
    backgroundColor: '#EAF2FF',
  },
  locationChip: {
    marginTop: 0,
  },
  toggleChipText: {
    color: '#718096',
    fontSize: 14,
    fontWeight: '700',
  },
  toggleChipTextActive: {
    color: colors.primary,
  },
  reviewButton: {
    backgroundColor: '#DCE7F8',
    borderRadius: 22,
    minHeight: 56,
  },
  reviewButtonDisabled: {
    backgroundColor: '#DCE7F8',
  },
  reviewButtonTextDisabled: {
    color: '#7B8596',
  },
  deleteButton: {
    marginTop: -4,
  },
});
