import { buildInitials } from './profileService';
import { getSupabaseClient } from './supabaseClient';

const RENTAL_FLOW_REPAIR_FILE = '005_rental_request_flow.sql';

const RENTAL_REQUEST_SELECT = `
  id,
  listing_id,
  thread_id,
  renter_id,
  start_date,
  end_date,
  total_price,
  note,
  status,
  responded_at,
  completed_at,
  created_at,
  updated_at,
  renter:profiles!rental_requests_renter_id_fkey (
    id,
    full_name,
    rating,
    school_name,
    short_bio,
    student_verified,
    avatar_url
  ),
  listing:listings!rental_requests_listing_id_fkey (
    id,
    owner_id,
    title,
    location_name,
    price,
    status
  ),
  reviews:rental_reviews (
    id,
    reviewer_id,
    reviewee_id,
    rating,
    comment,
    created_at
  )
`;

function isRpcArgumentMismatch(error) {
  const message = error?.message || '';
  return (
    message.includes('Could not find the function public.') ||
    message.includes('function public.') ||
    message.includes('schema cache')
  );
}

async function callRpcWithFallback(client, functionName, payloads) {
  let lastError = null;

  for (const payload of payloads) {
    const { data, error } = await client.rpc(functionName, payload).single();

    if (!error) {
      return { data, error: null };
    }

    lastError = error;

    if (!isRpcArgumentMismatch(error)) {
      break;
    }
  }

  return { data: null, error: lastError };
}

function normalizeRentalRpcError(error) {
  const message = error?.message || 'We could not update this rental request right now.';

  if (
    message.includes('Could not find the function public.') ||
    message.includes('schema cache') ||
    message.includes('is ambiguous')
  ) {
    return new Error(
      `The rental request backend needs the latest Supabase repair. Run ${RENTAL_FLOW_REPAIR_FILE} in Supabase and try again.`
    );
  }

  return new Error(message);
}

function mapRentalReviewRow(row) {
  return {
    id: row.id,
    reviewerId: row.reviewer_id,
    revieweeId: row.reviewee_id,
    rating: Number(row.rating) || 0,
    comment: row.comment || '',
    createdAt: new Date(row.created_at).getTime(),
  };
}

function mapRentalRequestRow(row) {
  if (!row) {
    return null;
  }

  const renter = row.renter || {};
  const listing = row.listing || {};
  const reviews = (row.reviews || [])
    .map(mapRentalReviewRow)
    .sort((first, second) => first.createdAt - second.createdAt);
  const renterName = renter.full_name || 'Student User';

  return {
    id: row.id,
    listingId: row.listing_id,
    threadId: row.thread_id,
    renterId: row.renter_id,
    ownerId: listing.owner_id || null,
    startDate: row.start_date,
    endDate: row.end_date,
    totalPrice: Number(row.total_price) || 0,
    note: row.note || '',
    status: row.status,
    respondedAt: row.responded_at ? new Date(row.responded_at).getTime() : null,
    completedAt: row.completed_at ? new Date(row.completed_at).getTime() : null,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
    listing: {
      id: listing.id || row.listing_id,
      location: listing.location_name || 'Campus',
      ownerId: listing.owner_id || null,
      price: Number(listing.price) || 0,
      status: listing.status || 'open',
      title: listing.title || 'Rental listing',
    },
    renter: {
      avatarUrl: renter.avatar_url || null,
      id: renter.id || row.renter_id,
      initials: buildInitials(renterName),
      isVerified: Boolean(renter.student_verified),
      name: renterName,
      rating: Number(renter.rating ?? 5),
      school: renter.school_name || 'Seoul Global University',
      shortBio: renter.short_bio || '',
    },
    reviews,
  };
}

async function fetchRentalRequest(queryBuilder) {
  const { data, error } = await queryBuilder
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return mapRentalRequestRow(data);
}

export function getRentalRequestSelect() {
  return RENTAL_REQUEST_SELECT;
}

export async function fetchRentalRequestByListing(listingId) {
  const client = getSupabaseClient();

  return fetchRentalRequest(
    client.from('rental_requests').select(RENTAL_REQUEST_SELECT).eq('listing_id', listingId)
  );
}

export async function fetchRentalRequestByThread(threadId) {
  const client = getSupabaseClient();

  return fetchRentalRequest(
    client.from('rental_requests').select(RENTAL_REQUEST_SELECT).eq('thread_id', threadId)
  );
}

export async function requestRentalBooking({
  listingId,
  startDate,
  endDate,
  note = '',
}) {
  const client = getSupabaseClient();
  const { data, error } = await callRpcWithFallback(client, 'request_rental', [
    {
      target_listing_id: listingId,
      rental_start_date: startDate,
      rental_end_date: endDate,
      request_note: note,
    },
    {
      p_target_listing_id: listingId,
      p_rental_start_date: startDate,
      p_rental_end_date: endDate,
      p_request_note: note,
    },
  ]);

  if (error) {
    throw normalizeRentalRpcError(error);
  }

  return {
    listingId: data.listing_id,
    requestId: data.request_id,
    requestStatus: data.request_status,
    threadId: data.thread_id,
    totalPrice: Number(data.total_price) || 0,
  };
}

export async function reviewRentalBooking(requestId, nextStatus) {
  const client = getSupabaseClient();
  const { data, error } = await callRpcWithFallback(client, 'review_rental_request', [
    {
      target_request_id: requestId,
      next_status: nextStatus,
    },
    {
      p_target_request_id: requestId,
      p_next_status: nextStatus,
    },
  ]);

  if (error) {
    throw normalizeRentalRpcError(error);
  }

  return {
    listingId: data.listing_id,
    requestId: data.request_id,
    requestStatus: data.request_status,
    threadId: data.thread_id,
  };
}

export async function advanceRentalBookingStage(requestId, nextStatus) {
  const client = getSupabaseClient();
  const { data, error } = await callRpcWithFallback(client, 'advance_rental_request_status', [
    {
      target_request_id: requestId,
      next_status: nextStatus,
    },
    {
      p_target_request_id: requestId,
      p_next_status: nextStatus,
    },
  ]);

  if (error) {
    throw normalizeRentalRpcError(error);
  }

  return {
    listingId: data.listing_id,
    requestId: data.request_id,
    requestStatus: data.request_status,
    threadId: data.thread_id,
  };
}

export async function submitRentalReview({
  requestId,
  rating,
  comment = '',
}) {
  const client = getSupabaseClient();
  const { data, error } = await callRpcWithFallback(client, 'submit_rental_review', [
    {
      target_request_id: requestId,
      review_rating: rating,
      review_comment: comment,
    },
    {
      p_target_request_id: requestId,
      p_review_rating: rating,
      p_review_comment: comment,
    },
  ]);

  if (error) {
    throw normalizeRentalRpcError(error);
  }

  return {
    comment: data.comment || '',
    createdAt: new Date(data.created_at).getTime(),
    rating: Number(data.rating) || 0,
    requestId: data.request_id,
    reviewId: data.review_id,
    reviewerId: data.reviewer_id,
    revieweeId: data.reviewee_id,
    threadId: data.thread_id,
  };
}
