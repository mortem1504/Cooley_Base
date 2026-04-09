import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import {
  applyToJobListing,
  fetchMyJobApplications,
  fetchOwnerApplicationsForListing,
  reviewOwnerApplication,
} from '../services/applicationsService';
import {
  ensureProfileForUser,
  fetchProfileById,
  getCurrentSession,
  onAuthStateChange,
  signInWithIdentifier,
  signOutUser,
  signUpWithEmail,
} from '../services/authService';
import {
  createOrGetApplicationThread,
  createOrGetListingThread,
  fetchThreadById,
  fetchMessagesForThread,
  fetchThreadsForUser,
  markThreadAsRead,
  mapRealtimeMessageRow,
  sendThreadMessage as sendThreadMessageRecord,
} from '../services/chatService';
import { jobCategories } from '../services/jobService';
import {
  createListing,
  deleteOwnedListing,
  fetchListings,
  updateListingDetails,
  updateListingStatus,
} from '../services/listingsService';
import {
  advanceRentalBookingStage,
  fetchRentalRequestByListing,
  fetchRentalRequestByThread,
  requestRentalBooking as requestRentalBookingRecord,
  reviewRentalBooking as reviewRentalBookingRecord,
  submitRentalReview as submitRentalReviewRecord,
} from '../services/rentalService';
import {
  calculateDistanceKm,
  getCurrentLocationSnapshot,
  isValidCoordinate,
} from '../services/locationService';
import {
  buildCurrentUserProfile,
  emptyUserProfile,
  updateProfileById,
} from '../services/profileService';
import { getSupabaseClient } from '../services/supabaseClient';

const AppContext = createContext(null);
const DEFAULT_MAX_DISTANCE_KM = 25;
const DEFAULT_MAX_PRICE = 500;

function buildDefaultFilters() {
  return {
    search: '',
    category: jobCategories[0],
    maxPrice: DEFAULT_MAX_PRICE,
    maxDistance: DEFAULT_MAX_DISTANCE_KM,
  };
}

function matchesSearch(job, query) {
  if (!query) {
    return true;
  }

  const target = `${job.title} ${job.description} ${job.category} ${job.location}`.toLowerCase();
  return target.includes(query.trim().toLowerCase());
}

function upsertById(collection, nextItem) {
  return [nextItem, ...collection.filter((item) => item.id !== nextItem.id)].sort(
    (first, second) => second.createdAt - first.createdAt
  );
}

function dedupeById(collection) {
  const seenIds = new Set();

  return collection.filter((item) => {
    const nextId = item?.id;

    if (!nextId || seenIds.has(nextId)) {
      return false;
    }

    seenIds.add(nextId);
    return true;
  });
}

function upsertThreadById(collection, nextThread) {
  return [nextThread, ...collection.filter((thread) => thread.id !== nextThread.id)].sort(
    (first, second) => second.updatedAt - first.updatedAt
  );
}

function upsertMessageById(collection, nextMessage) {
  return [...collection.filter((message) => message.id !== nextMessage.id), nextMessage].sort(
    (first, second) => first.createdAt - second.createdAt
  );
}

function patchCurrentUserIntoListings(collection, profile) {
  if (!profile?.id) {
    return collection;
  }

  return collection.map((listing) => {
    if (listing.createdBy !== profile.id) {
      return listing;
    }

    return {
      ...listing,
      owner: {
        ...listing.owner,
        avatarUrl: profile.avatarUrl,
        id: profile.id,
        isVerified: profile.isVerified,
        name: profile.name,
        rating: profile.rating,
        school: profile.schoolName,
      },
      requester: {
        ...listing.requester,
        avatarUrl: profile.avatarUrl,
        id: profile.id,
        isVerified: profile.isVerified,
        name: profile.name,
        rating: profile.rating,
        school: profile.schoolName,
      },
    };
  });
}

async function hydrateCurrentUser(authUser) {
  if (!authUser) {
    return emptyUserProfile;
  }

  try {
    await ensureProfileForUser(authUser);
    const profile = await fetchProfileById(authUser.id);
    return buildCurrentUserProfile(authUser, profile);
  } catch (error) {
    return buildCurrentUserProfile(authUser, null);
  }
}

export function AppProvider({ children }) {
  const [authMode, setAuthMode] = useState('login');
  const [authNotice, setAuthNotice] = useState('');
  const [session, setSession] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isListingsLoading, setIsListingsLoading] = useState(false);
  const [listingsNotice, setListingsNotice] = useState('');
  const [viewerLocation, setViewerLocation] = useState(null);
  const [isLocationLoading, setIsLocationLoading] = useState(false);
  const [locationNotice, setLocationNotice] = useState('');
  const [currentUser, setCurrentUser] = useState(emptyUserProfile);
  const [jobs, setJobs] = useState([]);
  const [jobApplications, setJobApplications] = useState({});
  const [ownerApplicationsByListing, setOwnerApplicationsByListing] = useState({});
  const [isOwnerApplicationsLoadingByListing, setIsOwnerApplicationsLoadingByListing] = useState({});
  const [applicationsNotice, setApplicationsNotice] = useState('');
  const [rentals, setRentals] = useState([]);
  const [messageThreads, setMessageThreads] = useState([]);
  const [messagesByThread, setMessagesByThread] = useState({});
  const [isThreadsLoading, setIsThreadsLoading] = useState(false);
  const [isMessagesLoadingByThread, setIsMessagesLoadingByThread] = useState({});
  const [threadsNotice, setThreadsNotice] = useState('');
  const [messageNoticeByThread, setMessageNoticeByThread] = useState({});
  const [filters, setFilters] = useState(buildDefaultFilters);
  const ownerApplicationsCacheRef = useRef({});
  const isThreadSyncInFlightRef = useRef(false);
  const pendingThreadSyncRef = useRef(false);
  const isMarketplaceSyncInFlightRef = useRef(false);
  const pendingMarketplaceSyncOptionsRef = useRef(null);
  const jobsWithViewerState = useMemo(
    () =>
      dedupeById(
        jobs.map((job) => {
          const myApplication = jobApplications[job.id] || null;
          const liveDistance =
            viewerLocation &&
            isValidCoordinate(job.latitude) &&
            isValidCoordinate(job.longitude)
              ? calculateDistanceKm(viewerLocation, {
                  latitude: job.latitude,
                  longitude: job.longitude,
                })
              : null;

          return {
            ...job,
            distance: liveDistance ?? job.distance,
            hasApplied: Boolean(myApplication),
            myApplicationStatus: myApplication?.status || null,
          };
        })
      ),
    [jobApplications, jobs, viewerLocation]
  );
  const rentalsWithViewerState = useMemo(
    () =>
      dedupeById(
        rentals.map((rental) => {
          const liveDistance =
            viewerLocation &&
            isValidCoordinate(rental.latitude) &&
            isValidCoordinate(rental.longitude)
              ? calculateDistanceKm(viewerLocation, {
                  latitude: rental.latitude,
                  longitude: rental.longitude,
                })
              : null;

          return {
            ...rental,
            distance: liveDistance ?? rental.distance,
          };
        })
      ),
    [rentals, viewerLocation]
  );

  const filteredJobs = useMemo(
    () =>
      jobsWithViewerState.filter(
        (job) =>
          matchesSearch(job, filters.search) &&
          (filters.category === 'All' || job.category === filters.category) &&
          job.price <= filters.maxPrice &&
          job.distance <= filters.maxDistance
      ),
    [filters, jobsWithViewerState]
  );
  const isAuthenticated = Boolean(session?.user);
  const threads = useMemo(
    () => [...messageThreads].sort((first, second) => second.updatedAt - first.updatedAt),
    [messageThreads]
  );
  const unreadThreadCount = useMemo(
    () => threads.filter((thread) => thread.unreadCount > 0).length,
    [threads]
  );
  const myListings = useMemo(() => {
    const postedJobs = jobs
      .filter((job) => job.createdBy === currentUser.id)
      .map((job) => ({
        id: job.id,
        type: 'job',
        listingMode: 'job',
        title: job.title,
        category: job.category,
        coverImageUrl: job.coverImageUrl,
        location: job.location,
        price: job.price,
        status: job.status,
        detail: `${job.date} - ${job.time}`,
        createdAt: job.createdAt || 0,
      }));

    const postedRentals = rentals
      .filter((rental) => rental.createdBy === currentUser.id)
      .map((rental) => ({
        id: rental.id,
        type: 'rental',
        listingMode: rental.instantAccept ? 'sell' : 'rent',
        title: rental.title,
        category: rental.category,
        coverImageUrl: rental.coverImageUrl,
        location: rental.location,
        price: rental.price,
        status: rental.status,
        detail: rental.instantAccept
          ? rental.urgent
            ? 'For sale - Available now'
            : 'For sale'
          : rental.urgent
            ? `${rental.durationText || rental.duration || 'Flexible'} - Available now`
            : rental.durationText || rental.duration || 'Flexible',
        createdAt: rental.createdAt || 0,
      }));

    return [...postedJobs, ...postedRentals].sort((first, second) => second.createdAt - first.createdAt);
  }, [currentUser.id, jobs, rentals]);

  useEffect(() => {
    ownerApplicationsCacheRef.current = ownerApplicationsByListing;
  }, [ownerApplicationsByListing]);

  const refreshViewerLocation = async () => {
    setIsLocationLoading(true);

    try {
      const nextLocation = await getCurrentLocationSnapshot();
      setViewerLocation(nextLocation);
      setLocationNotice('');
      return nextLocation;
    } catch (error) {
      setViewerLocation(null);
      setLocationNotice(error.message);
      throw error;
    } finally {
      setIsLocationLoading(false);
    }
  };

  const resetFilters = () => {
    setFilters(buildDefaultFilters());
  };

  async function syncThreadsState(userId) {
    if (!userId) {
      return [];
    }

    if (isThreadSyncInFlightRef.current) {
      pendingThreadSyncRef.current = true;
      return [];
    }

    isThreadSyncInFlightRef.current = true;

    try {
      const liveThreads = await fetchThreadsForUser(userId);
      setMessageThreads(liveThreads);
      setThreadsNotice('');
      return liveThreads;
    } catch (error) {
      setThreadsNotice(error.message);
      throw error;
    } finally {
      isThreadSyncInFlightRef.current = false;

      if (pendingThreadSyncRef.current) {
        pendingThreadSyncRef.current = false;
        syncThreadsState(userId).catch(() => {});
      }
    }
  }

  async function refreshMarketplaceState(userId, options = {}) {
    const { preserveOwnerApplications = false } = options;
    const [liveListings, myApplications] = await Promise.all([
      fetchListings(),
      fetchMyJobApplications(userId),
    ]);

    setJobs(liveListings.filter((listing) => listing.type === 'job'));
    setJobApplications(myApplications);

    if (preserveOwnerApplications) {
      const cachedListingIds = Object.keys(ownerApplicationsCacheRef.current);

      if (cachedListingIds.length) {
        const refreshedEntries = await Promise.all(
          cachedListingIds.map(async (listingId) => [
            listingId,
            await fetchOwnerApplicationsForListing(listingId),
          ])
        );

        setOwnerApplicationsByListing(Object.fromEntries(refreshedEntries));
      }
    } else {
      setOwnerApplicationsByListing({});
      setIsOwnerApplicationsLoadingByListing({});
      setApplicationsNotice('');
    }

    setRentals(liveListings.filter((listing) => listing.type === 'rental'));
    setListingsNotice('');
  }

  async function syncMarketplaceState(userId, options = {}) {
    if (!userId) {
      return;
    }

    const normalizedOptions = {
      preserveOwnerApplications: Boolean(options.preserveOwnerApplications),
    };

    if (isMarketplaceSyncInFlightRef.current) {
      pendingMarketplaceSyncOptionsRef.current = pendingMarketplaceSyncOptionsRef.current
        ? {
            preserveOwnerApplications:
              pendingMarketplaceSyncOptionsRef.current.preserveOwnerApplications ||
              normalizedOptions.preserveOwnerApplications,
          }
        : normalizedOptions;
      return;
    }

    isMarketplaceSyncInFlightRef.current = true;

    try {
      await refreshMarketplaceState(userId, normalizedOptions);
    } finally {
      isMarketplaceSyncInFlightRef.current = false;

      if (pendingMarketplaceSyncOptionsRef.current) {
        const queuedOptions = pendingMarketplaceSyncOptionsRef.current;
        pendingMarketplaceSyncOptionsRef.current = null;
        await syncMarketplaceState(userId, queuedOptions);
      }
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function hydrateThreads() {
      if (!session?.user) {
        if (isMounted) {
          setMessageThreads([]);
          setMessagesByThread({});
          setMessageNoticeByThread({});
          setIsMessagesLoadingByThread({});
          setIsThreadsLoading(false);
          setThreadsNotice('');
        }
        return;
      }

      setThreadsNotice('');
      setIsThreadsLoading(true);

      try {
        const liveThreads = await syncThreadsState(session.user.id);

        if (!isMounted) {
          return;
        }

        setMessageThreads(liveThreads);
        setThreadsNotice('');
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setMessageThreads([]);
        setMessagesByThread({});
        setMessageNoticeByThread({});
        setIsMessagesLoadingByThread({});
        setThreadsNotice(error.message);
      } finally {
        if (isMounted) {
          setIsThreadsLoading(false);
        }
      }
    }

    hydrateThreads();

    return () => {
      isMounted = false;
    };
  }, [session?.user?.id]);

  useEffect(() => {
    if (!session?.user) {
      return undefined;
    }

    const client = getSupabaseClient();

    const channel = client
      .channel(`chat-sync-${session.user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'threads' },
        () => {
          syncThreadsState(session.user.id).catch(() => {});
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'thread_members' },
        () => {
          syncThreadsState(session.user.id).catch(() => {});
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const nextMessage = mapRealtimeMessageRow(payload.new);

          setMessagesByThread((prev) => {
            const currentMessages = prev[payload.new.thread_id];

            if (!currentMessages) {
              return prev;
            }

            return {
              ...prev,
              [payload.new.thread_id]: upsertMessageById(currentMessages, nextMessage),
            };
          });

          syncThreadsState(session.user.id).catch(() => {});
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          syncThreadsState(session.user.id).catch(() => {});
        }

        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          syncThreadsState(session.user.id).catch(() => {});
        }
      });

    return () => {
      client.removeChannel(channel);
    };
  }, [session?.user?.id]);

  useEffect(() => {
    if (!session?.user) {
      return undefined;
    }

    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        syncThreadsState(session.user.id).catch(() => {});
      }
    });

    return () => {
      appStateSubscription.remove();
    };
  }, [session?.user?.id]);

  useEffect(() => {
    if (!session?.user) {
      return undefined;
    }

    const intervalId = setInterval(() => {
      syncThreadsState(session.user.id).catch(() => {});
    }, 15000);

    return () => {
      clearInterval(intervalId);
    };
  }, [session?.user?.id]);

  useEffect(() => {
    let isMounted = true;

    async function hydrateViewerLocation() {
      if (!session?.user) {
        if (isMounted) {
          setViewerLocation(null);
          setLocationNotice('');
          setIsLocationLoading(false);
        }
        return;
      }

      setIsLocationLoading(true);

      try {
        const nextLocation = await getCurrentLocationSnapshot();

        if (!isMounted) {
          return;
        }

        setViewerLocation(nextLocation);
        setLocationNotice('');
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setViewerLocation(null);
        setLocationNotice(error.message);
      } finally {
        if (isMounted) {
          setIsLocationLoading(false);
        }
      }
    }

    hydrateViewerLocation();

    return () => {
      isMounted = false;
    };
  }, [session?.user?.id]);

  useEffect(() => {
    let isMounted = true;

    async function hydrateListings() {
      if (!session?.user) {
        if (isMounted) {
          setJobs([]);
          setJobApplications({});
          setOwnerApplicationsByListing({});
          setIsOwnerApplicationsLoadingByListing({});
          setApplicationsNotice('');
          setRentals([]);
          setListingsNotice('');
          setIsListingsLoading(false);
        }
        return;
      }

      setIsListingsLoading(true);

      try {
        await syncMarketplaceState(session.user.id);

        if (!isMounted) {
          return;
        }
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setJobs([]);
        setJobApplications({});
        setOwnerApplicationsByListing({});
        setIsOwnerApplicationsLoadingByListing({});
        setApplicationsNotice('');
        setRentals([]);
        setListingsNotice(error.message);
      } finally {
        if (isMounted) {
          setIsListingsLoading(false);
        }
      }
    }

    hydrateListings();

    return () => {
      isMounted = false;
    };
  }, [session?.user?.id]);

  useEffect(() => {
    if (!session?.user) {
      return undefined;
    }

    const client = getSupabaseClient();
    let isActive = true;

    const syncMarketplace = async () => {
      try {
        await syncMarketplaceState(session.user.id, {
          preserveOwnerApplications: true,
        });

        if (!isActive) {
          return;
        }

        setApplicationsNotice('');
      } catch (error) {
        if (isActive) {
          setListingsNotice(error.message);
        }
      }
    };

    const channel = client
      .channel(`marketplace-sync-${session.user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'listings' },
        () => {
          syncMarketplace();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'listing_images' },
        () => {
          syncMarketplace();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'applications' },
        () => {
          syncMarketplace();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          syncMarketplace();
        }

        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          syncMarketplace();
        }
      });

    return () => {
      isActive = false;
      client.removeChannel(channel);
    };
  }, [session?.user?.id]);

  useEffect(() => {
    if (!session?.user) {
      return undefined;
    }

    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        syncMarketplaceState(session.user.id, {
          preserveOwnerApplications: true,
        }).catch(() => {});
      }
    });

    return () => {
      appStateSubscription.remove();
    };
  }, [session?.user?.id]);

  useEffect(() => {
    if (!session?.user) {
      return undefined;
    }

    const intervalId = setInterval(() => {
      syncMarketplaceState(session.user.id, {
        preserveOwnerApplications: true,
      }).catch(() => {});
    }, 15000);

    return () => {
      clearInterval(intervalId);
    };
  }, [session?.user?.id]);

  useEffect(() => {
    let isMounted = true;

    async function bootstrapAuth() {
      try {
        const activeSession = await getCurrentSession();

        if (!isMounted) {
          return;
        }

        setSession(activeSession);
        setAuthNotice('');

        if (activeSession?.user) {
          const hydratedUser = await hydrateCurrentUser(activeSession.user);

          if (!isMounted) {
            return;
          }

          setCurrentUser(hydratedUser);
        } else {
          setCurrentUser(emptyUserProfile);
        }
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setSession(null);
        setCurrentUser(emptyUserProfile);
        setAuthNotice(error.message);
      } finally {
        if (isMounted) {
          setIsAuthLoading(false);
        }
      }
    }

    bootstrapAuth();

    let subscriptionHandle = null;

    try {
      const listener = onAuthStateChange(async (_event, nextSession) => {
        if (!isMounted) {
          return;
        }

        setSession(nextSession ?? null);
        setAuthNotice('');

        if (nextSession?.user) {
          setIsAuthLoading(true);
          const hydratedUser = await hydrateCurrentUser(nextSession.user);

          if (!isMounted) {
            return;
          }

          setCurrentUser(hydratedUser);
        } else {
          setCurrentUser(emptyUserProfile);
        }

        if (isMounted) {
          setIsAuthLoading(false);
        }
      });

      subscriptionHandle = listener?.data?.subscription ?? null;
    } catch (error) {
      if (isMounted) {
        setAuthNotice(error.message);
      }
    }

    return () => {
      isMounted = false;
      subscriptionHandle?.unsubscribe?.();
    };
  }, []);

  const login = async ({ identifier, password }) => {
    try {
      const data = await signInWithIdentifier({ identifier, password });
      setAuthMode('login');
      setAuthNotice('');

      if (data.session?.user) {
        setSession(data.session);
        const hydratedUser = await hydrateCurrentUser(data.session.user);
        setCurrentUser(hydratedUser);
      }

      return { ok: true };
    } catch (error) {
      setAuthNotice(error.message);
      return { ok: false, error: error.message };
    }
  };

  const signup = async ({ name, username, email, password, bio }) => {
    try {
      const data = await signUpWithEmail({
        email,
        fullName: name,
        password,
        shortBio: bio,
        username,
      });

      setAuthMode('login');
      setAuthNotice('');

      if (data.session?.user) {
        setSession(data.session);
        const hydratedUser = await hydrateCurrentUser(data.session.user);
        setCurrentUser(hydratedUser);

        return { ok: true };
      }

      return {
        ok: true,
        message:
          'Account created. Check your email for a confirmation link, then log in to continue.',
      };
    } catch (error) {
      setAuthNotice(error.message);
      return { ok: false, error: error.message };
    }
  };

  const logout = async () => {
    try {
      await signOutUser();
      setSession(null);
      setCurrentUser(emptyUserProfile);
      setViewerLocation(null);
      setLocationNotice('');
      isMarketplaceSyncInFlightRef.current = false;
      pendingMarketplaceSyncOptionsRef.current = null;
      setFilters(buildDefaultFilters());
      setJobApplications({});
      setOwnerApplicationsByListing({});
      setIsOwnerApplicationsLoadingByListing({});
      setApplicationsNotice('');
      setMessageThreads([]);
      setMessagesByThread({});
      setMessageNoticeByThread({});
      setIsMessagesLoadingByThread({});
      setIsThreadsLoading(false);
      setThreadsNotice('');
      setAuthNotice('');
      return { ok: true };
    } catch (error) {
      setAuthNotice(error.message);
      return { ok: false, error: error.message };
    }
  };

  const postJob = (jobInput) => {
    return createListing({
      ownerId: currentUser.id,
      type: 'job',
      title: jobInput.title,
      description: jobInput.description,
      category: jobInput.category,
      price: jobInput.price,
      durationText: jobInput.time,
      locationName: jobInput.location,
      latitude: jobInput.latitude,
      longitude: jobInput.longitude,
      photos: jobInput.photos,
      urgent: jobInput.instantAccept,
      instantAccept: jobInput.instantAccept,
    })
      .then((createdJob) => {
        setJobs((prev) => upsertById(prev, createdJob));
        setListingsNotice('');
        return createdJob;
      })
      .catch((error) => {
        setListingsNotice(error.message);
        throw error;
      });
  };

  const postRental = (rentalInput) => {
    return createListing({
      ownerId: currentUser.id,
      type: 'rental',
      title: rentalInput.title,
      description: rentalInput.description,
      category: rentalInput.category,
      price: rentalInput.budget,
      durationText: rentalInput.duration,
      locationName: rentalInput.location,
      latitude: rentalInput.latitude,
      longitude: rentalInput.longitude,
      photos: rentalInput.photos,
      urgent: rentalInput.urgent,
      instantAccept: rentalInput.listingMode === 'sell',
    })
      .then((createdRental) => {
        setRentals((prev) => upsertById(prev, createdRental));
        setListingsNotice('');
        return createdRental;
      })
      .catch((error) => {
        setListingsNotice(error.message);
        throw error;
      });
  };

  const getListingForEdit = (listingId) =>
    jobs.find((job) => job.id === listingId) || rentals.find((rental) => rental.id === listingId) || null;

  const updateOwnedListing = async (listingId, listingInput) => {
    const existingListing = getListingForEdit(listingId);

    if (!existingListing) {
      throw new Error('This listing is no longer available to edit.');
    }

    try {
      const updatedListing = await updateListingDetails({
        listingId,
        title: listingInput.title,
        description: listingInput.description,
        category: listingInput.category,
        price: existingListing.type === 'job' ? listingInput.price : listingInput.budget,
        durationText: existingListing.type === 'job' ? listingInput.time : listingInput.duration,
        locationName: listingInput.location,
        latitude: listingInput.latitude,
        longitude: listingInput.longitude,
        urgent: listingInput.urgent,
        instantAccept:
          existingListing.type === 'job'
            ? listingInput.urgent
            : listingInput.listingMode === 'sell',
      });

      if (existingListing.type === 'job') {
        setJobs((prev) => upsertById(prev, updatedListing));
      } else {
        setRentals((prev) => upsertById(prev, updatedListing));
      }

      setListingsNotice('');
      return updatedListing;
    } catch (error) {
      setListingsNotice(error.message);
      throw error;
    }
  };

  const removeOwnedListing = async (listingId) => {
    const existingListing = getListingForEdit(listingId);

    if (!existingListing) {
      throw new Error('This listing is no longer available to delete.');
    }

    try {
      await deleteOwnedListing({
        imagePaths: (existingListing.images || [])
          .map((image) => image.storagePath)
          .filter(Boolean),
        listingId,
      });

      if (existingListing.type === 'job') {
        setJobs((prev) => prev.filter((job) => job.id !== listingId));
      } else {
        setRentals((prev) => prev.filter((rental) => rental.id !== listingId));
      }

      setJobApplications((prev) => {
        if (!prev[listingId]) {
          return prev;
        }

        const nextApplications = { ...prev };
        delete nextApplications[listingId];
        return nextApplications;
      });
      setOwnerApplicationsByListing((prev) => {
        if (!prev[listingId]) {
          return prev;
        }

        const nextApplications = { ...prev };
        delete nextApplications[listingId];
        return nextApplications;
      });
      setListingsNotice('');
      setApplicationsNotice('');
      return { ok: true };
    } catch (error) {
      setListingsNotice(error.message);
      throw error;
    }
  };

  const getThreadById = (threadId) => threads.find((thread) => thread.id === threadId);

  const getMessagesForThread = (threadId) => messagesByThread[threadId] || [];

  const getOwnerApplicationsForJob = (jobId) => ownerApplicationsByListing[jobId] || [];

  const isOwnerApplicationsLoading = (jobId) =>
    Boolean(isOwnerApplicationsLoadingByListing[jobId]);

  const loadOwnerApplicationsForJob = async (jobId, forceRefresh = false) => {
    if (!jobId) {
      return [];
    }

    if (!forceRefresh && ownerApplicationsByListing[jobId]) {
      return ownerApplicationsByListing[jobId];
    }

    setIsOwnerApplicationsLoadingByListing((prev) => ({ ...prev, [jobId]: true }));

    try {
      const applications = await fetchOwnerApplicationsForListing(jobId);
      setOwnerApplicationsByListing((prev) => ({ ...prev, [jobId]: applications }));
      setApplicationsNotice('');
      return applications;
    } catch (error) {
      setApplicationsNotice(error.message);
      throw error;
    } finally {
      setIsOwnerApplicationsLoadingByListing((prev) => ({ ...prev, [jobId]: false }));
    }
  };

  const isThreadMessagesLoading = (threadId) => Boolean(isMessagesLoadingByThread[threadId]);

  const getThreadMessagesNotice = (threadId) => messageNoticeByThread[threadId] || '';

  const loadMessagesForThread = async (threadId, forceRefresh = false) => {
    if (!threadId) {
      return [];
    }

    if (!forceRefresh && messagesByThread[threadId]?.length) {
      return messagesByThread[threadId];
    }

    setMessageNoticeByThread((prev) => ({ ...prev, [threadId]: '' }));
    setIsMessagesLoadingByThread((prev) => ({ ...prev, [threadId]: true }));

    try {
      const liveMessages = await fetchMessagesForThread(threadId);
      setMessagesByThread((prev) => ({ ...prev, [threadId]: liveMessages }));
      setMessageNoticeByThread((prev) => ({ ...prev, [threadId]: '' }));
      return liveMessages;
    } catch (error) {
      setMessageNoticeByThread((prev) => ({ ...prev, [threadId]: error.message }));
      throw error;
    } finally {
      setIsMessagesLoadingByThread((prev) => ({ ...prev, [threadId]: false }));
    }
  };

  const refreshMarketplaceAndThreadState = async (threadId = null) => {
    const activeUserId = session?.user?.id || currentUser.id;

    if (!activeUserId) {
      return null;
    }

    await syncMarketplaceState(activeUserId, {
      preserveOwnerApplications: true,
    });
    await syncThreadsState(activeUserId);

    if (!threadId) {
      return null;
    }

    const refreshedThread = await fetchThreadById(threadId, activeUserId);

    if (refreshedThread) {
      setMessageThreads((prev) => upsertThreadById(prev, refreshedThread));
      await loadMessagesForThread(threadId, true);
    }

    return refreshedThread;
  };

  const markThreadRead = async (threadId) => {
    setMessageThreads((prev) =>
      prev.map((thread) => (thread.id === threadId ? { ...thread, unreadCount: 0 } : thread))
    );

    try {
      await markThreadAsRead(threadId);
      setMessageNoticeByThread((prev) => ({ ...prev, [threadId]: '' }));
    } catch (error) {
      setMessageNoticeByThread((prev) => ({ ...prev, [threadId]: error.message }));
    }
  };

  const openJobChat = async (jobId) => {
    const existingThread = messageThreads.find(
      (thread) => thread.jobId === jobId || thread.listingId === jobId
    );

    if (existingThread) {
      markThreadRead(existingThread.id);
      return existingThread;
    }

    const job = jobs.find((item) => item.id === jobId) || rentals.find((item) => item.id === jobId);

    if (!job) {
      return null;
    }

    try {
      const thread = await createOrGetListingThread(job.id, session?.user?.id || currentUser.id);

      if (!thread) {
        return null;
      }

      setMessageThreads((prev) => upsertThreadById(prev, thread));
      setThreadsNotice('');
      return thread;
    } catch (error) {
      throw error;
    }
  };

  const openApplicationChat = async (applicationId) => {
    try {
      const thread = await createOrGetApplicationThread(
        applicationId,
        session?.user?.id || currentUser.id
      );

      if (!thread) {
        return null;
      }

      setMessageThreads((prev) => upsertThreadById(prev, thread));
      setThreadsNotice('');
      return thread;
    } catch (error) {
      throw error;
    }
  };

  const loadRentalRequestForListing = async (listingId) => {
    try {
      const request = await fetchRentalRequestByListing(listingId);
      setListingsNotice('');
      return request;
    } catch (error) {
      setListingsNotice(error.message);
      throw error;
    }
  };

  const loadRentalRequestForThread = async (threadId) => {
    try {
      const request = await fetchRentalRequestByThread(threadId);
      setListingsNotice('');
      return request;
    } catch (error) {
      setListingsNotice(error.message);
      throw error;
    }
  };

  const requestRentalBooking = async ({ listingId, note, startDate, endDate }) => {
    try {
      const result = await requestRentalBookingRecord({
        listingId,
        note,
        startDate,
        endDate,
      });
      const thread = await refreshMarketplaceAndThreadState(result.threadId);
      setListingsNotice('');
      return { ...result, thread };
    } catch (error) {
      setListingsNotice(error.message);
      throw error;
    }
  };

  const reviewRentalBooking = async (requestId, nextStatus) => {
    try {
      const result = await reviewRentalBookingRecord(requestId, nextStatus);
      const thread = await refreshMarketplaceAndThreadState(result.threadId);
      setListingsNotice('');
      return { ...result, thread };
    } catch (error) {
      setListingsNotice(error.message);
      throw error;
    }
  };

  const updateRentalBookingStage = async (requestId, nextStatus) => {
    try {
      const result = await advanceRentalBookingStage(requestId, nextStatus);
      const thread = await refreshMarketplaceAndThreadState(result.threadId);
      setListingsNotice('');
      return { ...result, thread };
    } catch (error) {
      setListingsNotice(error.message);
      throw error;
    }
  };

  const submitRentalReviewForRequest = async ({ requestId, rating, comment }) => {
    try {
      const result = await submitRentalReviewRecord({
        requestId,
        rating,
        comment,
      });
      const thread = await refreshMarketplaceAndThreadState(result.threadId);
      setListingsNotice('');
      return { ...result, thread };
    } catch (error) {
      setListingsNotice(error.message);
      throw error;
    }
  };

  const sendMessage = async (threadId, text) => {
    const trimmed = text.trim();

    if (!trimmed) {
      return null;
    }

    try {
      const newMessage = await sendThreadMessageRecord(threadId, trimmed);

      setMessagesByThread((prev) => ({
        ...prev,
        [threadId]: upsertMessageById(prev[threadId] || [], newMessage),
      }));
      setMessageThreads((prev) => {
        const existingThread = prev.find((thread) => thread.id === threadId);

        if (!existingThread) {
          return prev;
        }

        return upsertThreadById(prev, {
          ...existingThread,
          preview: trimmed,
          unreadCount: 0,
          updatedAt: newMessage.createdAt,
        });
      });
      setMessageNoticeByThread((prev) => ({ ...prev, [threadId]: '' }));
      return newMessage;
    } catch (error) {
      throw error;
    }
  };

  const updateJobStatus = async (jobId, status) => {
    try {
      const updatedJob = await updateListingStatus(jobId, status);

      if (updatedJob.type === 'job') {
        setJobs((prev) => upsertById(prev, updatedJob));
      } else {
        setRentals((prev) => upsertById(prev, updatedJob));
      }

      setListingsNotice('');
      return updatedJob;
    } catch (error) {
      setListingsNotice(error.message);
      throw error;
    }
  };

  const submitJobApplication = async (jobId, acceptImmediately = false) => {
    try {
      const result = await applyToJobListing(jobId, acceptImmediately);
      setJobApplications((prev) => ({
        ...prev,
        [jobId]: result.application,
      }));

      if (result.listing) {
        setJobs((prev) => upsertById(prev, result.listing));
      }

      setListingsNotice('');
      setApplicationsNotice('');
      return result;
    } catch (error) {
      setListingsNotice(error.message);
      setApplicationsNotice(error.message);
      throw error;
    }
  };

  const applyForJob = (jobId) => submitJobApplication(jobId, false);

  const instantAcceptJob = (jobId) => submitJobApplication(jobId, true);

  const cancelJob = (jobId) => updateJobStatus(jobId, 'cancelled');

  const getJobById = (jobId) =>
    jobsWithViewerState.find((job) => job.id === jobId) ||
    rentalsWithViewerState.find((rental) => rental.id === jobId);

  const getMyApplicationForJob = (jobId) => jobApplications[jobId] || null;

  const reviewApplicationForOwnedJob = async (applicationId, nextStatus) => {
    try {
      const result = await reviewOwnerApplication(applicationId, nextStatus);
      setJobs((prev) => upsertById(prev, result.listing));
      const refreshedApplications = await fetchOwnerApplicationsForListing(result.listing.id);
      setOwnerApplicationsByListing((prev) => ({
        ...prev,
        [result.listing.id]: refreshedApplications,
      }));
      setListingsNotice('');
      setApplicationsNotice('');
      return result;
    } catch (error) {
      setApplicationsNotice(error.message);
      throw error;
    }
  };

  const updateCurrentUserProfile = async (profileInput) => {
    const activeUserId = session?.user?.id || currentUser.id;

    if (!activeUserId) {
      throw new Error('You must be logged in to update your profile.');
    }

    const result = await updateProfileById(activeUserId, profileInput, currentUser);
    const updatedProfile = result.profile;
    const nextUser = {
      ...currentUser,
      ...updatedProfile,
    };

    setCurrentUser(nextUser);
    setJobs((prev) => patchCurrentUserIntoListings(prev, nextUser));
    setRentals((prev) => patchCurrentUserIntoListings(prev, nextUser));
    setAuthNotice('');
    return {
      omittedFields: result.omittedFields,
      profile: nextUser,
    };
  };

  return (
    <AppContext.Provider
      value={{
        authMode,
        authNotice,
        applicationsNotice,
        cancelJob,
        currentUser,
        filteredJobs,
        filters,
        getJobById,
        getListingForEdit,
        getMyApplicationForJob,
        getMessagesForThread,
        getOwnerApplicationsForJob,
        getThreadById,
        loadRentalRequestForListing,
        loadRentalRequestForThread,
        instantAcceptJob,
        isAuthLoading,
        isAuthenticated,
        isListingsLoading,
        isLocationLoading,
        isOwnerApplicationsLoading,
        isThreadMessagesLoading,
        isThreadsLoading,
        jobs: jobsWithViewerState,
        getThreadMessagesNotice,
        loadOwnerApplicationsForJob,
        loadMessagesForThread,
        login,
        logout,
        listingsNotice,
        locationNotice,
        markThreadRead,
        myListings,
        openJobChat,
        openApplicationChat,
        postJob,
        postRental,
        requestRentalBooking,
        refreshViewerLocation,
        rentals: rentalsWithViewerState,
        reviewApplicationForOwnedJob,
        reviewRentalBooking,
        resetFilters,
        removeOwnedListing,
        sendMessage,
        setAuthMode,
        setFilters,
        signup,
        submitRentalReviewForRequest,
        threads,
        threadsNotice,
        unreadThreadCount,
        updateCurrentUserProfile,
        updateOwnedListing,
        updateJobStatus,
        updateRentalBookingStage,
        applyForJob,
        viewerLocation,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);

  if (!context) {
    throw new Error('useApp must be used inside AppProvider');
  }

  return context;
}
