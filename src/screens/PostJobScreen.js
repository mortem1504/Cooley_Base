import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
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

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const ITEM_LISTING_MODES = [
  { key: 'rent', label: 'Rent' },
  { key: 'sell', label: 'Sell' },
];
const MAX_LISTING_PHOTOS = 6;

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
  const isItemListing = listing.type === 'rental';
  const isSellListing = isItemListing && listing.listingMode === 'sell';

  return (
    <Pressable onPress={onPress}>
      <AppCard style={styles.currentListingCard}>
        <View style={styles.currentListingHeader}>
          <View style={styles.currentListingBadgeRow}>
            <View
              style={[
                styles.currentListingTypePill,
                isItemListing && styles.currentListingTypePillAlt,
              ]}
            >
              <Text
                style={[
                  styles.currentListingTypeText,
                  isItemListing && styles.currentListingTypeTextAlt,
                ]}
              >
                {listing.type === 'job' ? 'Job' : 'Item'}
              </Text>
            </View>
            {isItemListing ? (
              <View
                style={[
                  styles.currentListingModePill,
                  isSellListing
                    ? styles.currentListingModePillSell
                    : styles.currentListingModePillRent,
                ]}
              >
                <Text
                  style={[
                    styles.currentListingModeText,
                    isSellListing
                      ? styles.currentListingModeTextSell
                      : styles.currentListingModeTextRent,
                  ]}
                >
                  {isSellListing ? 'Sell' : 'Rent'}
                </Text>
              </View>
            ) : null}
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
  const currentItemListingMode = activeForm?.listingMode === 'sell' ? 'sell' : 'rent';
  const showListingModeToggle = selectedType === 'rental';
  const isDurationRequired =
    selectedType === 'job' || (selectedType === 'rental' && currentItemListingMode === 'rent');
  const selectedPhotoCount = activeForm?.photos?.length || 0;
  const remainingPhotoSlots = Math.max(MAX_LISTING_PHOTOS - selectedPhotoCount, 0);
  const canSubmit = !isSubmitting && Boolean(
    activeForm &&
      activeForm.title.trim() &&
      activeForm.description.trim() &&
      activeForm.budget.trim() &&
      (!isDurationRequired || activeForm.duration.trim()) &&
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

  const appendPhotos = (assets) => {
    if (!selectedType || !assets?.length) {
      return;
    }

    const currentPhotos = forms[selectedType]?.photos || [];
    const availableSlots = Math.max(MAX_LISTING_PHOTOS - currentPhotos.length, 0);

    if (!availableSlots) {
      Alert.alert(
        'Photo limit reached',
        `You can upload up to ${MAX_LISTING_PHOTOS} photos for one listing.`
      );
      return;
    }

    const nextPhotos = assets
      .slice(0, availableSlots)
      .map((asset, index) => normalizePickedPhoto(asset, currentPhotos.length + index));

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    updateForm('photos', [...currentPhotos, ...nextPhotos]);
  };

  const removePhoto = (photoId) => {
    if (!selectedType) {
      return;
    }

    const currentPhotos = forms[selectedType]?.photos || [];
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    updateForm(
      'photos',
      currentPhotos.filter((photo) => (photo.id || photo.uri) !== photoId)
    );
  };

  const updateListingMode = (nextMode) => {
    if (selectedType !== 'rental' || currentItemListingMode === nextMode) {
      return;
    }

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    updateForm('listingMode', nextMode);
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
        selectionLimit: remainingPhotoSlots || 1,
      });

      if (result.canceled) {
        return;
      }

      appendPhotos(result.assets);
    } catch (error) {
      Alert.alert('Photo access failed', 'Please try selecting your photos again.');
    }
  };

  const capturePhoto = async () => {
    if (isEditing) {
      Alert.alert(
        'Photos stay the same for now',
        'Edit the listing details below. Photo replacement can be added next.'
      );
      return;
    }

    if (!remainingPhotoSlots) {
      Alert.alert(
        'Photo limit reached',
        `You can upload up to ${MAX_LISTING_PHOTOS} photos for one listing.`
      );
      return;
    }

    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();

      if (permission.status !== 'granted') {
        Alert.alert('Camera unavailable', 'Allow camera access to take a photo for this listing.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        base64: true,
        cameraType: ImagePicker.CameraType.back,
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });

      if (result.canceled) {
        return;
      }

      appendPhotos(result.assets);
    } catch (_error) {
      Alert.alert('Camera failed', 'We could not open the camera. Please try again.');
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

    const nextItemMode = currentItemListingMode;
    const durationValue = nextItemMode === 'sell' ? '' : activeForm.duration;

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
          duration: durationValue,
          location: resolvedLocation.address,
          latitude: resolvedLocation.latitude,
          longitude: resolvedLocation.longitude,
          listingMode: nextItemMode,
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
        duration: durationValue,
        location: resolvedLocation.address,
        latitude: resolvedLocation.latitude,
        longitude: resolvedLocation.longitude,
        listingMode: nextItemMode,
      });
      resetFilters();
      Alert.alert(
        nextItemMode === 'sell' ? 'Item listed for sale' : 'Item listed for rent',
        nextItemMode === 'sell'
          ? 'Your item is now live for nearby students to buy.'
          : 'Your item is now live for nearby students to rent.'
      );
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
              Your posted jobs and item listings will show up here with their current status.
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
        <View style={styles.photoHeader}>
          <View>
            <Text style={styles.photoSectionTitle}>{isEditing ? 'Current Photos' : 'Listing Photos'}</Text>
            <Text style={styles.photoSectionSubtitle}>
              {isEditing
                ? `${selectedPhotoCount} photo(s) currently attached`
                : `Add up to ${MAX_LISTING_PHOTOS} photos to help your listing stand out.`}
            </Text>
          </View>
          {!isEditing ? (
            <Text style={styles.photoCountBadge}>
              {selectedPhotoCount}/{MAX_LISTING_PHOTOS}
            </Text>
          ) : null}
        </View>

        <View style={styles.photoGrid}>
          {activeForm.photos.map((photo) => (
            <View key={photo.id || photo.uri} style={styles.photoTile}>
              <Image source={{ uri: photo.uri }} style={styles.photoPreview} />
              {!isEditing ? (
                <Pressable
                  hitSlop={10}
                  onPress={() => removePhoto(photo.id || photo.uri)}
                  style={styles.photoDeleteButton}
                >
                  <Text style={styles.photoDeleteText}>X</Text>
                </Pressable>
              ) : null}
            </View>
          ))}

          {!isEditing && remainingPhotoSlots ? (
            <Pressable onPress={pickPhotos} style={[styles.photoTile, styles.photoAddTile]}>
              <View style={styles.photoAddIconWrap}>
                <Text style={styles.photoIcon}>+</Text>
              </View>
              <Text style={styles.photoAddLabel}>Add Photo</Text>
            </Pressable>
          ) : null}
        </View>

        {!isEditing ? (
          <View style={styles.photoActionRow}>
            <Pressable onPress={pickPhotos} style={styles.photoActionButton}>
              <Text style={styles.photoActionLabel}>Upload from gallery</Text>
            </Pressable>
            <Pressable onPress={capturePhoto} style={styles.photoActionButton}>
              <Text style={styles.photoActionLabel}>Take a photo</Text>
            </Pressable>
          </View>
        ) : null}

        {!selectedPhotoCount && !isEditing ? (
          <Text style={styles.photoHint}>Tap either option above or use the add tile to start.</Text>
        ) : !isEditing ? (
          <Text style={styles.photoHint}>
            Tap the X on any image to remove it instantly before publishing.
          </Text>
        ) : null}
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
        {showListingModeToggle ? (
          <>
            <SectionLabel>Listing Type</SectionLabel>
            <View style={styles.listingModeSwitch}>
              {ITEM_LISTING_MODES.map((mode) => {
                const isActive = currentItemListingMode === mode.key;
                const isRent = mode.key === 'rent';

                return (
                  <Pressable
                    key={mode.key}
                    onPress={() => updateListingMode(mode.key)}
                    style={[
                      styles.listingModeOption,
                      isActive && styles.listingModeOptionActive,
                      isActive && isRent && styles.listingModeOptionRentActive,
                      isActive && !isRent && styles.listingModeOptionSellActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.listingModeText,
                        isActive && styles.listingModeTextActive,
                        isActive && isRent && styles.listingModeTextRentActive,
                        isActive && !isRent && styles.listingModeTextSellActive,
                      ]}
                    >
                      {mode.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}

        <View style={styles.detailRow}>
          <View style={styles.flexOne}>
            <SectionLabel>
              {selectedType === 'job'
                ? 'Budget'
                : currentItemListingMode === 'sell'
                  ? 'Price'
                  : 'Rate'}
            </SectionLabel>
            <AppTextInput
              keyboardType="numeric"
              onChangeText={(value) => updateForm('budget', value)}
              placeholder="$0.00"
              style={styles.softInput}
              value={activeForm.budget}
            />
          </View>
          {isDurationRequired ? (
            <View style={styles.flexOne}>
              <SectionLabel>Duration</SectionLabel>
              <AppTextInput
                onChangeText={(value) => updateForm('duration', value)}
                placeholder={selectedType === 'job' ? 'e.g. 2 hrs' : 'e.g. 3 days'}
                style={styles.softInput}
                value={activeForm.duration}
              />
            </View>
          ) : null}
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
        label={
          isSubmitting
            ? isEditing
              ? 'Saving...'
              : 'Publishing...'
            : isEditing
              ? 'Save Changes'
              : selectedType === 'rental'
                ? currentItemListingMode === 'sell'
                  ? 'List Item for Sale'
                  : 'List Item for Rent'
                : 'Review Post'
        }
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
  currentListingBadgeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
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
  currentListingModePill: {
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  currentListingModePillRent: {
    backgroundColor: '#FFF0DD',
  },
  currentListingModePillSell: {
    backgroundColor: '#E6F6EC',
  },
  currentListingModeText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  currentListingModeTextRent: {
    color: '#D97904',
  },
  currentListingModeTextSell: {
    color: '#23834C',
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
    gap: 14,
    padding: 16,
  },
  photoHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  photoSectionTitle: {
    color: '#1D2433',
    fontSize: 18,
    fontWeight: '800',
  },
  photoSectionSubtitle: {
    color: '#7B8596',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  photoCountBadge: {
    backgroundColor: '#EAF2FF',
    borderRadius: radius.pill,
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  photoTile: {
    borderRadius: 18,
    height: 96,
    overflow: 'hidden',
    position: 'relative',
    width: 96,
  },
  photoPreview: {
    borderRadius: 18,
    height: '100%',
    width: '100%',
  },
  photoDeleteButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(18, 18, 18, 0.78)',
    borderRadius: 999,
    height: 26,
    justifyContent: 'center',
    position: 'absolute',
    right: 8,
    top: 8,
    width: 26,
  },
  photoDeleteText: {
    color: colors.card,
    fontSize: 11,
    fontWeight: '800',
  },
  photoHint: {
    color: '#7B8596',
    fontSize: 13,
    fontWeight: '600',
  },
  photoAddTile: {
    alignItems: 'center',
    backgroundColor: '#F3F6FB',
    borderColor: '#D6E2F4',
    borderStyle: 'dashed',
    borderWidth: 1.5,
    justifyContent: 'center',
    padding: 10,
  },
  photoAddIconWrap: {
    alignItems: 'center',
    backgroundColor: '#E3EBF8',
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  photoIcon: {
    color: '#7B8596',
    fontSize: 22,
    fontWeight: '500',
  },
  photoAddLabel: {
    color: '#5E6B80',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 8,
  },
  photoEditNote: {
    color: '#7B8596',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 12,
  },
  photoActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  photoActionButton: {
    alignItems: 'center',
    backgroundColor: '#EDF2FA',
    borderRadius: radius.md,
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  photoActionLabel: {
    color: '#243040',
    fontSize: 13,
    fontWeight: '700',
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
  listingModeSwitch: {
    backgroundColor: '#E8EEF9',
    borderRadius: radius.pill,
    flexDirection: 'row',
    marginBottom: 2,
    padding: 4,
  },
  listingModeOption: {
    alignItems: 'center',
    borderRadius: radius.pill,
    flex: 1,
    paddingVertical: 12,
  },
  listingModeOptionActive: {
    backgroundColor: colors.card,
  },
  listingModeOptionRentActive: {
    backgroundColor: '#FFF0DD',
  },
  listingModeOptionSellActive: {
    backgroundColor: '#E6F6EC',
  },
  listingModeText: {
    color: '#718096',
    fontSize: 14,
    fontWeight: '800',
  },
  listingModeTextActive: {
    color: '#243040',
  },
  listingModeTextRentActive: {
    color: '#D97904',
  },
  listingModeTextSellActive: {
    color: '#23834C',
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
