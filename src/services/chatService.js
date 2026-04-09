import { buildInitials } from './profileService';
import { getSupabaseClient } from './supabaseClient';

const CHAT_REPAIR_FILES = '002_existing_project_repairs.sql and 005_rental_request_flow.sql';

function isRpcArgumentMismatch(error) {
  const message = error?.message || '';
  return (
    message.includes('Could not find the function public.') ||
    message.includes('function public.') ||
    message.includes('schema cache')
  );
}

async function callRpcWithFallback(client, functionName, payloads, useSingle = true) {
  let lastError = null;

  for (const payload of payloads) {
    const request = client.rpc(functionName, payload);
    const result = useSingle ? await request.single() : await request;

    if (!result.error) {
      return result;
    }

    lastError = result.error;

    if (!isRpcArgumentMismatch(result.error)) {
      break;
    }
  }

  return { data: null, error: lastError };
}

function normalizeChatBackendError(error) {
  const message = error?.message || 'We could not load this conversation right now.';

  if (
    message.includes('Could not find the function public.') ||
    message.includes('schema cache') ||
    message.includes('infinite recursion detected in policy for relation') ||
    message.includes('timestamp with time zone but expression is of type time with time zone') ||
    message.includes('is ambiguous')
  ) {
    return new Error(
      `The messaging backend needs the latest Supabase repairs. Run ${CHAT_REPAIR_FILES} in Supabase and try again.`
    );
  }

  return new Error(message);
}

function mapThreadRowToAppThread(row) {
  const participantName = row.participant_full_name || 'Student User';

  return {
    id: row.thread_id,
    jobId: row.listing_type === 'job' ? row.listing_id : null,
    listingId: row.listing_id || null,
    listingTitle: row.listing_title || 'Listing removed',
    listingType: row.listing_type || 'job',
    participant: {
      avatarUrl: row.participant_avatar_url || null,
      id: row.participant_id || '',
      initials: buildInitials(participantName),
      name: participantName,
      school: row.participant_school_name || 'Seoul Global University',
      verified: Boolean(row.participant_student_verified),
    },
    preview: row.last_message_body || 'Start the conversation',
    subtitle: row.listing_location_name || 'Campus',
    unreadCount: Number(row.unread_count) || 0,
    updatedAt: new Date(row.last_message_at).getTime(),
  };
}

function mapMessageRowToAppMessage(row) {
  return {
    id: row.id || row.message_id,
    kind: row.kind || 'text',
    metadata: row.metadata || {},
    senderId: row.sender_id,
    text: row.body,
    createdAt: new Date(row.created_at).getTime(),
  };
}

export async function fetchThreadsForUser(_userId) {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc('list_my_threads');

  if (error) {
    throw normalizeChatBackendError(error);
  }

  return (data || []).map(mapThreadRowToAppThread).sort((first, second) => second.updatedAt - first.updatedAt);
}

export async function fetchThreadById(threadId, _userId) {
  const client = getSupabaseClient();
  const { data, error } = await callRpcWithFallback(
    client,
    'get_thread_summary',
    [{ target_thread_id: threadId }, { p_target_thread_id: threadId }],
    false
  );

  if (error) {
    throw normalizeChatBackendError(error);
  }

  const threadRow = Array.isArray(data) ? data[0] : data;
  return threadRow ? mapThreadRowToAppThread(threadRow) : null;
}

export async function fetchMessagesForThread(threadId) {
  const client = getSupabaseClient();
  const { data, error } = await callRpcWithFallback(
    client,
    'get_thread_messages',
    [{ target_thread_id: threadId }, { p_target_thread_id: threadId }],
    false
  );

  if (error) {
    throw normalizeChatBackendError(error);
  }

  return (data || []).map(mapMessageRowToAppMessage);
}

export async function createOrGetListingThread(listingId, userId) {
  const client = getSupabaseClient();
  const { data, error } = await callRpcWithFallback(client, 'get_or_create_listing_thread', [
    { target_listing_id: listingId },
    { p_target_listing_id: listingId },
  ]);

  if (error) {
    throw normalizeChatBackendError(error);
  }

  return fetchThreadById(data.thread_id, userId);
}

export async function createOrGetApplicationThread(applicationId, userId) {
  const client = getSupabaseClient();
  const { data, error } = await callRpcWithFallback(client, 'get_or_create_application_thread', [
    { target_application_id: applicationId },
    { p_target_application_id: applicationId },
  ]);

  if (error) {
    throw normalizeChatBackendError(error);
  }

  return fetchThreadById(data.thread_id, userId);
}

export async function sendThreadMessage(threadId, text) {
  const client = getSupabaseClient();
  const { data, error } = await client
    .rpc('send_thread_message', {
      message_body: text,
      target_thread_id: threadId,
    })
    .single();

  if (error) {
    throw normalizeChatBackendError(error);
  }

  return mapMessageRowToAppMessage(data);
}

export async function markThreadAsRead(threadId) {
  const client = getSupabaseClient();
  const { error } = await client.rpc('mark_thread_read', {
    target_thread_id: threadId,
  });

  if (error) {
    throw normalizeChatBackendError(error);
  }
}

export function mapRealtimeMessageRow(row) {
  return mapMessageRowToAppMessage(row);
}
