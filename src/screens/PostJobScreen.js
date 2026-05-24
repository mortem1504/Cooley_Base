import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  LayoutAnimation,
  Modal,
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
import { requestListingCopilotSuggestions } from '../services/listingCopilotService';
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
const COPILOT_APPLY_FEEDBACK_MS = 1400;

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

function CopilotSuggestionRow({
  label,
  multiline = false,
  onApply,
  onChangeText,
  value,
  isApplied = false,
  isHighlighted = false,
}) {
  if (!value) {
    return null;
  }

  return (
    <View
      style={[
        styles.copilotSuggestionRow,
        isApplied && styles.copilotSuggestionRowApplied,
        isHighlighted && styles.copilotSuggestionRowHighlighted,
      ]}
    >
      <View style={styles.copilotSuggestionCopy}>
        <View style={styles.copilotSuggestionLabelRow}>
          <Text style={styles.copilotSuggestionLabel}>{label}</Text>
          {isApplied ? (
            <Text
              style={[
                styles.copilotSuggestionStatus,
                isHighlighted && styles.copilotSuggestionStatusHighlighted,
              ]}
            >
              {isHighlighted ? 'Applied just now' : 'Applied'}
            </Text>
          ) : null}
        </View>
        <AppTextInput
          multiline={multiline}
          onChangeText={onChangeText}
          style={[
            styles.copilotSuggestionInput,
            isApplied && styles.copilotSuggestionInputApplied,
            multiline && styles.copilotSuggestionInputMultiline,
          ]}
          value={value}
        />
      </View>
      <Pressable
        onPress={onApply}
        style={({ pressed }) => [
          styles.copilotApplyChip,
          isApplied && styles.copilotApplyChipApplied,
          isHighlighted && styles.copilotApplyChipHighlighted,
          pressed && styles.copilotApplyChipPressed,
        ]}
      >
        <Text style={[styles.copilotApplyChipText, isApplied && styles.copilotApplyChipTextApplied]}>
          {isApplied ? 'Applied' : 'Apply'}
        </Text>
      </Pressable>
    </View>
  );
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
  const [copilotPrompt, setCopilotPrompt] = useState('');
  const [copilotSuggestion, setCopilotSuggestion] = useState(null);
  const [editableCopilotSuggestion, setEditableCopilotSuggestion] = useState(null);
  const [copilotNotice, setCopilotNotice] = useState('');
  const [isGeneratingCopilot, setIsGeneratingCopilot] = useState(false);
  const [isAssistantExpanded, setIsAssistantExpanded] = useState(false);
  const [isSuggestionsVisible, setIsSuggestionsVisible] = useState(false);
  const [recentlyAppliedCopilotFields, setRecentlyAppliedCopilotFields] = useState({});
  const copilotApplyTimeoutsRef = useRef({});
  const [forms, setForms] = useState({
    job: buildInitialPostForm('job'),
    rental: buildInitialPostForm('rental'),
  });
  const editListingId = route?.params?.editListingId || null;
  const editingListing = editListingId ? getListingForEdit(editListingId) : null;
  const isEditing = Boolean(editingListing);

  const resetPostFlow = () => {
    clearCopilotApplyFeedback();
    setForms({
      job: buildInitialPostForm('job'),
      rental: buildInitialPostForm('rental'),
    });
    setCopilotPrompt('');
    setCopilotSuggestion(null);
    setEditableCopilotSuggestion(null);
    setCopilotNotice('');
    setIsGeneratingCopilot(false);
    setIsAssistantExpanded(false);
    setIsSuggestionsVisible(false);
    setSelectedType(null);
    clearEditIntent();
  };

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
  const copilotFieldKeys = [
    'title',
    'description',
    'category',
    'budget',
    ...(isDurationRequired ? ['duration'] : []),
    'urgent',
  ];

  useEffect(() => {
    if (!editingListing) {
      return;
    }

    setSelectedType(editingListing.type);
    setForms((prev) => ({
      ...prev,
      [editingListing.type]: buildPostFormFromListing(editingListing),
    }));
    setCopilotSuggestion(null);
    setEditableCopilotSuggestion(null);
    setCopilotNotice('');
    setIsAssistantExpanded(false);
    setIsSuggestionsVisible(false);
    clearCopilotApplyFeedback();
  }, [editingListing]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('blur', () => {
      resetPostFlow();
    });

    return unsubscribe;
  }, [navigation, route?.params?.editListingId]);

  useEffect(() => () => {
    Object.values(copilotApplyTimeoutsRef.current).forEach(clearTimeout);
  }, []);

  const clearEditIntent = () => {
    if (route?.params?.editListingId) {
      navigation.setParams({ editListingId: undefined });
    }
  };

  const clearCopilotApplyFeedback = () => {
    Object.values(copilotApplyTimeoutsRef.current).forEach(clearTimeout);
    copilotApplyTimeoutsRef.current = {};
    setRecentlyAppliedCopilotFields({});
  };

  const markCopilotFieldsApplied = (fields) => {
    fields.forEach((field) => {
      if (copilotApplyTimeoutsRef.current[field]) {
        clearTimeout(copilotApplyTimeoutsRef.current[field]);
      }

      setRecentlyAppliedCopilotFields((prev) => ({
        ...prev,
        [field]: true,
      }));

      copilotApplyTimeoutsRef.current[field] = setTimeout(() => {
        setRecentlyAppliedCopilotFields((prev) => {
          const next = { ...prev };
          delete next[field];
          return next;
        });
        delete copilotApplyTimeoutsRef.current[field];
      }, COPILOT_APPLY_FEEDBACK_MS);
    });
  };

  const normalizeCopilotFieldValue = (field, value) => {
    if (field === 'urgent') {
      return Boolean(value);
    }

    return String(value || '').trim();
  };

  const isCopilotFieldApplied = (field) => {
    if (!editableCopilotSuggestion || !activeForm) {
      return false;
    }

    return (
      normalizeCopilotFieldValue(field, editableCopilotSuggestion[field]) ===
      normalizeCopilotFieldValue(field, activeForm[field])
    );
  };

  const areAllCopilotFieldsApplied = editableCopilotSuggestion
    ? copilotFieldKeys.every((field) => isCopilotFieldApplied(field))
    : false;

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
    setCopilotPrompt('');
    setCopilotSuggestion(null);
    setEditableCopilotSuggestion(null);
    setCopilotNotice('');
    setIsAssistantExpanded(false);
    setIsSuggestionsVisible(false);
    clearCopilotApplyFeedback();
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

  const setFormValues = (updater) => {
    setForms((prev) => ({
      ...prev,
      [selectedType]: {
        ...prev[selectedType],
        ...updater(prev[selectedType]),
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
    setCopilotSuggestion(null);
    setCopilotNotice('');
    clearCopilotApplyFeedback();
  };

  const goBack = () => {
    if (isEditing) {
      resetPostFlow();
      return;
    }

    if (selectedType) {
      resetPostFlow();
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

  const handleGenerateCopilot = async () => {
    if (!selectedType || !activeForm) {
      return;
    }

    setIsGeneratingCopilot(true);
    setCopilotNotice('');

    try {
      const nextSuggestion = await requestListingCopilotSuggestions({
        budget: activeForm.budget,
        category: activeForm.category,
        description: activeForm.description,
        duration: isDurationRequired ? activeForm.duration : '',
        listingMode: currentItemListingMode,
        listingType: selectedType,
        location: activeForm.location,
        prompt: copilotPrompt,
        title: activeForm.title,
        urgent: activeForm.urgent,
      });

      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      clearCopilotApplyFeedback();
      setCopilotSuggestion(nextSuggestion);
      setEditableCopilotSuggestion(nextSuggestion);
      setIsSuggestionsVisible(true);
      setIsAssistantExpanded(false);
    } catch (error) {
      setCopilotNotice(
        error.message || 'AI Listing Assistant could not prepare a suggestion right now.'
      );
    } finally {
      setIsGeneratingCopilot(false);
    }
  };

  const applyCopilotField = (field) => {
    if (!editableCopilotSuggestion) {
      return;
    }

    const fieldsToApply = field === 'all' ? copilotFieldKeys : [field];

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (field === 'all') {
      setIsSuggestionsVisible(false);
    }

    const nextFormValues =
      field === 'all'
        ? {
            budget: editableCopilotSuggestion.budget || activeForm.budget,
            category: editableCopilotSuggestion.category || activeForm.category,
            description: editableCopilotSuggestion.description || activeForm.description,
            duration: isDurationRequired
              ? editableCopilotSuggestion.duration || activeForm.duration
              : activeForm.duration,
            title: editableCopilotSuggestion.title || activeForm.title,
            urgent: editableCopilotSuggestion.urgent,
          }
        : field === 'duration' && !isDurationRequired
          ? {}
          : {
              [field]: editableCopilotSuggestion[field],
            };

    setFormValues(() => nextFormValues);
    markCopilotFieldsApplied(fieldsToApply);
  };

  const clearCopilotSuggestion = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    clearCopilotApplyFeedback();
    setCopilotSuggestion(null);
    setEditableCopilotSuggestion(null);
    setCopilotNotice('');
    setIsSuggestionsVisible(false);
  };

  const updateEditableSuggestionField = (field, value) => {
    setEditableCopilotSuggestion((prev) => {
      if (!prev) {
        return prev;
      }

      return {
        ...prev,
        [field]: value,
      };
    });
  };

  const toggleAssistant = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsAssistantExpanded((prev) => !prev);
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
        resetPostFlow();
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
        resetPostFlow();
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
      resetPostFlow();
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
              resetPostFlow();
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
            <PostTypeCard
              key={option.key}
              onPress={() => {
                setSelectedType(option.key);
                setCopilotSuggestion(null);
                setCopilotNotice('');
              }}
              option={option}
            />
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
    <>
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
                onPress={() => {
                  setSelectedType(option.key);
                  setCopilotSuggestion(null);
                  setCopilotNotice('');
                  setIsAssistantExpanded(false);
                  setIsSuggestionsVisible(false);
                  clearCopilotApplyFeedback();
                }}
                title={option.title}
              />
            ))}
          </View>
        ) : null}

        <AppCard style={styles.formSection}>
          <View style={styles.assistantHeaderRow}>
            <View style={styles.assistantHeaderCopy}>
              <Text style={styles.assistantTitle}>AI Listing Assistant</Text>
              <Text style={styles.assistantSubtitle}>
                Draft your listing faster, then review suggestions before applying them.
              </Text>
            </View>
            <View style={styles.assistantHeaderActions}>
              {copilotSuggestion ? (
                <Pressable onPress={() => setIsSuggestionsVisible(true)} style={styles.assistantHeaderChip}>
                  <Text style={styles.assistantHeaderChipText}>View</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={toggleAssistant} style={styles.assistantHeaderChip}>
                <Text style={styles.assistantHeaderChipText}>
                  {isAssistantExpanded ? 'Hide' : 'Open'}
                </Text>
              </Pressable>
            </View>
          </View>

          {isAssistantExpanded ? (
            <View style={styles.assistantExpandedBody}>
              <AppTextInput
                multiline
                onChangeText={setCopilotPrompt}
                placeholder={
                  selectedType === 'job'
                    ? 'Try: Room cleaning tonight near campus'
                    : currentItemListingMode === 'sell'
                      ? 'Try: Selling a used camera with charger'
                      : 'Try: Camera rental for weekend shoots'
                }
                style={styles.assistantPromptInput}
                value={copilotPrompt}
              />

              <View style={styles.assistantActionRow}>
                <AppButton
                  disabled={isGeneratingCopilot}
                  label={isGeneratingCopilot ? 'Generating...' : 'Improve with AI'}
                  onPress={handleGenerateCopilot}
                  style={styles.assistantPrimaryButton}
                />
                {copilotSuggestion ? (
                  <AppButton
                    label="View suggestions"
                    onPress={() => setIsSuggestionsVisible(true)}
                    style={styles.assistantSecondaryButton}
                    variant="secondary"
                  />
                ) : null}
              </View>

              {copilotNotice ? <Text style={styles.assistantNotice}>{copilotNotice}</Text> : null}
            </View>
          ) : (
            <Pressable onPress={toggleAssistant} style={styles.assistantCollapsedBar}>
              <Text style={styles.assistantCollapsedText}>
                {copilotSuggestion
                  ? 'Suggestions are ready. Open the assistant to review or view them directly.'
                  : 'Use one short prompt to draft your title, description, category, and pricing.'}
              </Text>
              <Text style={styles.assistantCollapsedAction}>
                {copilotSuggestion ? 'Suggestions ready' : 'Try it'}
              </Text>
            </Pressable>
          )}

          <View style={styles.assistantDivider} />

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

      <Modal
        animationType="slide"
        onRequestClose={() => setIsSuggestionsVisible(false)}
        transparent
        visible={isSuggestionsVisible}
      >
        <View style={styles.suggestionsModalOverlay}>
          <Pressable
            onPress={() => setIsSuggestionsVisible(false)}
            style={styles.suggestionsModalBackdrop}
          />
          <View style={styles.suggestionsSheet}>
            <View style={styles.suggestionsHandle} />
            <View style={styles.suggestionsHeader}>
              <View style={styles.suggestionsHeaderCopy}>
                <Text style={styles.suggestionsTitle}>AI Listing Assistant</Text>
                <Text style={styles.suggestionsSubtitle}>
                  Review suggestions and apply only what you want to keep.
                </Text>
              </View>
              <Pressable onPress={clearCopilotSuggestion}>
                <Text style={styles.suggestionsClearLink}>Clear</Text>
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.suggestionsContent}
              showsVerticalScrollIndicator={false}
            >
              {editableCopilotSuggestion ? (
                <>
                  <CopilotSuggestionRow
                    isApplied={isCopilotFieldApplied('title')}
                    isHighlighted={Boolean(recentlyAppliedCopilotFields.title)}
                    label="Title"
                    onApply={() => applyCopilotField('title')}
                    onChangeText={(value) => updateEditableSuggestionField('title', value)}
                    value={editableCopilotSuggestion.title}
                  />
                  <CopilotSuggestionRow
                    isApplied={isCopilotFieldApplied('description')}
                    isHighlighted={Boolean(recentlyAppliedCopilotFields.description)}
                    label="Description"
                    multiline
                    onApply={() => applyCopilotField('description')}
                    onChangeText={(value) => updateEditableSuggestionField('description', value)}
                    value={editableCopilotSuggestion.description}
                  />
                  <CopilotSuggestionRow
                    isApplied={isCopilotFieldApplied('category')}
                    isHighlighted={Boolean(recentlyAppliedCopilotFields.category)}
                    label="Category"
                    onApply={() => applyCopilotField('category')}
                    onChangeText={(value) => updateEditableSuggestionField('category', value)}
                    value={editableCopilotSuggestion.category}
                  />
                  <CopilotSuggestionRow
                    isApplied={isCopilotFieldApplied('budget')}
                    isHighlighted={Boolean(recentlyAppliedCopilotFields.budget)}
                    label={selectedType === 'job' ? 'Budget' : currentItemListingMode === 'sell' ? 'Price' : 'Rate'}
                    onApply={() => applyCopilotField('budget')}
                    onChangeText={(value) => updateEditableSuggestionField('budget', value)}
                    value={editableCopilotSuggestion.budget}
                  />
                  {isDurationRequired ? (
                    <CopilotSuggestionRow
                      isApplied={isCopilotFieldApplied('duration')}
                      isHighlighted={Boolean(recentlyAppliedCopilotFields.duration)}
                      label="Duration"
                      onApply={() => applyCopilotField('duration')}
                      onChangeText={(value) => updateEditableSuggestionField('duration', value)}
                      value={editableCopilotSuggestion.duration}
                    />
                  ) : null}
                  <CopilotSuggestionRow
                    isApplied={isCopilotFieldApplied('urgent')}
                    isHighlighted={Boolean(recentlyAppliedCopilotFields.urgent)}
                    label="Urgency"
                    onApply={() => applyCopilotField('urgent')}
                    onChangeText={(value) =>
                      updateEditableSuggestionField(
                        'urgent',
                        value.toLowerCase().includes('urgent') || value.toLowerCase().includes('available')
                      )
                    }
                    value={
                      editableCopilotSuggestion.urgent
                        ? 'Mark as urgent / available now'
                        : 'Keep normal urgency'
                    }
                  />

                  {editableCopilotSuggestion.qualityWarnings.length ? (
                    <View style={styles.copilotWarningsWrap}>
                      <Text style={styles.copilotWarningsTitle}>What to tighten before posting</Text>
                      {editableCopilotSuggestion.qualityWarnings.map((warning, index) => (
                        <Text key={warning} style={styles.copilotWarningItem}>
                          {index + 1}. {warning}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                </>
              ) : (
                <Text style={styles.suggestionsEmptyText}>
                  Generate suggestions first, then they will appear here.
                </Text>
              )}
            </ScrollView>

            <View style={styles.suggestionsFooter}>
              <AppButton
                label="Close"
                onPress={() => setIsSuggestionsVisible(false)}
                style={styles.suggestionsFooterSecondary}
                variant="secondary"
              />
              {editableCopilotSuggestion ? (
                <AppButton
                  disabled={areAllCopilotFieldsApplied}
                  label={areAllCopilotFieldsApplied ? 'All applied' : 'Apply all'}
                  onPress={() => applyCopilotField('all')}
                  style={styles.suggestionsFooterPrimary}
                />
              ) : null}
            </View>
          </View>
        </View>
      </Modal>
    </>
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
  assistantHeaderRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  assistantHeaderCopy: {
    flex: 1,
  },
  assistantTitle: {
    color: '#1D2433',
    fontSize: 18,
    fontWeight: '800',
  },
  assistantSubtitle: {
    color: '#7B8596',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  assistantHeaderActions: {
    flexDirection: 'row',
    gap: 8,
  },
  assistantHeaderChip: {
    backgroundColor: '#EAF2FF',
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  assistantHeaderChipText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  assistantExpandedBody: {
    gap: 12,
  },
  assistantPromptInput: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  assistantActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  assistantPrimaryButton: {
    flex: 1,
  },
  assistantSecondaryButton: {
    minWidth: 108,
  },
  assistantNotice: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 19,
  },
  assistantCollapsedBar: {
    backgroundColor: '#F4F7FD',
    borderColor: '#D9E2F2',
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  assistantCollapsedText: {
    color: '#5E6B80',
    fontSize: 13,
    lineHeight: 19,
  },
  assistantCollapsedAction: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  assistantDivider: {
    backgroundColor: '#E9EDF3',
    height: 1,
    marginVertical: 2,
    width: '100%',
  },
  copilotSuggestionRow: {
    alignItems: 'flex-start',
    backgroundColor: '#F4F7FD',
    borderColor: '#D9E2F2',
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  copilotSuggestionCopy: {
    flex: 1,
    gap: 6,
  },
  copilotSuggestionLabelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  copilotSuggestionLabel: {
    color: '#718096',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  copilotSuggestionStatus: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  copilotSuggestionStatusHighlighted: {
    color: '#1F5FBF',
  },
  copilotSuggestionInput: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D9E2F2',
    borderWidth: 1,
    color: '#243040',
    fontSize: 14,
    lineHeight: 21,
    minHeight: 52,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  copilotSuggestionInputApplied: {
    backgroundColor: '#F9FBFF',
    borderColor: '#B7D0F8',
  },
  copilotSuggestionInputMultiline: {
    minHeight: 132,
    textAlignVertical: 'top',
  },
  copilotSuggestionValue: {
    color: '#243040',
    fontSize: 14,
    lineHeight: 21,
  },
  copilotApplyChip: {
    backgroundColor: '#EAF2FF',
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  copilotApplyChipPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.98 }],
  },
  copilotApplyChipApplied: {
    backgroundColor: colors.primary,
  },
  copilotApplyChipHighlighted: {
    backgroundColor: '#1F6FE5',
  },
  copilotApplyChipText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  copilotApplyChipTextApplied: {
    color: colors.card,
  },
  copilotSuggestionRowApplied: {
    borderColor: '#B7D0F8',
    backgroundColor: '#F8FBFF',
  },
  copilotSuggestionRowHighlighted: {
    backgroundColor: '#EEF5FF',
  },
  copilotWarningsWrap: {
    backgroundColor: '#FFF7EA',
    borderColor: '#F3D7A7',
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 6,
    padding: 14,
  },
  copilotWarningsTitle: {
    color: '#8A5B00',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  copilotWarningItem: {
    color: '#6E5A34',
    fontSize: 13,
    lineHeight: 19,
  },
  suggestionsModalOverlay: {
    backgroundColor: 'rgba(18, 24, 36, 0.28)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  suggestionsModalBackdrop: {
    flex: 1,
  },
  suggestionsSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '78%',
    paddingBottom: 18,
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  suggestionsHandle: {
    alignSelf: 'center',
    backgroundColor: '#D6E2F4',
    borderRadius: radius.pill,
    height: 5,
    marginBottom: 14,
    width: 58,
  },
  suggestionsHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  suggestionsHeaderCopy: {
    flex: 1,
  },
  suggestionsTitle: {
    color: '#1D2433',
    fontSize: 20,
    fontWeight: '800',
  },
  suggestionsSubtitle: {
    color: '#7B8596',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  suggestionsClearLink: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  suggestionsContent: {
    gap: 10,
    paddingBottom: 12,
    paddingTop: 16,
  },
  suggestionsEmptyText: {
    color: '#7B8596',
    fontSize: 14,
    lineHeight: 21,
  },
  suggestionsFooter: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  suggestionsFooterPrimary: {
    flex: 1,
  },
  suggestionsFooterSecondary: {
    minWidth: 112,
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
