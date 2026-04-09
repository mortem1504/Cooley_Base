alter table public.listings
drop constraint if exists listings_status_check;

alter table public.listings
add constraint listings_status_check
check (
  status in (
    'open',
    'requested',
    'accepted',
    'in_progress',
    'completed',
    'cancelled',
    'paused',
    'rented'
  )
);

alter table public.messages
add column if not exists kind text not null default 'text';

alter table public.messages
add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.messages
drop constraint if exists messages_kind_check;

alter table public.messages
add constraint messages_kind_check
check (kind in ('text', 'system', 'rental_request', 'review'));

create table if not exists public.rental_requests (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  thread_id uuid not null references public.threads (id) on delete cascade,
  renter_id uuid not null references public.profiles (id) on delete cascade,
  start_date date not null,
  end_date date not null,
  total_price numeric(10, 2) not null default 0,
  note text default '',
  status text not null default 'requested'
    check (status in ('requested', 'accepted', 'rejected', 'ongoing', 'completed', 'cancelled')),
  responded_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint rental_requests_date_range_check check (end_date >= start_date)
);

create table if not exists public.rental_reviews (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.rental_requests (id) on delete cascade,
  thread_id uuid not null references public.threads (id) on delete cascade,
  reviewer_id uuid not null references public.profiles (id) on delete cascade,
  reviewee_id uuid not null references public.profiles (id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text default '',
  created_at timestamptz not null default timezone('utc'::text, now()),
  unique (request_id, reviewer_id)
);

create index if not exists rental_requests_listing_id_created_at_idx
on public.rental_requests (listing_id, created_at desc);

create index if not exists rental_requests_thread_id_created_at_idx
on public.rental_requests (thread_id, created_at desc);

create unique index if not exists rental_requests_one_active_request_per_listing_idx
on public.rental_requests (listing_id)
where status in ('requested', 'accepted', 'ongoing');

create index if not exists rental_reviews_request_id_created_at_idx
on public.rental_reviews (request_id, created_at asc);

drop trigger if exists rental_requests_set_updated_at on public.rental_requests;
create trigger rental_requests_set_updated_at
before update on public.rental_requests
for each row
execute function public.set_updated_at();

alter table public.rental_requests enable row level security;
alter table public.rental_reviews enable row level security;

drop policy if exists "rental_requests_select_related_users" on public.rental_requests;
create policy "rental_requests_select_related_users"
on public.rental_requests
for select
to authenticated
using (
  auth.uid() = renter_id
  or exists (
    select 1
    from public.listings as l
    where l.id = rental_requests.listing_id
      and l.owner_id = auth.uid()
  )
);

drop policy if exists "rental_reviews_select_related_users" on public.rental_reviews;
create policy "rental_reviews_select_related_users"
on public.rental_reviews
for select
to authenticated
using (
  auth.uid() = reviewer_id
  or auth.uid() = reviewee_id
  or exists (
    select 1
    from public.rental_requests as rr
    join public.listings as l
      on l.id = rr.listing_id
    where rr.id = rental_reviews.request_id
      and (rr.renter_id = auth.uid() or l.owner_id = auth.uid())
  )
);

drop function if exists public.append_thread_event_message(uuid, uuid, text, text, jsonb);
create or replace function public.append_thread_event_message(
  target_thread_id uuid,
  actor_user_id uuid,
  message_body text,
  message_kind text default 'system',
  message_metadata jsonb default '{}'::jsonb
)
returns public.messages
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_message public.messages%rowtype;
  current_timestamp_utc timestamptz := timezone('utc'::text, now());
begin
  insert into public.messages (thread_id, sender_id, body, created_at, kind, metadata)
  values (
    target_thread_id,
    actor_user_id,
    coalesce(nullif(btrim(message_body), ''), 'Conversation updated'),
    current_timestamp_utc,
    coalesce(nullif(btrim(message_kind), ''), 'system'),
    coalesce(message_metadata, '{}'::jsonb)
  )
  returning *
  into inserted_message;

  update public.threads as t
  set last_message_at = inserted_message.created_at
  where t.id = target_thread_id;

  update public.thread_members as tm
  set last_read_at = inserted_message.created_at
  where tm.thread_id = target_thread_id
    and tm.user_id = actor_user_id;

  return inserted_message;
end;
$$;

revoke all on function public.append_thread_event_message(uuid, uuid, text, text, jsonb) from public;

drop function if exists public.get_thread_messages(uuid);
create or replace function public.get_thread_messages(target_thread_id uuid)
returns table (
  id uuid,
  sender_id uuid,
  body text,
  created_at timestamptz,
  kind text,
  metadata jsonb
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'You must be logged in to load messages.';
  end if;

  if not public.is_thread_member(target_thread_id, auth.uid()) then
    raise exception 'You are not part of this conversation.';
  end if;

  return query
  select
    m.id,
    m.sender_id,
    m.body,
    m.created_at,
    m.kind,
    m.metadata
  from public.messages as m
  where m.thread_id = target_thread_id
  order by m.created_at asc;
end;
$$;

revoke all on function public.get_thread_messages(uuid) from public;
grant execute on function public.get_thread_messages(uuid) to authenticated;

drop function if exists public.send_thread_message(uuid, text);
create or replace function public.send_thread_message(target_thread_id uuid, message_body text)
returns table (
  id uuid,
  thread_id uuid,
  sender_id uuid,
  body text,
  created_at timestamptz,
  kind text,
  metadata jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  trimmed_body text := btrim(message_body);
  inserted_message public.messages%rowtype;
begin
  if auth.uid() is null then
    raise exception 'You must be logged in to send a message.';
  end if;

  if trimmed_body = '' then
    raise exception 'Message body cannot be empty.';
  end if;

  if not public.is_thread_member(target_thread_id, auth.uid()) then
    raise exception 'You are not part of this conversation.';
  end if;

  insert into public.messages (thread_id, sender_id, body, kind, metadata)
  values (target_thread_id, auth.uid(), trimmed_body, 'text', '{}'::jsonb)
  returning *
  into inserted_message;

  update public.threads as t
  set last_message_at = inserted_message.created_at
  where t.id = target_thread_id;

  update public.thread_members as tm
  set last_read_at = inserted_message.created_at
  where tm.thread_id = target_thread_id
    and tm.user_id = auth.uid();

  return query
  select
    inserted_message.id,
    inserted_message.thread_id,
    inserted_message.sender_id,
    inserted_message.body,
    inserted_message.created_at,
    inserted_message.kind,
    inserted_message.metadata;
end;
$$;

revoke all on function public.send_thread_message(uuid, text) from public;
grant execute on function public.send_thread_message(uuid, text) to authenticated;

drop function if exists public.request_rental(uuid, date, date, text);
create or replace function public.request_rental(
  target_listing_id uuid,
  rental_start_date date,
  rental_end_date date,
  request_note text default null
)
returns table (
  request_id uuid,
  thread_id uuid,
  listing_id uuid,
  request_status text,
  listing_status text,
  total_price numeric,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_listing public.listings%rowtype;
  created_request public.rental_requests%rowtype;
  active_request public.rental_requests%rowtype;
  request_thread_id uuid;
  rental_days integer;
  normalized_note text := coalesce(btrim(request_note), '');
begin
  if auth.uid() is null then
    raise exception 'You must be logged in to request a rental.';
  end if;

  if rental_start_date is null or rental_end_date is null or rental_end_date < rental_start_date then
    raise exception 'Choose a valid rental date range.';
  end if;

  select l.*
  into target_listing
  from public.listings as l
  where l.id = target_listing_id
    and l.type = 'rental';

  if not found then
    raise exception 'This item could not be found.';
  end if;

  if target_listing.owner_id = auth.uid() then
    raise exception 'You cannot request your own item.';
  end if;

  if target_listing.instant_accept then
    raise exception 'This item is listed for sale and cannot be requested as a rental.';
  end if;

  if target_listing.status <> 'open' then
    raise exception 'This item is not currently available.';
  end if;

  select rr.*
  into active_request
  from public.rental_requests as rr
  where rr.listing_id = target_listing.id
    and rr.status in ('requested', 'accepted', 'ongoing')
  limit 1;

  if active_request.id is not null then
    raise exception 'This item already has an active request.';
  end if;

  rental_days := greatest((rental_end_date - rental_start_date) + 1, 1);

  select result.thread_id
  into request_thread_id
  from public.get_or_create_listing_thread(target_listing.id) as result
  limit 1;

  insert into public.rental_requests (
    listing_id,
    thread_id,
    renter_id,
    start_date,
    end_date,
    total_price,
    note,
    status
  )
  values (
    target_listing.id,
    request_thread_id,
    auth.uid(),
    rental_start_date,
    rental_end_date,
    (coalesce(target_listing.price, 0) * rental_days)::numeric(10, 2),
    normalized_note,
    'requested'
  )
  returning *
  into created_request;

  update public.listings as l
  set
    status = 'requested',
    updated_at = timezone('utc'::text, now())
  where l.id = target_listing.id
  returning l.*
  into target_listing;

  perform public.append_thread_event_message(
    request_thread_id,
    auth.uid(),
    format(
      'Rental request for %s to %s. Total %s.',
      to_char(created_request.start_date, 'Mon DD'),
      to_char(created_request.end_date, 'Mon DD'),
      created_request.total_price
    ),
    'rental_request',
    jsonb_build_object(
      'requestId', created_request.id,
      'listingId', created_request.listing_id,
      'status', created_request.status,
      'startDate', created_request.start_date,
      'endDate', created_request.end_date,
      'totalPrice', created_request.total_price,
      'note', created_request.note
    )
  );

  return query
  select
    created_request.id,
    request_thread_id,
    target_listing.id,
    created_request.status,
    target_listing.status,
    created_request.total_price,
    created_request.created_at;
end;
$$;

revoke all on function public.request_rental(uuid, date, date, text) from public;
grant execute on function public.request_rental(uuid, date, date, text) to authenticated;

drop function if exists public.review_rental_request(uuid, text);
create or replace function public.review_rental_request(
  target_request_id uuid,
  next_status text
)
returns table (
  request_id uuid,
  thread_id uuid,
  listing_id uuid,
  request_status text,
  listing_status text,
  reviewed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_request public.rental_requests%rowtype;
  target_listing public.listings%rowtype;
  normalized_status text := lower(btrim(next_status));
  current_timestamp_utc timestamptz := timezone('utc'::text, now());
begin
  if auth.uid() is null then
    raise exception 'You must be logged in to review a rental request.';
  end if;

  if normalized_status not in ('accepted', 'rejected') then
    raise exception 'Rental requests can only be accepted or rejected.';
  end if;

  select rr.*
  into target_request
  from public.rental_requests as rr
  where rr.id = target_request_id;

  if not found then
    raise exception 'This rental request could not be found.';
  end if;

  select l.*
  into target_listing
  from public.listings as l
  where l.id = target_request.listing_id
    and l.type = 'rental';

  if not found then
    raise exception 'This rental listing could not be found.';
  end if;

  if target_listing.owner_id <> auth.uid() then
    raise exception 'Only the listing owner can review this request.';
  end if;

  if target_request.status <> 'requested' then
    raise exception 'This rental request has already been reviewed.';
  end if;

  update public.rental_requests as rr
  set
    status = normalized_status,
    responded_at = current_timestamp_utc,
    updated_at = current_timestamp_utc
  where rr.id = target_request.id
  returning rr.*
  into target_request;

  update public.listings as l
  set
    status = case when normalized_status = 'accepted' then 'accepted' else 'open' end,
    updated_at = current_timestamp_utc
  where l.id = target_listing.id
  returning l.*
  into target_listing;

  perform public.append_thread_event_message(
    target_request.thread_id,
    auth.uid(),
    case
      when normalized_status = 'accepted'
        then format(
          'Rental request accepted for %s to %s.',
          to_char(target_request.start_date, 'Mon DD'),
          to_char(target_request.end_date, 'Mon DD')
        )
      else 'Rental request declined. The listing is available again.'
    end,
    'system',
    jsonb_build_object(
      'requestId', target_request.id,
      'listingId', target_request.listing_id,
      'status', target_request.status,
      'startDate', target_request.start_date,
      'endDate', target_request.end_date,
      'totalPrice', target_request.total_price
    )
  );

  return query
  select
    target_request.id,
    target_request.thread_id,
    target_request.listing_id,
    target_request.status,
    target_listing.status,
    current_timestamp_utc;
end;
$$;

revoke all on function public.review_rental_request(uuid, text) from public;
grant execute on function public.review_rental_request(uuid, text) to authenticated;

drop function if exists public.advance_rental_request_status(uuid, text);
create or replace function public.advance_rental_request_status(
  target_request_id uuid,
  next_status text
)
returns table (
  request_id uuid,
  thread_id uuid,
  listing_id uuid,
  request_status text,
  listing_status text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_request public.rental_requests%rowtype;
  target_listing public.listings%rowtype;
  normalized_status text := lower(btrim(next_status));
  current_timestamp_utc timestamptz := timezone('utc'::text, now());
begin
  if auth.uid() is null then
    raise exception 'You must be logged in to update rental progress.';
  end if;

  if normalized_status not in ('ongoing', 'completed') then
    raise exception 'Rental progress only supports ongoing or completed.';
  end if;

  select rr.*
  into target_request
  from public.rental_requests as rr
  where rr.id = target_request_id;

  if not found then
    raise exception 'This rental request could not be found.';
  end if;

  select l.*
  into target_listing
  from public.listings as l
  where l.id = target_request.listing_id
    and l.type = 'rental';

  if not found then
    raise exception 'This rental listing could not be found.';
  end if;

  if target_listing.owner_id <> auth.uid() then
    raise exception 'Only the listing owner can update rental progress.';
  end if;

  if normalized_status = 'ongoing' and target_request.status <> 'accepted' then
    raise exception 'Only accepted rentals can move to ongoing.';
  end if;

  if normalized_status = 'completed' and target_request.status <> 'ongoing' then
    raise exception 'Only ongoing rentals can move to completed.';
  end if;

  update public.rental_requests as rr
  set
    status = normalized_status,
    completed_at = case when normalized_status = 'completed' then current_timestamp_utc else rr.completed_at end,
    updated_at = current_timestamp_utc
  where rr.id = target_request.id
  returning rr.*
  into target_request;

  update public.listings as l
  set
    status = case
      when normalized_status = 'ongoing' then 'in_progress'
      else 'completed'
    end,
    updated_at = current_timestamp_utc
  where l.id = target_listing.id
  returning l.*
  into target_listing;

  perform public.append_thread_event_message(
    target_request.thread_id,
    auth.uid(),
    case
      when normalized_status = 'ongoing'
        then 'Rental period marked as ongoing.'
      else 'Rental marked as completed. Reviews are now open.'
    end,
    'system',
    jsonb_build_object(
      'requestId', target_request.id,
      'listingId', target_request.listing_id,
      'status', target_request.status,
      'startDate', target_request.start_date,
      'endDate', target_request.end_date,
      'totalPrice', target_request.total_price
    )
  );

  return query
  select
    target_request.id,
    target_request.thread_id,
    target_request.listing_id,
    target_request.status,
    target_listing.status,
    current_timestamp_utc;
end;
$$;

revoke all on function public.advance_rental_request_status(uuid, text) from public;
grant execute on function public.advance_rental_request_status(uuid, text) to authenticated;

drop function if exists public.submit_rental_review(uuid, integer, text);
create or replace function public.submit_rental_review(
  target_request_id uuid,
  review_rating integer,
  review_comment text default null
)
returns table (
  review_id uuid,
  request_id uuid,
  thread_id uuid,
  reviewer_id uuid,
  reviewee_id uuid,
  rating integer,
  comment text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_request public.rental_requests%rowtype;
  target_listing public.listings%rowtype;
  inserted_review public.rental_reviews%rowtype;
  target_reviewee_id uuid;
  normalized_comment text := coalesce(btrim(review_comment), '');
begin
  if auth.uid() is null then
    raise exception 'You must be logged in to leave a review.';
  end if;

  if review_rating < 1 or review_rating > 5 then
    raise exception 'Choose a rating from 1 to 5.';
  end if;

  select rr.*
  into target_request
  from public.rental_requests as rr
  where rr.id = target_request_id;

  if not found then
    raise exception 'This rental request could not be found.';
  end if;

  select l.*
  into target_listing
  from public.listings as l
  where l.id = target_request.listing_id
    and l.type = 'rental';

  if not found then
    raise exception 'This rental listing could not be found.';
  end if;

  if target_request.status <> 'completed' then
    raise exception 'Reviews open after the rental is completed.';
  end if;

  if auth.uid() = target_request.renter_id then
    target_reviewee_id := target_listing.owner_id;
  elsif auth.uid() = target_listing.owner_id then
    target_reviewee_id := target_request.renter_id;
  else
    raise exception 'You are not part of this rental.';
  end if;

  insert into public.rental_reviews (
    request_id,
    thread_id,
    reviewer_id,
    reviewee_id,
    rating,
    comment
  )
  values (
    target_request.id,
    target_request.thread_id,
    auth.uid(),
    target_reviewee_id,
    review_rating,
    normalized_comment
  )
  returning *
  into inserted_review;

  perform public.append_thread_event_message(
    target_request.thread_id,
    auth.uid(),
    format('Left a %s-star review.', inserted_review.rating),
    'review',
    jsonb_build_object(
      'reviewId', inserted_review.id,
      'requestId', inserted_review.request_id,
      'rating', inserted_review.rating,
      'comment', inserted_review.comment,
      'reviewerId', inserted_review.reviewer_id,
      'revieweeId', inserted_review.reviewee_id
    )
  );

  return query
  select
    inserted_review.id,
    inserted_review.request_id,
    inserted_review.thread_id,
    inserted_review.reviewer_id,
    inserted_review.reviewee_id,
    inserted_review.rating,
    inserted_review.comment,
    inserted_review.created_at;
end;
$$;

revoke all on function public.submit_rental_review(uuid, integer, text) from public;
grant execute on function public.submit_rental_review(uuid, integer, text) to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'rental_requests'
  ) then
    alter publication supabase_realtime add table public.rental_requests;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'rental_reviews'
  ) then
    alter publication supabase_realtime add table public.rental_reviews;
  end if;
end;
$$;
