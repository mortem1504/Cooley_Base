import { fetchListingById } from './listingsService';
import { buildInitials } from './profileService';
import { getSupabaseClient } from './supabaseClient';

const APPLICATION_REPAIR_FILE = '002_existing_project_repairs.sql';

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

function normalizeApplicationRpcError(error) {
  const message = error?.message || 'We could not update this job application right now.';

  if (
    message.includes('Could not find the function public.') ||
    message.includes('schema cache') ||
    message.includes('is ambiguous')
  ) {
    return new Error(
      `The job application backend needs the latest Supabase repair. Run ${APPLICATION_REPAIR_FILE} in Supabase and try again.`
    );
  }

  return new Error(message);
}

function mapApplicationRow(row) {
  return {
    id: row.id,
    listingId: row.listing_id,
    status: row.status,
    createdAt: new Date(row.created_at).getTime(),
  };
}

function mapOwnerApplicationRow(row) {
  const applicant = row.applicant || {};
  const applicantName = applicant.full_name || 'Student User';

  return {
    id: row.id,
    listingId: row.listing_id,
    status: row.status,
    createdAt: new Date(row.created_at).getTime(),
    applicant: {
      id: applicant.id || row.applicant_id,
      initials: buildInitials(applicantName),
      name: applicantName,
      rating: Number(applicant.rating ?? 5),
      school: applicant.school_name || 'Seoul Global University',
      shortBio: applicant.short_bio || '',
      avatarUrl: applicant.avatar_url || null,
      isVerified: Boolean(applicant.student_verified),
    },
  };
}

export async function fetchMyJobApplications(userId) {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('applications')
    .select('id, listing_id, status, created_at')
    .eq('applicant_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []).reduce((applicationsByListingId, row) => {
    const application = mapApplicationRow(row);

    return {
      ...applicationsByListingId,
      [application.listingId]: application,
    };
  }, {});
}

export async function fetchOwnerApplicationsForListing(listingId) {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('applications')
    .select(
      `
      id,
      listing_id,
      applicant_id,
      status,
      created_at,
      applicant:profiles!applications_applicant_id_fkey (
        id,
        full_name,
        rating,
        school_name,
        short_bio,
        student_verified,
        avatar_url
      )
    `
    )
    .eq('listing_id', listingId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []).map(mapOwnerApplicationRow);
}

export async function applyToJobListing(listingId, acceptImmediately = false) {
  const client = getSupabaseClient();
  const { data, error } = await callRpcWithFallback(client, 'apply_to_job', [
    {
      accept_immediately: acceptImmediately,
      target_listing_id: listingId,
    },
    {
      p_accept_immediately: acceptImmediately,
      p_target_listing_id: listingId,
    },
  ]);

  if (error) {
    throw normalizeApplicationRpcError(error);
  }

  const application = {
    id: data.application_id,
    listingId: data.listing_id,
    status: data.application_status,
    createdAt: new Date(data.applied_at).getTime(),
  };

  const listing =
    data.listing_status && data.listing_status !== 'open'
      ? await fetchListingById(listingId)
      : null;

  return { application, listing };
}

export async function reviewOwnerApplication(applicationId, nextStatus) {
  const client = getSupabaseClient();
  const { data, error } = await callRpcWithFallback(client, 'review_job_application', [
    {
      next_status: nextStatus,
      target_application_id: applicationId,
    },
    {
      p_next_status: nextStatus,
      p_target_application_id: applicationId,
    },
  ]);

  if (error) {
    throw normalizeApplicationRpcError(error);
  }

  const listing = await fetchListingById(data.listing_id);

  return {
    application: {
      applicantId: data.applicant_id,
      id: data.application_id,
      listingId: data.listing_id,
      status: data.application_status,
      createdAt: new Date(data.reviewed_at).getTime(),
    },
    listing,
  };
}
