import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import AppButton from '../components/AppButton';
import AppCard from '../components/AppCard';
import AppTextInput from '../components/AppTextInput';
import UserAvatar from '../components/UserAvatar';
import useAppState from '../hooks/useAppState';
import { ROOT_ROUTES, TAB_ROUTES } from '../navigation/routes';
import { jobStatusFlow } from '../services/jobService';
import { formatJobDistance, formatJobPrice, formatJobStatus } from '../utils/jobFormatters';
import {
  calculateRentalDays,
  calculateRentalTotal,
  formatRentalDate,
  formatRentalDateRange,
  formatRentalPrice,
  formatRentalRequestStatus,
  isValidRentalDateInput,
  parseRentalDateInput,
} from '../utils/rentalFormatters';
import { colors, radius, spacing } from '../utils/theme';

const RENTAL_STATUS_FLOW = ['available', 'requested', 'accepted', 'ongoing', 'completed'];
const CALENDAR_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function shiftMonth(date, offset) {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1);
}

function formatIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isSameDay(firstDate, secondDate) {
  return (
    firstDate?.getFullYear?.() === secondDate?.getFullYear?.() &&
    firstDate?.getMonth?.() === secondDate?.getMonth?.() &&
    firstDate?.getDate?.() === secondDate?.getDate?.()
  );
}

function buildCalendarDays(monthDate) {
  const monthStart = startOfMonth(monthDate);
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - monthStart.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return date;
  });
}

function RentalCalendar({
  activeField,
  currentMonth,
  onChangeMonth,
  onClose,
  onSelectDate,
  selectedEndDate,
  selectedStartDate,
}) {
  const today = startOfDay(new Date());
  const parsedStartDate = parseRentalDateInput(selectedStartDate);
  const parsedEndDate = parseRentalDateInput(selectedEndDate);
  const minimumDate =
    activeField === 'end' && parsedStartDate && parsedStartDate > today ? parsedStartDate : today;
  const monthDays = useMemo(() => buildCalendarDays(currentMonth), [currentMonth]);
  const monthLabel = useMemo(
    () =>
      new Intl.DateTimeFormat('en-US', {
        month: 'long',
        year: 'numeric',
      }).format(currentMonth),
    [currentMonth]
  );

  return (
    <AppCard style={styles.calendarCard}>
      <View style={styles.calendarHeader}>
        <View style={styles.flexOne}>
          <Text style={styles.calendarTitle}>
            {activeField === 'start' ? 'Choose start date' : 'Choose end date'}
          </Text>
          <Text style={styles.calendarSubtitle}>
            {activeField === 'start'
              ? 'Pick when the rental begins.'
              : 'Pick when the rental ends.'}
          </Text>
        </View>
        <Pressable hitSlop={10} onPress={onClose} style={styles.calendarCloseButton}>
          <Text style={styles.calendarCloseText}>Close</Text>
        </Pressable>
      </View>

      <View style={styles.calendarMonthRow}>
        <Pressable onPress={() => onChangeMonth(-1)} style={styles.calendarMonthButton}>
          <Text style={styles.calendarMonthButtonText}>{'<'}</Text>
        </Pressable>
        <Text style={styles.calendarMonthLabel}>{monthLabel}</Text>
        <Pressable onPress={() => onChangeMonth(1)} style={styles.calendarMonthButton}>
          <Text style={styles.calendarMonthButtonText}>{'>'}</Text>
        </Pressable>
      </View>

      <View style={styles.calendarWeekRow}>
        {CALENDAR_WEEKDAYS.map((weekday) => (
          <Text key={weekday} style={styles.calendarWeekday}>
            {weekday}
          </Text>
        ))}
      </View>

      <View style={styles.calendarGrid}>
        {monthDays.map((date) => {
          const isOutsideMonth = date.getMonth() !== currentMonth.getMonth();
          const isBeforeMinimumDate = startOfDay(date) < minimumDate;
          const isDisabled = isOutsideMonth || isBeforeMinimumDate;
          const isSelectedStart = parsedStartDate ? isSameDay(date, parsedStartDate) : false;
          const isSelectedEnd = parsedEndDate ? isSameDay(date, parsedEndDate) : false;
          const isInRange =
            parsedStartDate &&
            parsedEndDate &&
            startOfDay(date) > parsedStartDate &&
            startOfDay(date) < parsedEndDate;

          return (
            <Pressable
              disabled={isDisabled}
              key={formatIsoDate(date)}
              onPress={() => onSelectDate(date)}
              style={[
                styles.calendarDay,
                isSelectedStart && styles.calendarDayStart,
                isSelectedEnd && styles.calendarDayEnd,
                isInRange && styles.calendarDayInRange,
                isDisabled && styles.calendarDayDisabled,
              ]}
            >
              <Text
                style={[
                  styles.calendarDayText,
                  isOutsideMonth && styles.calendarDayTextOutsideMonth,
                  isDisabled && styles.calendarDayTextDisabled,
                  (isSelectedStart || isSelectedEnd) && styles.calendarDayTextSelected,
                ]}
              >
                {date.getDate()}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </AppCard>
  );
}

function ApplicantCard({ application, canReview, onAccept, onOpenProfile, onReject }) {
  return (
    <View style={styles.applicantCard}>
      <View style={styles.applicantHeader}>
        <UserAvatar
          avatarUrl={application.applicant.avatarUrl}
          initials={application.applicant.initials}
          name={application.applicant.name}
          onPress={onOpenProfile}
          size={44}
        />
        <View style={styles.applicantCopy}>
          <Pressable onPress={onOpenProfile}>
            <Text style={styles.applicantName}>{application.applicant.name}</Text>
          </Pressable>
          <Text style={styles.applicantMeta}>
            {application.applicant.school} - {application.applicant.rating} rating
          </Text>
        </View>
        <Text style={styles.applicantStatus}>{formatJobStatus(application.status)}</Text>
      </View>

      {canReview ? (
        <View style={styles.inlineRow}>
          <AppButton label="Accept" onPress={onAccept} style={styles.flexOne} />
          <AppButton label="Reject" onPress={onReject} style={styles.flexOne} variant="secondary" />
        </View>
      ) : null}
    </View>
  );
}

function BookingSummaryCard({
  booking,
  bookingNotice,
  isOwnerView,
  isUpdating,
  onAccept,
  onOpenProfile,
  onReject,
  onMarkCompleted,
  onMarkOngoing,
  onOpenChat,
}) {
  if (!booking && !bookingNotice) {
    return null;
  }

  return (
    <AppCard style={styles.card}>
      <View style={styles.spaceBetweenRow}>
        <View style={styles.flexOne}>
          <Text style={styles.sectionTitle}>Current booking</Text>
          <Text style={styles.metaText}>
            {booking
              ? isOwnerView
                ? 'Manage this request here or jump into chat.'
                : 'Your request details stay synced in chat.'
              : bookingNotice}
          </Text>
        </View>
        {booking ? (
          <View style={styles.statusPill}>
            <Text style={styles.statusPillText}>{formatRentalRequestStatus(booking.status)}</Text>
          </View>
        ) : null}
      </View>

      {booking ? (
        <>
          <View style={styles.inlineRow}>
            <View style={styles.infoTile}>
              <Text style={styles.infoLabel}>Dates</Text>
              <Text style={styles.infoValue}>
                {formatRentalDateRange(booking.startDate, booking.endDate)}
              </Text>
            </View>
            <View style={styles.infoTile}>
              <Text style={styles.infoLabel}>Total</Text>
              <Text style={styles.infoValue}>{formatRentalPrice(booking.totalPrice)}</Text>
            </View>
          </View>

          <View style={styles.personRow}>
            <UserAvatar
              avatarUrl={booking.renter.avatarUrl}
              initials={booking.renter.initials}
              name={booking.renter.name}
              onPress={onOpenProfile}
              size={48}
            />
            <View style={styles.flexOne}>
              <Pressable onPress={onOpenProfile}>
                <Text style={styles.requesterName}>{booking.renter.name}</Text>
              </Pressable>
              <Text style={styles.metaText}>
                {booking.renter.school} - {booking.renter.rating} rating
              </Text>
            </View>
          </View>
          {booking.note ? <Text style={styles.metaText}>{booking.note}</Text> : null}

          <AppButton label="Open booking chat" onPress={onOpenChat} variant="secondary" />

          {isOwnerView && booking.status === 'requested' ? (
            <View style={styles.inlineRow}>
              <AppButton
                disabled={isUpdating}
                label={isUpdating ? 'Updating...' : 'Accept request'}
                onPress={onAccept}
                style={styles.flexOne}
              />
              <AppButton
                disabled={isUpdating}
                label="Reject"
                onPress={onReject}
                style={styles.flexOne}
                variant="secondary"
              />
            </View>
          ) : null}

          {isOwnerView && booking.status === 'accepted' ? (
            <AppButton
              disabled={isUpdating}
              label={isUpdating ? 'Updating...' : 'Mark as Ongoing'}
              onPress={onMarkOngoing}
            />
          ) : null}

          {isOwnerView && booking.status === 'ongoing' ? (
            <AppButton
              disabled={isUpdating}
              label={isUpdating ? 'Updating...' : 'Mark as Completed'}
              onPress={onMarkCompleted}
            />
          ) : null}
        </>
      ) : null}
    </AppCard>
  );
}

function formatListingStatus(status) {
  return status === 'available' ? 'Available' : formatRentalRequestStatus(status);
}

export default function JobDetailScreen({ navigation, route }) {
  const { jobId } = route.params;
  const {
    applicationsNotice,
    currentUser,
    getJobById,
    getMyApplicationForJob,
    getOwnerApplicationsForJob,
    applyForJob,
    cancelJob,
    instantAcceptJob,
    isOwnerApplicationsLoading,
    loadOwnerApplicationsForJob,
    loadRentalRequestForListing,
    openApplicationChat,
    openJobChat,
    requestRentalBooking,
    reviewApplicationForOwnedJob,
    reviewRentalBooking,
    threads,
    updateJobStatus,
    updateRentalBookingStage,
  } = useAppState();
  const [isOpeningChat, setIsOpeningChat] = useState(false);
  const [isRentalRequestLoading, setIsRentalRequestLoading] = useState(false);
  const [rentalRequest, setRentalRequest] = useState(null);
  const [rentalRequestNotice, setRentalRequestNotice] = useState('');
  const [requestStartDate, setRequestStartDate] = useState('');
  const [requestEndDate, setRequestEndDate] = useState('');
  const [requestNote, setRequestNote] = useState('');
  const [activeCalendarField, setActiveCalendarField] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()));
  const [isSubmittingRentalRequest, setIsSubmittingRentalRequest] = useState(false);
  const [isUpdatingRentalRequest, setIsUpdatingRentalRequest] = useState(false);
  const job = getJobById(jobId);
  const isItemListing = job?.type === 'rental';
  const isSellListing = isItemListing && job.instantAccept;
  const isRentListing = isItemListing && !isSellListing;
  const statusFlow = isRentListing ? RENTAL_STATUS_FLOW : isItemListing ? ['available', 'completed'] : jobStatusFlow;
  const currentIndex = statusFlow.indexOf(job?.status);
  const canAdvance = !isItemListing && currentIndex >= 0 && currentIndex < statusFlow.length - 1;
  const isOwnJob = job?.createdBy === currentUser.id;
  const myApplication = isItemListing ? null : getMyApplicationForJob(jobId);
  const ownerApplications = isItemListing ? [] : getOwnerApplicationsForJob(jobId);
  const isLoadingOwnerApplications = isItemListing ? false : isOwnerApplicationsLoading(jobId);
  const listingOwner = job?.owner || {
    avatarUrl: null,
    id: job?.createdBy || '',
    name: job?.requester?.name || 'Student User',
    rating: Number(job?.requester?.rating ?? 5),
    school: job?.requester?.school || 'Seoul Global University',
  };
  const listingThreads = useMemo(
    () =>
      threads
        .filter((thread) => thread.listingId === jobId || thread.jobId === jobId)
        .sort((first, second) => second.updatedAt - first.updatedAt),
    [jobId, threads]
  );
  const existingThread = listingThreads[0] || null;
  const requestDays = calculateRentalDays(requestStartDate, requestEndDate);
  const requestTotal = calculateRentalTotal(job?.price, requestStartDate, requestEndDate);
  const myRentalRequest = isRentListing && !isOwnJob ? rentalRequest : null;
  const currentBookingThread =
    rentalRequest?.threadId
      ? threads.find((thread) => thread.id === rentalRequest.threadId) || null
      : existingThread;
  const hasActiveRentalRequest =
    isRentListing && rentalRequest && ['requested', 'accepted', 'ongoing'].includes(rentalRequest.status);
  const showRentalRequestForm =
    isRentListing &&
    !isOwnJob &&
    (!myRentalRequest || ['rejected', 'cancelled'].includes(myRentalRequest.status)) &&
    job.status === 'available';
  const requestSummary = useMemo(() => {
    if (!myRentalRequest) {
      return '';
    }

    if (myRentalRequest.status === 'rejected') {
      return 'This request was declined. You can send another request while the listing stays available.';
    }

    if (myRentalRequest.status === 'requested') {
      return 'Your request is pending owner review. Chat stays open for follow-up.';
    }

    if (myRentalRequest.status === 'accepted') {
      return 'Your rental is confirmed. Booking details stay synced in chat.';
    }

    if (myRentalRequest.status === 'ongoing') {
      return 'This rental is currently ongoing.';
    }

    if (myRentalRequest.status === 'completed') {
      return 'This rental is complete. Leave your review from the chat thread.';
    }

    return '';
  }, [myRentalRequest]);

  useEffect(() => {
    if (!job || !isOwnJob || isItemListing) {
      return;
    }

    loadOwnerApplicationsForJob(jobId).catch(() => {});
  }, [isItemListing, isOwnJob, job?.id, jobId]);

  useEffect(() => {
    let isActive = true;

    async function hydrateRentalRequest() {
      if (!job || !isRentListing) {
        if (isActive) {
          setRentalRequest(null);
          setRentalRequestNotice('');
          setIsRentalRequestLoading(false);
        }
        return;
      }

      setIsRentalRequestLoading(true);

      try {
        const nextRequest = await loadRentalRequestForListing(jobId);

        if (!isActive) {
          return;
        }

        setRentalRequest(nextRequest);
        setRentalRequestNotice('');
      } catch (error) {
        if (!isActive) {
          return;
        }

        setRentalRequest(null);
        setRentalRequestNotice(error.message);
      } finally {
        if (isActive) {
          setIsRentalRequestLoading(false);
        }
      }
    }

    hydrateRentalRequest();

    return () => {
      isActive = false;
    };
  }, [isRentListing, job?.status, job?.updatedAt, jobId]);

  useEffect(() => {
    if (!showRentalRequestForm && activeCalendarField) {
      setActiveCalendarField(null);
    }
  }, [activeCalendarField, showRentalRequestForm]);

  if (!job) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>Listing not found</Text>
        <AppButton label="Go back" onPress={() => navigation.goBack()} style={styles.inlineButton} />
      </View>
    );
  }

  const navigateToThread = (thread) => {
    if (!thread) {
      return;
    }

    navigation.navigate(ROOT_ROUTES.MAIN_TABS, {
      params: {
        openThreadId: thread.id,
        openThreadName: thread.participant.name,
        openThreadNonce: Date.now(),
      },
      screen: TAB_ROUTES.MESSAGES,
    });
  };

  const handleOpenUserProfile = (userId) => {
    if (!userId) {
      return;
    }

    navigation.navigate(ROOT_ROUTES.USER_PROFILE, {
      userId,
    });
  };

  const refreshRentalRequest = async () => {
    if (!isRentListing) {
      return null;
    }

    const nextRequest = await loadRentalRequestForListing(jobId);
    setRentalRequest(nextRequest);
    setRentalRequestNotice('');
    return nextRequest;
  };

  const openCalendar = (field) => {
    const seedDate =
      parseRentalDateInput(
        field === 'start' ? requestStartDate : requestEndDate || requestStartDate
      ) || new Date();

    setCalendarMonth(startOfMonth(seedDate));
    setActiveCalendarField(field);
  };

  const handleCalendarDateSelect = (date) => {
    const isoDate = formatIsoDate(date);

    if (activeCalendarField === 'start') {
      setRequestStartDate(isoDate);

      if (!requestEndDate || calculateRentalDays(isoDate, requestEndDate) === null) {
        setRequestEndDate(isoDate);
      }

      setCalendarMonth(startOfMonth(date));
      setActiveCalendarField('end');
      return;
    }

    if (activeCalendarField === 'end') {
      if (!requestStartDate || calculateRentalDays(requestStartDate, isoDate) === null) {
        setRequestStartDate(isoDate);
      }

      setRequestEndDate(isoDate);
      setCalendarMonth(startOfMonth(date));
      setActiveCalendarField(null);
    }
  };

  const handleAdvance = async () => {
    if (!canAdvance) {
      return;
    }

    try {
      await updateJobStatus(job.id, statusFlow[currentIndex + 1]);
    } catch (error) {
      Alert.alert('Update failed', error.message || 'We could not update the job status.');
    }
  };

  const handleCancel = async () => {
    try {
      await cancelJob(job.id);
      Alert.alert(
        isItemListing ? 'Listing cancelled' : 'Job cancelled',
        isItemListing
          ? 'This listing has been marked as cancelled.'
          : 'This task has been marked as cancelled.'
      );
    } catch (error) {
      Alert.alert(
        'Cancel failed',
        error.message || `We could not cancel this ${isItemListing ? 'listing' : 'job'}.`
      );
    }
  };

  const handleMessageRequester = async () => {
    setIsOpeningChat(true);

    try {
      const thread = await openJobChat(job.id);

      if (thread) {
        navigateToThread(thread);
      }
    } catch (error) {
      Alert.alert('Chat unavailable', error.message || 'We could not open this listing conversation.');
    } finally {
      setIsOpeningChat(false);
    }
  };

  const handleOpenBookingChat = async () => {
    if (currentBookingThread) {
      navigateToThread(currentBookingThread);
      return;
    }

    if (!isOwnJob) {
      await handleMessageRequester();
      return;
    }

    Alert.alert(
      'Chat still syncing',
      'The booking conversation is still loading. Try again in a moment.'
    );
  };

  const handleReviewApplication = async (applicationId, nextStatus) => {
    try {
      const result = await reviewApplicationForOwnedJob(applicationId, nextStatus);

      if (nextStatus === 'accepted') {
        const thread = await openApplicationChat(applicationId);

        if (thread) {
          navigateToThread(thread);
          return;
        }
      }

      Alert.alert(
        nextStatus === 'accepted' ? 'Applicant accepted' : 'Applicant rejected',
        nextStatus === 'accepted'
          ? 'The job is now assigned to this student.'
          : 'This application has been declined.'
      );
    } catch (error) {
      Alert.alert('Review failed', error.message || 'We could not update this application right now.');
    }
  };

  const handleSubmitRentalRequest = async () => {
    if (!isValidRentalDateInput(requestStartDate) || !isValidRentalDateInput(requestEndDate)) {
      Alert.alert('Missing dates', 'Choose both rental dates from the calendar before sending the request.');
      return;
    }

    if (!requestDays || requestTotal === null) {
      Alert.alert('Invalid range', 'Choose a valid rental range to calculate the total.');
      return;
    }

    setIsSubmittingRentalRequest(true);

    try {
      const result = await requestRentalBooking({
        listingId: job.id,
        note: requestNote,
        startDate: requestStartDate,
        endDate: requestEndDate,
      });

      const nextRequest = await refreshRentalRequest();
      setRequestStartDate('');
      setRequestEndDate('');
      setRequestNote('');
      setActiveCalendarField(null);
      const nextThread =
        result.thread ||
        threads.find((thread) => thread.id === result.threadId) ||
        (nextRequest?.threadId
          ? threads.find((thread) => thread.id === nextRequest.threadId) || null
          : null) ||
        existingThread;

      if (nextThread) {
        navigateToThread(nextThread);
      }
    } catch (error) {
      Alert.alert('Request failed', error.message || 'We could not send this rental request.');
    } finally {
      setIsSubmittingRentalRequest(false);
    }
  };

  const handleReviewRentalRequest = async (nextStatus) => {
    if (!rentalRequest) {
      return;
    }

    setIsUpdatingRentalRequest(true);

    try {
      const result = await reviewRentalBooking(rentalRequest.id, nextStatus);
      const nextRequest = await refreshRentalRequest();

      if (nextStatus === 'accepted') {
        const nextThread =
          result.thread ||
          threads.find((thread) => thread.id === result.threadId) ||
          (nextRequest?.threadId
            ? threads.find((thread) => thread.id === nextRequest.threadId) || null
            : null) ||
          currentBookingThread;

        if (nextThread) {
          navigateToThread(nextThread);
        }
      }
    } catch (error) {
      Alert.alert('Update failed', error.message || 'We could not review this rental request.');
    } finally {
      setIsUpdatingRentalRequest(false);
    }
  };

  const handleAdvanceRentalStage = async (nextStatus) => {
    if (!rentalRequest) {
      return;
    }

    setIsUpdatingRentalRequest(true);

    try {
      await updateRentalBookingStage(rentalRequest.id, nextStatus);
      await refreshRentalRequest();
    } catch (error) {
      Alert.alert('Update failed', error.message || 'We could not update this rental status.');
    } finally {
      setIsUpdatingRentalRequest(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.container}>
      {job.imageUrls?.length ? (
        <ScrollView contentContainerStyle={styles.galleryRow} horizontal showsHorizontalScrollIndicator={false}>
          {job.imageUrls.map((imageUrl) => (
            <Image key={imageUrl} source={{ uri: imageUrl }} style={styles.galleryImage} />
          ))}
        </ScrollView>
      ) : null}

      <AppCard style={styles.card}>
        <View style={styles.spaceBetweenRow}>
          <View style={styles.flexOne}>
            <Text style={styles.category}>{job.category}</Text>
            <Text style={styles.title}>{job.title}</Text>
          </View>
          <Text style={styles.price}>
            {isRentListing ? `${formatJobPrice(job.price)}/day` : formatJobPrice(job.price)}
          </Text>
        </View>
        <Text style={styles.description}>{job.description}</Text>
        <Text style={styles.metaText}>Address: {job.location}</Text>
        <Text style={styles.metaText}>
          {isItemListing ? 'Availability' : 'When'}: {job.date}, {job.time}
        </Text>
        <Text style={styles.metaText}>Distance: {formatJobDistance(job.distance)} away</Text>
      </AppCard>

      <AppCard style={styles.card}>
        <Text style={styles.sectionTitle}>Posted by</Text>
        <View style={styles.personRow}>
          <UserAvatar
            avatarUrl={listingOwner.avatarUrl}
            name={listingOwner.name}
            onPress={() => handleOpenUserProfile(listingOwner.id)}
            size={52}
          />
          <View style={styles.flexOne}>
            <Pressable onPress={() => handleOpenUserProfile(listingOwner.id)}>
              <Text style={styles.requesterName}>{listingOwner.name}</Text>
            </Pressable>
            <Text style={styles.metaText}>
              {listingOwner.school} - {listingOwner.rating} rating
            </Text>
          </View>
        </View>
      </AppCard>

      <AppCard style={styles.card}>
        <Text style={styles.sectionTitle}>Listing status</Text>
        <View style={styles.timeline}>
          {statusFlow.map((status, index) => (
            <View key={status} style={styles.timelineItem}>
              <View style={[styles.timelineDot, currentIndex >= index && styles.timelineDotActive]} />
              <Text style={[styles.timelineText, currentIndex >= index && styles.timelineTextActive]}>
                {isItemListing ? formatListingStatus(status) : formatJobStatus(status)}
              </Text>
            </View>
          ))}
          {job.status === 'cancelled' ? (
            <View style={styles.timelineItem}>
              <View style={[styles.timelineDot, styles.timelineDotCancelled]} />
              <Text style={[styles.timelineText, styles.timelineTextCancelled]}>Cancelled</Text>
            </View>
          ) : null}
        </View>
      </AppCard>

      {isRentListing ? (
        <BookingSummaryCard
          booking={rentalRequest}
          bookingNotice={isRentalRequestLoading ? 'Loading the latest request details...' : rentalRequestNotice}
          isOwnerView={isOwnJob}
          isUpdating={isUpdatingRentalRequest}
          onAccept={() => handleReviewRentalRequest('accepted')}
          onOpenProfile={() => handleOpenUserProfile(rentalRequest?.renter?.id)}
          onMarkCompleted={() => handleAdvanceRentalStage('completed')}
          onMarkOngoing={() => handleAdvanceRentalStage('ongoing')}
          onOpenChat={handleOpenBookingChat}
          onReject={() => handleReviewRentalRequest('rejected')}
        />
      ) : null}

      {showRentalRequestForm ? (
        <AppCard style={styles.card}>
          <Text style={styles.sectionTitle}>Request this rental</Text>
          <Text style={styles.metaText}>
            Pick your dates, review the total, and the owner will receive the request in chat.
          </Text>

          <View style={styles.inlineRow}>
            <Pressable
              onPress={() => openCalendar('start')}
              style={[
                styles.dateField,
                styles.flexOne,
                activeCalendarField === 'start' && styles.dateFieldActive,
              ]}
            >
              <Text style={styles.inputLabel}>Start date</Text>
              <Text style={[styles.dateFieldValue, !requestStartDate && styles.dateFieldPlaceholder]}>
                {requestStartDate ? formatRentalDate(requestStartDate) : 'Select start date'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => openCalendar('end')}
              style={[
                styles.dateField,
                styles.flexOne,
                activeCalendarField === 'end' && styles.dateFieldActive,
              ]}
            >
              <Text style={styles.inputLabel}>End date</Text>
              <Text style={[styles.dateFieldValue, !requestEndDate && styles.dateFieldPlaceholder]}>
                {requestEndDate ? formatRentalDate(requestEndDate) : 'Select end date'}
              </Text>
            </Pressable>
          </View>

          <Text style={styles.calendarHelper}>
            Tap a date field to open the calendar and choose the rental range.
          </Text>

          {activeCalendarField ? (
            <RentalCalendar
              activeField={activeCalendarField}
              currentMonth={calendarMonth}
              onChangeMonth={(offset) => setCalendarMonth((prev) => shiftMonth(prev, offset))}
              onClose={() => setActiveCalendarField(null)}
              onSelectDate={handleCalendarDateSelect}
              selectedEndDate={requestEndDate}
              selectedStartDate={requestStartDate}
            />
          ) : null}

          <View style={styles.inlineRow}>
            <View style={styles.infoTile}>
              <Text style={styles.infoLabel}>Days</Text>
              <Text style={styles.infoValue}>{requestDays || 0}</Text>
            </View>
            <View style={styles.infoTile}>
              <Text style={styles.infoLabel}>Total</Text>
              <Text style={styles.infoValue}>
                {requestTotal === null ? 'Enter dates' : formatRentalPrice(requestTotal)}
              </Text>
            </View>
          </View>

          <Text style={styles.inputLabel}>Message to owner</Text>
          <AppTextInput
            multiline
            onChangeText={setRequestNote}
            placeholder="Optional note about pickup, return, or timing"
            style={styles.noteInput}
            value={requestNote}
          />

          <AppButton
            disabled={isSubmittingRentalRequest}
            label={isSubmittingRentalRequest ? 'Sending request...' : 'Send rental request'}
            onPress={handleSubmitRentalRequest}
          />
        </AppCard>
      ) : null}

      {myRentalRequest && requestSummary ? (
        <AppCard style={styles.card}>
          <Text style={styles.sectionTitle}>Your rental request</Text>
          <Text style={styles.metaText}>{requestSummary}</Text>
        </AppCard>
      ) : null}

      {isOwnJob && !isItemListing ? (
        <AppCard style={styles.card}>
          <Text style={styles.sectionTitle}>Applicants</Text>
          {isLoadingOwnerApplications ? (
            <Text style={styles.metaText}>Loading applicants for this job...</Text>
          ) : applicationsNotice ? (
            <Text style={styles.metaText}>{applicationsNotice}</Text>
          ) : ownerApplications.length ? (
            ownerApplications.map((application) => (
              <ApplicantCard
                application={application}
                canReview={job.status === 'posted' && application.status === 'pending'}
                key={application.id}
                onAccept={() => handleReviewApplication(application.id, 'accepted')}
                onOpenProfile={() => handleOpenUserProfile(application.applicant.id)}
                onReject={() => handleReviewApplication(application.id, 'rejected')}
              />
            ))
          ) : (
            <Text style={styles.metaText}>No one has applied yet. New applications will appear here.</Text>
          )}
        </AppCard>
      ) : null}

      <View style={styles.actions}>
        {!isOwnJob ? (
          <>
            <AppButton
              disabled={isOpeningChat}
              label={isOpeningChat ? 'Opening chat...' : existingThread ? 'Open conversation' : 'Message owner'}
              onPress={handleMessageRequester}
              variant="secondary"
            />
            <Text style={styles.messageHint}>
              {existingThread
                ? 'This opens your conversation inside Messages.'
                : 'Start a conversation about this listing and it will appear in Messages.'}
            </Text>
          </>
        ) : null}

        {!isOwnJob && myApplication?.status === 'pending' ? (
          <AppButton disabled label="Application sent" variant="secondary" />
        ) : null}

        {!isOwnJob && myApplication?.status === 'accepted' ? (
          <AppButton disabled label="You accepted this job" variant="secondary" />
        ) : null}

        {!isOwnJob && !isItemListing && job.status === 'posted' && !myApplication ? (
          <>
            <AppButton label="Apply for job" onPress={async () => {
              try {
                await applyForJob(job.id);
              } catch (error) {
                Alert.alert('Apply failed', error.message || 'We could not apply for this job.');
              }
            }} />
            {job.instantAccept ? (
              <AppButton label="Instant accept" onPress={async () => {
                try {
                  await instantAcceptJob(job.id);
                } catch (error) {
                  Alert.alert('Accept failed', error.message || 'We could not instantly accept this job.');
                }
              }} variant="secondary" />
            ) : null}
          </>
        ) : null}

        {isOwnJob && canAdvance && job.status !== 'cancelled' ? (
          <AppButton
            label={`Move to ${formatJobStatus(statusFlow[currentIndex + 1])}`}
            onPress={handleAdvance}
            variant="secondary"
          />
        ) : null}

        {isOwnJob && job.status !== 'completed' && job.status !== 'cancelled' && !hasActiveRentalRequest ? (
          <AppButton
            label={isItemListing ? 'Close listing' : 'Cancel job'}
            onPress={handleCancel}
            variant="ghost"
          />
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.background, flex: 1 },
  content: { gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing.xxl },
  card: { gap: spacing.sm, padding: spacing.lg },
  galleryRow: { gap: spacing.md, paddingRight: spacing.lg },
  galleryImage: { borderRadius: 22, height: 220, width: 260 },
  category: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  title: { color: colors.text, fontSize: 26, fontWeight: '800', lineHeight: 31, marginTop: 8 },
  price: { color: colors.text, fontSize: 28, fontWeight: '800' },
  description: { color: colors.secondaryText, fontSize: 15, lineHeight: 23 },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  requesterName: { color: colors.text, fontSize: 16, fontWeight: '700' },
  metaText: { color: colors.secondaryText, fontSize: 14, lineHeight: 21 },
  timeline: { gap: spacing.sm },
  timelineItem: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  timelineDot: { backgroundColor: '#D8D4CB', borderRadius: 999, height: 12, width: 12 },
  timelineDotActive: { backgroundColor: colors.primary },
  timelineDotCancelled: { backgroundColor: colors.danger },
  timelineText: { color: colors.subtleText, fontSize: 14, fontWeight: '600' },
  timelineTextActive: { color: colors.text },
  timelineTextCancelled: { color: colors.danger },
  applicantCard: { backgroundColor: colors.background, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, padding: spacing.md },
  applicantHeader: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm },
  applicantCopy: { flex: 1 },
  applicantName: { color: colors.text, fontSize: 15, fontWeight: '800' },
  applicantMeta: { color: colors.secondaryText, fontSize: 12, marginTop: 2 },
  applicantStatus: { color: colors.primary, fontSize: 12, fontWeight: '800' },
  personRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  spaceBetweenRow: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between' },
  inlineRow: { flexDirection: 'row', gap: spacing.sm },
  flexOne: { flex: 1 },
  statusPill: { backgroundColor: colors.primarySoft, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7 },
  statusPillText: { color: colors.primary, fontSize: 12, fontWeight: '800' },
  infoTile: { backgroundColor: colors.background, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, flex: 1, padding: spacing.md },
  infoLabel: { color: colors.subtleText, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  infoValue: { color: colors.text, fontSize: 15, fontWeight: '800', lineHeight: 21, marginTop: 6 },
  inputLabel: { color: colors.subtleText, fontSize: 12, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase' },
  dateField: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  dateFieldActive: {
    borderColor: colors.primary,
    backgroundColor: '#F2F7FF',
  },
  dateFieldValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
  },
  dateFieldPlaceholder: {
    color: colors.subtleText,
    fontWeight: '600',
  },
  calendarHelper: {
    color: colors.subtleText,
    fontSize: 12,
    lineHeight: 18,
  },
  calendarCard: {
    gap: spacing.sm,
    padding: spacing.md,
  },
  calendarHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  calendarTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  calendarSubtitle: {
    color: colors.secondaryText,
    fontSize: 13,
    marginTop: 4,
  },
  calendarCloseButton: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  calendarCloseText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  calendarMonthRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  calendarMonthButton: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  calendarMonthButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  calendarMonthLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  calendarWeekRow: {
    flexDirection: 'row',
  },
  calendarWeekday: {
    color: colors.subtleText,
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDay: {
    alignItems: 'center',
    borderRadius: 16,
    height: 42,
    justifyContent: 'center',
    marginVertical: 3,
    width: '14.2857%',
  },
  calendarDayDisabled: {
    opacity: 0.28,
  },
  calendarDayStart: {
    backgroundColor: '#EAF2FF',
  },
  calendarDayEnd: {
    backgroundColor: '#DDEEDB',
  },
  calendarDayInRange: {
    backgroundColor: '#F4F7FB',
  },
  calendarDayText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  calendarDayTextOutsideMonth: {
    color: colors.subtleText,
  },
  calendarDayTextDisabled: {
    color: colors.subtleText,
  },
  calendarDayTextSelected: {
    fontWeight: '800',
  },
  noteInput: { minHeight: 112, textAlignVertical: 'top' },
  actions: { gap: spacing.sm },
  messageHint: { color: colors.subtleText, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  emptyState: { alignItems: 'center', backgroundColor: colors.background, flex: 1, gap: spacing.md, justifyContent: 'center', padding: spacing.lg },
  emptyTitle: { color: colors.text, fontSize: 20, fontWeight: '800' },
  inlineButton: { minWidth: 120 },
});
