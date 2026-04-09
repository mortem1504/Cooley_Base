-- Cooley consolidated Supabase schema
-- Generated from migrations 001-008 for fresh project setup.
-- Keep the migrations folder for history; use this file for one-shot initialization.

-- ============================================================================
-- Source: migrations/001_app_schema.sql
-- ============================================================================

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text unique,
  full_name text not null default '',
  avatar_url text,
  short_bio text default '',
  rating numeric(2, 1) not null default 5.0,
  completed_jobs integer not null default 0,
  skills text[] not null default '{}',
  school_name text default 'Seoul Global University',
  student_verified boolean not null default false,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('job', 'rental')),
  title text not null,
  description text not null,
  category text not null,
  price numeric(10, 2) not null default 0,
  duration_text text,
  location_name text not null,
  latitude double precision,
  longitude double precision,
  starts_at timestamptz,
  urgent boolean not null default false,
  instant_accept boolean not null default false,
  status text not null default 'open' check (status in ('open', 'accepted', 'in_progress', 'completed', 'cancelled', 'paused', 'rented')),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  storage_path text not null,
  public_url text,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  applicant_id uuid not null references public.profiles (id) on delete cascade,
  message text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'withdrawn')),
  created_at timestamptz not null default timezone('utc'::text, now()),
  unique (listing_id, applicant_id)
);

create table if not exists public.threads (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.listings (id) on delete set null,
  created_by uuid not null references public.profiles (id) on delete cascade,
  last_message_at timestamptz not null default timezone('utc'::text, now()),
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.thread_members (
  thread_id uuid not null references public.threads (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default timezone('utc'::text, now()),
  last_read_at timestamptz not null default timezone('utc'::text, now()),
  primary key (thread_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.threads (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  read_at timestamptz
);

create index if not exists listings_owner_id_created_at_idx
on public.listings (owner_id, created_at desc);

create index if not exists listing_images_listing_id_sort_order_idx
on public.listing_images (listing_id, sort_order);

create index if not exists applications_applicant_id_created_at_idx
on public.applications (applicant_id, created_at desc);

create index if not exists applications_listing_id_status_idx
on public.applications (listing_id, status, created_at desc);

create index if not exists thread_members_user_id_idx
on public.thread_members (user_id, thread_id);

create index if not exists threads_listing_id_idx
on public.threads (listing_id, last_message_at desc);

create index if not exists messages_thread_id_created_at_idx
on public.messages (thread_id, created_at desc);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists listings_set_updated_at on public.listings;
create trigger listings_set_updated_at
before update on public.listings
for each row
execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    email,
    full_name,
    avatar_url,
    short_bio
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.raw_user_meta_data ->> 'avatar_url',
    coalesce(new.raw_user_meta_data ->> 'short_bio', '')
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = case
      when excluded.full_name = '' then public.profiles.full_name
      else excluded.full_name
    end,
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    short_bio = case
      when excluded.short_bio = '' then public.profiles.short_bio
      else excluded.short_bio
    end,
    updated_at = timezone('utc'::text, now());

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.listings enable row level security;
alter table public.listing_images enable row level security;
alter table public.applications enable row level security;
alter table public.threads enable row level security;
alter table public.thread_members enable row level security;
alter table public.messages enable row level security;

create or replace function public.is_thread_member(
  p_thread_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.thread_members as tm
    where tm.thread_id = p_thread_id
      and tm.user_id = coalesce(p_user_id, auth.uid())
  );
$$;

revoke all on function public.is_thread_member(uuid, uuid) from public;
grant execute on function public.is_thread_member(uuid, uuid) to authenticated;

drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
on public.profiles
for select
to authenticated
using (true);

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "listings_select_authenticated" on public.listings;
create policy "listings_select_authenticated"
on public.listings
for select
to authenticated
using (true);

drop policy if exists "listings_insert_owner" on public.listings;
create policy "listings_insert_owner"
on public.listings
for insert
to authenticated
with check (auth.uid() = owner_id);

drop policy if exists "listings_update_owner" on public.listings;
create policy "listings_update_owner"
on public.listings
for update
to authenticated
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

drop policy if exists "listings_delete_owner" on public.listings;
create policy "listings_delete_owner"
on public.listings
for delete
to authenticated
using (auth.uid() = owner_id);

drop policy if exists "listing_images_select_authenticated" on public.listing_images;
create policy "listing_images_select_authenticated"
on public.listing_images
for select
to authenticated
using (
  exists (
    select 1
    from public.listings as l
    where l.id = listing_images.listing_id
  )
);

drop policy if exists "listing_images_insert_owner" on public.listing_images;
create policy "listing_images_insert_owner"
on public.listing_images
for insert
to authenticated
with check (
  exists (
    select 1
    from public.listings as l
    where l.id = listing_images.listing_id
      and l.owner_id = auth.uid()
  )
);

drop policy if exists "listing_images_delete_owner" on public.listing_images;
create policy "listing_images_delete_owner"
on public.listing_images
for delete
to authenticated
using (
  exists (
    select 1
    from public.listings as l
    where l.id = listing_images.listing_id
      and l.owner_id = auth.uid()
  )
);

drop policy if exists "applications_select_related_users" on public.applications;
create policy "applications_select_related_users"
on public.applications
for select
to authenticated
using (
  auth.uid() = applicant_id
  or exists (
    select 1
    from public.listings as l
    where l.id = applications.listing_id
      and l.owner_id = auth.uid()
  )
);

drop policy if exists "threads_select_member" on public.threads;
create policy "threads_select_member"
on public.threads
for select
to authenticated
using (public.is_thread_member(id, auth.uid()));

drop policy if exists "thread_members_select_self" on public.thread_members;
create policy "thread_members_select_self"
on public.thread_members
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "messages_select_member" on public.messages;
create policy "messages_select_member"
on public.messages
for select
to authenticated
using (public.is_thread_member(thread_id, auth.uid()));

drop function if exists public.list_my_threads();
create or replace function public.list_my_threads()
returns table (
  thread_id uuid,
  listing_id uuid,
  listing_type text,
  listing_title text,
  listing_location_name text,
  participant_id uuid,
  participant_full_name text,
  participant_school_name text,
  participant_student_verified boolean,
  last_message_body text,
  last_message_at timestamptz,
  unread_count integer
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'You must be logged in to view conversations.';
  end if;

  return query
  with my_memberships as (
    select tm.thread_id, tm.last_read_at
    from public.thread_members as tm
    where tm.user_id = auth.uid()
  )
  select
    t.id as thread_id,
    l.id as listing_id,
    l.type as listing_type,
    coalesce(l.title, 'Listing removed') as listing_title,
    coalesce(l.location_name, 'Campus') as listing_location_name,
    participant.id as participant_id,
    coalesce(participant.full_name, 'Student User') as participant_full_name,
    coalesce(participant.school_name, 'Seoul Global University') as participant_school_name,
    coalesce(participant.student_verified, false) as participant_student_verified,
    latest_message.body as last_message_body,
    coalesce(latest_message.created_at, t.last_message_at, t.created_at) as last_message_at,
    coalesce(unread_summary.unread_count, 0)::integer as unread_count
  from my_memberships as mm
  join public.threads as t
    on t.id = mm.thread_id
  left join public.listings as l
    on l.id = t.listing_id
  left join lateral (
    select p.id, p.full_name, p.school_name, p.student_verified
    from public.thread_members as tm_other
    join public.profiles as p
      on p.id = tm_other.user_id
    where tm_other.thread_id = t.id
      and tm_other.user_id <> auth.uid()
    order by tm_other.joined_at asc
    limit 1
  ) as participant
    on true
  left join lateral (
    select m.body, m.created_at
    from public.messages as m
    where m.thread_id = t.id
    order by m.created_at desc
    limit 1
  ) as latest_message
    on true
  left join lateral (
    select count(*) as unread_count
    from public.messages as m
    where m.thread_id = t.id
      and m.sender_id <> auth.uid()
      and m.created_at > coalesce(mm.last_read_at, to_timestamp(0))
  ) as unread_summary
    on true
  order by coalesce(latest_message.created_at, t.last_message_at, t.created_at) desc;
end;
$$;

revoke all on function public.list_my_threads() from public;
grant execute on function public.list_my_threads() to authenticated;

drop function if exists public.get_thread_summary(uuid);
create or replace function public.get_thread_summary(target_thread_id uuid)
returns table (
  thread_id uuid,
  listing_id uuid,
  listing_type text,
  listing_title text,
  listing_location_name text,
  participant_id uuid,
  participant_full_name text,
  participant_school_name text,
  participant_student_verified boolean,
  last_message_body text,
  last_message_at timestamptz,
  unread_count integer
)
language sql
security definer
stable
set search_path = public
as $$
  select *
  from public.list_my_threads()
  where thread_id = target_thread_id
  limit 1;
$$;

revoke all on function public.get_thread_summary(uuid) from public;
grant execute on function public.get_thread_summary(uuid) to authenticated;

drop function if exists public.get_thread_messages(uuid);
create or replace function public.get_thread_messages(target_thread_id uuid)
returns table (
  id uuid,
  sender_id uuid,
  body text,
  created_at timestamptz
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
    m.created_at
  from public.messages as m
  where m.thread_id = target_thread_id
  order by m.created_at asc;
end;
$$;

revoke all on function public.get_thread_messages(uuid) from public;
grant execute on function public.get_thread_messages(uuid) to authenticated;

drop function if exists public.get_or_create_listing_thread(uuid);
create or replace function public.get_or_create_listing_thread(target_listing_id uuid)
returns table (
  thread_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_listing public.listings%rowtype;
  existing_thread_id uuid;
  created_thread_id uuid;
  current_timestamp_utc timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'You must be logged in to start a conversation.';
  end if;

  select l.*
  into target_listing
  from public.listings as l
  where l.id = target_listing_id;

  if not found then
    raise exception 'This listing could not be found.';
  end if;

  if target_listing.owner_id = auth.uid() then
    raise exception 'You already own this listing.';
  end if;

  select t.id
  into existing_thread_id
  from public.threads as t
  join public.thread_members as requester_member
    on requester_member.thread_id = t.id
   and requester_member.user_id = auth.uid()
  join public.thread_members as owner_member
    on owner_member.thread_id = t.id
   and owner_member.user_id = target_listing.owner_id
  where t.listing_id = target_listing_id
  limit 1;

  if existing_thread_id is not null then
    return query select existing_thread_id;
    return;
  end if;

  insert into public.threads (listing_id, created_by, last_message_at)
  values (target_listing_id, auth.uid(), current_timestamp_utc)
  returning id
  into created_thread_id;

  insert into public.thread_members (thread_id, user_id, last_read_at)
  values
    (created_thread_id, auth.uid(), current_timestamp_utc),
    (created_thread_id, target_listing.owner_id, current_timestamp_utc);

  return query select created_thread_id;
end;
$$;

revoke all on function public.get_or_create_listing_thread(uuid) from public;
grant execute on function public.get_or_create_listing_thread(uuid) to authenticated;

drop function if exists public.get_or_create_application_thread(uuid);
create or replace function public.get_or_create_application_thread(target_application_id uuid)
returns table (
  thread_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_application public.applications%rowtype;
  target_listing public.listings%rowtype;
  other_participant_id uuid;
  existing_thread_id uuid;
  created_thread_id uuid;
  current_timestamp_utc timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'You must be logged in to start a conversation.';
  end if;

  select a.*
  into target_application
  from public.applications as a
  where a.id = target_application_id;

  if not found then
    raise exception 'This application could not be found.';
  end if;

  select l.*
  into target_listing
  from public.listings as l
  where l.id = target_application.listing_id
    and l.type = 'job';

  if not found then
    raise exception 'This job could not be found.';
  end if;

  if auth.uid() = target_listing.owner_id then
    other_participant_id := target_application.applicant_id;
  elsif auth.uid() = target_application.applicant_id then
    other_participant_id := target_listing.owner_id;
  else
    raise exception 'You are not part of this application.';
  end if;

  select t.id
  into existing_thread_id
  from public.threads as t
  join public.thread_members as current_member
    on current_member.thread_id = t.id
   and current_member.user_id = auth.uid()
  join public.thread_members as other_member
    on other_member.thread_id = t.id
   and other_member.user_id = other_participant_id
  where t.listing_id = target_listing.id
  limit 1;

  if existing_thread_id is not null then
    return query select existing_thread_id;
    return;
  end if;

  insert into public.threads (listing_id, created_by, last_message_at)
  values (target_listing.id, auth.uid(), current_timestamp_utc)
  returning id
  into created_thread_id;

  insert into public.thread_members (thread_id, user_id, last_read_at)
  values
    (created_thread_id, auth.uid(), current_timestamp_utc),
    (created_thread_id, other_participant_id, current_timestamp_utc);

  return query select created_thread_id;
end;
$$;

revoke all on function public.get_or_create_application_thread(uuid) from public;
grant execute on function public.get_or_create_application_thread(uuid) to authenticated;

drop function if exists public.send_thread_message(uuid, text);
create or replace function public.send_thread_message(target_thread_id uuid, message_body text)
returns table (
  id uuid,
  thread_id uuid,
  sender_id uuid,
  body text,
  created_at timestamptz
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

  insert into public.messages (thread_id, sender_id, body)
  values (target_thread_id, auth.uid(), trimmed_body)
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
    inserted_message.created_at;
end;
$$;

revoke all on function public.send_thread_message(uuid, text) from public;
grant execute on function public.send_thread_message(uuid, text) to authenticated;

drop function if exists public.mark_thread_read(uuid);
create or replace function public.mark_thread_read(target_thread_id uuid)
returns table (
  thread_id uuid,
  last_read_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  marked_time timestamptz := timezone('utc'::text, now());
begin
  if auth.uid() is null then
    raise exception 'You must be logged in to update read status.';
  end if;

  if not public.is_thread_member(target_thread_id, auth.uid()) then
    raise exception 'You are not part of this conversation.';
  end if;

  update public.thread_members as tm
  set last_read_at = marked_time
  where tm.thread_id = target_thread_id
    and tm.user_id = auth.uid();

  return query select target_thread_id, marked_time;
end;
$$;

revoke all on function public.mark_thread_read(uuid) from public;
grant execute on function public.mark_thread_read(uuid) to authenticated;

drop function if exists public.apply_to_job(uuid);
drop function if exists public.apply_to_job(uuid, boolean);
create or replace function public.apply_to_job(
  target_listing_id uuid,
  accept_immediately boolean default false
)
returns table (
  application_id uuid,
  application_status text,
  listing_id uuid,
  listing_status text,
  applied_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  target_listing public.listings%rowtype;
  result_application public.applications%rowtype;
begin
  if auth.uid() is null then
    raise exception 'You must be logged in to apply.';
  end if;

  select l.*
  into target_listing
  from public.listings as l
  where l.id = target_listing_id
    and l.type = 'job';

  if not found then
    raise exception 'This job could not be found.';
  end if;

  if target_listing.owner_id = auth.uid() then
    raise exception 'You cannot apply to your own job.';
  end if;

  if target_listing.status <> 'open' then
    raise exception 'This job is no longer accepting applications.';
  end if;

  if accept_immediately then
    if not target_listing.instant_accept then
      raise exception 'This job does not support instant accept.';
    end if;

    update public.listings as l
    set
      status = 'accepted',
      updated_at = timezone('utc'::text, now())
    where l.id = target_listing.id
      and l.status = 'open'
    returning l.*
    into target_listing;

    if not found then
      raise exception 'This job has already been taken.';
    end if;

    insert into public.applications as app (listing_id, applicant_id, status)
    values (target_listing.id, auth.uid(), 'accepted')
    on conflict on constraint applications_listing_id_applicant_id_key
    do update
    set status = 'accepted'
    returning app.*
    into result_application;
  else
    insert into public.applications as app (listing_id, applicant_id, status)
    values (target_listing.id, auth.uid(), 'pending')
    on conflict on constraint applications_listing_id_applicant_id_key
    do nothing
    returning app.*
    into result_application;

    if result_application.id is null then
      select a.*
      into result_application
      from public.applications as a
      where a.listing_id = target_listing.id
        and a.applicant_id = auth.uid();
    end if;
  end if;

  return query
  select
    result_application.id,
    result_application.status,
    target_listing.id,
    target_listing.status,
    result_application.created_at;
end;
$$;

revoke all on function public.apply_to_job(uuid, boolean) from public;
grant execute on function public.apply_to_job(uuid, boolean) to authenticated;

drop function if exists public.review_job_application(uuid, text);
create or replace function public.review_job_application(
  target_application_id uuid,
  next_status text
)
returns table (
  application_id uuid,
  application_status text,
  listing_id uuid,
  listing_status text,
  applicant_id uuid,
  reviewed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  target_application public.applications%rowtype;
  target_listing public.listings%rowtype;
  normalized_status text := lower(btrim(next_status));
  current_timestamp_utc timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'You must be logged in to review applications.';
  end if;

  if normalized_status not in ('accepted', 'rejected') then
    raise exception 'Application reviews only support accepted or rejected.';
  end if;

  select a.*
  into target_application
  from public.applications as a
  where a.id = target_application_id;

  if not found then
    raise exception 'This application could not be found.';
  end if;

  select l.*
  into target_listing
  from public.listings as l
  where l.id = target_application.listing_id
    and l.type = 'job';

  if not found then
    raise exception 'This job could not be found.';
  end if;

  if target_listing.owner_id <> auth.uid() then
    raise exception 'Only the job owner can review applications.';
  end if;

  if target_listing.status in ('cancelled', 'completed') then
    raise exception 'This job can no longer be reviewed.';
  end if;

  if normalized_status = 'accepted' then
    if target_listing.status <> 'open' then
      raise exception 'This job is no longer open for new acceptances.';
    end if;

    update public.applications as a
    set status = 'accepted'
    where a.id = target_application.id;

    update public.applications as a
    set status = 'rejected'
    where a.listing_id = target_listing.id
      and a.id <> target_application.id
      and a.status = 'pending';

    update public.listings as l
    set
      status = 'accepted',
      updated_at = current_timestamp_utc
    where l.id = target_listing.id
    returning l.*
    into target_listing;
  else
    update public.applications as a
    set status = 'rejected'
    where a.id = target_application.id;
  end if;

  select a.*
  into target_application
  from public.applications as a
  where a.id = target_application.id;

  return query
  select
    target_application.id,
    target_application.status,
    target_listing.id,
    target_listing.status,
    target_application.applicant_id,
    current_timestamp_utc;
end;
$$;

revoke all on function public.review_job_application(uuid, text) from public;
grant execute on function public.review_job_application(uuid, text) to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'listings'
  ) then
    alter publication supabase_realtime add table public.listings;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'listing_images'
  ) then
    alter publication supabase_realtime add table public.listing_images;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'applications'
  ) then
    alter publication supabase_realtime add table public.applications;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'threads'
  ) then
    alter publication supabase_realtime add table public.threads;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'thread_members'
  ) then
    alter publication supabase_realtime add table public.thread_members;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end;
$$;

insert into storage.buckets (id, name, public)
values
  ('avatars', 'avatars', true),
  ('listing-images', 'listing-images', true),
  ('verification-docs', 'verification-docs', false)
on conflict (id) do nothing;

drop policy if exists "public_read_avatars" on storage.objects;
create policy "public_read_avatars"
on storage.objects
for select
to public
using (bucket_id = 'avatars');

drop policy if exists "public_read_listing_images" on storage.objects;
create policy "public_read_listing_images"
on storage.objects
for select
to public
using (bucket_id = 'listing-images');

drop policy if exists "upload_own_avatars" on storage.objects;
create policy "upload_own_avatars"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "update_own_avatars" on storage.objects;
create policy "update_own_avatars"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and split_part(name, '/', 1) = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "delete_own_avatars" on storage.objects;
create policy "delete_own_avatars"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "upload_own_listing_images" on storage.objects;
create policy "upload_own_listing_images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'listing-images'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "update_own_listing_images" on storage.objects;
create policy "update_own_listing_images"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'listing-images'
  and split_part(name, '/', 1) = auth.uid()::text
)
with check (
  bucket_id = 'listing-images'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "delete_own_listing_images" on storage.objects;
create policy "delete_own_listing_images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'listing-images'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "upload_own_verification_docs" on storage.objects;
create policy "upload_own_verification_docs"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'verification-docs'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "read_own_verification_docs" on storage.objects;
create policy "read_own_verification_docs"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'verification-docs'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "delete_own_verification_docs" on storage.objects;
create policy "delete_own_verification_docs"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'verification-docs'
  and split_part(name, '/', 1) = auth.uid()::text
);


-- ============================================================================
-- Source: migrations/002_existing_project_repairs.sql
-- ============================================================================

alter table public.thread_members
add column if not exists last_read_at timestamptz not null default timezone('utc'::text, now());

create index if not exists listings_owner_id_created_at_idx
on public.listings (owner_id, created_at desc);

create index if not exists listing_images_listing_id_sort_order_idx
on public.listing_images (listing_id, sort_order);

create index if not exists applications_applicant_id_created_at_idx
on public.applications (applicant_id, created_at desc);

create index if not exists applications_listing_id_status_idx
on public.applications (listing_id, status, created_at desc);

create index if not exists thread_members_user_id_idx
on public.thread_members (user_id, thread_id);

create index if not exists threads_listing_id_idx
on public.threads (listing_id, last_message_at desc);

create index if not exists messages_thread_id_created_at_idx
on public.messages (thread_id, created_at desc);

create or replace function public.is_thread_member(
  p_thread_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.thread_members as tm
    where tm.thread_id = p_thread_id
      and tm.user_id = coalesce(p_user_id, auth.uid())
  );
$$;

revoke all on function public.is_thread_member(uuid, uuid) from public;
grant execute on function public.is_thread_member(uuid, uuid) to authenticated;

drop policy if exists "applications_insert_applicant" on public.applications;
drop policy if exists "applications_update_related_users" on public.applications;

drop policy if exists "applications_select_related_users" on public.applications;
create policy "applications_select_related_users"
on public.applications
for select
to authenticated
using (
  auth.uid() = applicant_id
  or exists (
    select 1
    from public.listings as l
    where l.id = applications.listing_id
      and l.owner_id = auth.uid()
  )
);

drop policy if exists "threads_insert_creator" on public.threads;
drop policy if exists "threads_select_member" on public.threads;
create policy "threads_select_member"
on public.threads
for select
to authenticated
using (public.is_thread_member(id, auth.uid()));

drop policy if exists "thread_members_select_member" on public.thread_members;
drop policy if exists "thread_members_select_self" on public.thread_members;
drop policy if exists "thread_members_insert_self_or_creator" on public.thread_members;
drop policy if exists "thread_members_update_self" on public.thread_members;
create policy "thread_members_select_self"
on public.thread_members
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "messages_insert_sender_member" on public.messages;
drop policy if exists "messages_select_member" on public.messages;
create policy "messages_select_member"
on public.messages
for select
to authenticated
using (public.is_thread_member(thread_id, auth.uid()));

drop function if exists public.list_my_threads();
create or replace function public.list_my_threads()
returns table (
  thread_id uuid,
  listing_id uuid,
  listing_type text,
  listing_title text,
  listing_location_name text,
  participant_id uuid,
  participant_full_name text,
  participant_school_name text,
  participant_student_verified boolean,
  last_message_body text,
  last_message_at timestamptz,
  unread_count integer
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'You must be logged in to view conversations.';
  end if;

  return query
  with my_memberships as (
    select tm.thread_id, tm.last_read_at
    from public.thread_members as tm
    where tm.user_id = auth.uid()
  )
  select
    t.id as thread_id,
    l.id as listing_id,
    l.type as listing_type,
    coalesce(l.title, 'Listing removed') as listing_title,
    coalesce(l.location_name, 'Campus') as listing_location_name,
    participant.id as participant_id,
    coalesce(participant.full_name, 'Student User') as participant_full_name,
    coalesce(participant.school_name, 'Seoul Global University') as participant_school_name,
    coalesce(participant.student_verified, false) as participant_student_verified,
    latest_message.body as last_message_body,
    coalesce(latest_message.created_at, t.last_message_at, t.created_at) as last_message_at,
    coalesce(unread_summary.unread_count, 0)::integer as unread_count
  from my_memberships as mm
  join public.threads as t
    on t.id = mm.thread_id
  left join public.listings as l
    on l.id = t.listing_id
  left join lateral (
    select p.id, p.full_name, p.school_name, p.student_verified
    from public.thread_members as tm_other
    join public.profiles as p
      on p.id = tm_other.user_id
    where tm_other.thread_id = t.id
      and tm_other.user_id <> auth.uid()
    order by tm_other.joined_at asc
    limit 1
  ) as participant
    on true
  left join lateral (
    select m.body, m.created_at
    from public.messages as m
    where m.thread_id = t.id
    order by m.created_at desc
    limit 1
  ) as latest_message
    on true
  left join lateral (
    select count(*) as unread_count
    from public.messages as m
    where m.thread_id = t.id
      and m.sender_id <> auth.uid()
      and m.created_at > coalesce(mm.last_read_at, to_timestamp(0))
  ) as unread_summary
    on true
  order by coalesce(latest_message.created_at, t.last_message_at, t.created_at) desc;
end;
$$;

revoke all on function public.list_my_threads() from public;
grant execute on function public.list_my_threads() to authenticated;

drop function if exists public.get_thread_summary(uuid);
create or replace function public.get_thread_summary(target_thread_id uuid)
returns table (
  thread_id uuid,
  listing_id uuid,
  listing_type text,
  listing_title text,
  listing_location_name text,
  participant_id uuid,
  participant_full_name text,
  participant_school_name text,
  participant_student_verified boolean,
  last_message_body text,
  last_message_at timestamptz,
  unread_count integer
)
language sql
security definer
stable
set search_path = public
as $$
  select *
  from public.list_my_threads()
  where thread_id = target_thread_id
  limit 1;
$$;

revoke all on function public.get_thread_summary(uuid) from public;
grant execute on function public.get_thread_summary(uuid) to authenticated;

drop function if exists public.get_thread_messages(uuid);
create or replace function public.get_thread_messages(target_thread_id uuid)
returns table (
  id uuid,
  sender_id uuid,
  body text,
  created_at timestamptz
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
    m.created_at
  from public.messages as m
  where m.thread_id = target_thread_id
  order by m.created_at asc;
end;
$$;

revoke all on function public.get_thread_messages(uuid) from public;
grant execute on function public.get_thread_messages(uuid) to authenticated;

drop function if exists public.get_or_create_listing_thread(uuid);
create or replace function public.get_or_create_listing_thread(target_listing_id uuid)
returns table (
  thread_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_listing public.listings%rowtype;
  existing_thread_id uuid;
  created_thread_id uuid;
  current_timestamp_utc timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'You must be logged in to start a conversation.';
  end if;

  select l.*
  into target_listing
  from public.listings as l
  where l.id = target_listing_id;

  if not found then
    raise exception 'This listing could not be found.';
  end if;

  if target_listing.owner_id = auth.uid() then
    raise exception 'You already own this listing.';
  end if;

  select t.id
  into existing_thread_id
  from public.threads as t
  join public.thread_members as requester_member
    on requester_member.thread_id = t.id
   and requester_member.user_id = auth.uid()
  join public.thread_members as owner_member
    on owner_member.thread_id = t.id
   and owner_member.user_id = target_listing.owner_id
  where t.listing_id = target_listing_id
  limit 1;

  if existing_thread_id is not null then
    return query select existing_thread_id;
    return;
  end if;

  insert into public.threads (listing_id, created_by, last_message_at)
  values (target_listing_id, auth.uid(), current_timestamp_utc)
  returning id
  into created_thread_id;

  insert into public.thread_members (thread_id, user_id, last_read_at)
  values
    (created_thread_id, auth.uid(), current_timestamp_utc),
    (created_thread_id, target_listing.owner_id, current_timestamp_utc);

  return query select created_thread_id;
end;
$$;

revoke all on function public.get_or_create_listing_thread(uuid) from public;
grant execute on function public.get_or_create_listing_thread(uuid) to authenticated;

drop function if exists public.get_or_create_application_thread(uuid);
create or replace function public.get_or_create_application_thread(target_application_id uuid)
returns table (
  thread_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_application public.applications%rowtype;
  target_listing public.listings%rowtype;
  other_participant_id uuid;
  existing_thread_id uuid;
  created_thread_id uuid;
  current_timestamp_utc timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'You must be logged in to start a conversation.';
  end if;

  select a.*
  into target_application
  from public.applications as a
  where a.id = target_application_id;

  if not found then
    raise exception 'This application could not be found.';
  end if;

  select l.*
  into target_listing
  from public.listings as l
  where l.id = target_application.listing_id
    and l.type = 'job';

  if not found then
    raise exception 'This job could not be found.';
  end if;

  if auth.uid() = target_listing.owner_id then
    other_participant_id := target_application.applicant_id;
  elsif auth.uid() = target_application.applicant_id then
    other_participant_id := target_listing.owner_id;
  else
    raise exception 'You are not part of this application.';
  end if;

  select t.id
  into existing_thread_id
  from public.threads as t
  join public.thread_members as current_member
    on current_member.thread_id = t.id
   and current_member.user_id = auth.uid()
  join public.thread_members as other_member
    on other_member.thread_id = t.id
   and other_member.user_id = other_participant_id
  where t.listing_id = target_listing.id
  limit 1;

  if existing_thread_id is not null then
    return query select existing_thread_id;
    return;
  end if;

  insert into public.threads (listing_id, created_by, last_message_at)
  values (target_listing.id, auth.uid(), current_timestamp_utc)
  returning id
  into created_thread_id;

  insert into public.thread_members (thread_id, user_id, last_read_at)
  values
    (created_thread_id, auth.uid(), current_timestamp_utc),
    (created_thread_id, other_participant_id, current_timestamp_utc);

  return query select created_thread_id;
end;
$$;

revoke all on function public.get_or_create_application_thread(uuid) from public;
grant execute on function public.get_or_create_application_thread(uuid) to authenticated;

drop function if exists public.send_thread_message(uuid, text);
create or replace function public.send_thread_message(target_thread_id uuid, message_body text)
returns table (
  id uuid,
  thread_id uuid,
  sender_id uuid,
  body text,
  created_at timestamptz
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

  insert into public.messages (thread_id, sender_id, body)
  values (target_thread_id, auth.uid(), trimmed_body)
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
    inserted_message.created_at;
end;
$$;

revoke all on function public.send_thread_message(uuid, text) from public;
grant execute on function public.send_thread_message(uuid, text) to authenticated;

drop function if exists public.mark_thread_read(uuid);
create or replace function public.mark_thread_read(target_thread_id uuid)
returns table (
  thread_id uuid,
  last_read_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  marked_time timestamptz := timezone('utc'::text, now());
begin
  if auth.uid() is null then
    raise exception 'You must be logged in to update read status.';
  end if;

  if not public.is_thread_member(target_thread_id, auth.uid()) then
    raise exception 'You are not part of this conversation.';
  end if;

  update public.thread_members as tm
  set last_read_at = marked_time
  where tm.thread_id = target_thread_id
    and tm.user_id = auth.uid();

  return query select target_thread_id, marked_time;
end;
$$;

revoke all on function public.mark_thread_read(uuid) from public;
grant execute on function public.mark_thread_read(uuid) to authenticated;

drop function if exists public.apply_to_job(uuid);
drop function if exists public.apply_to_job(uuid, boolean);
create or replace function public.apply_to_job(
  target_listing_id uuid,
  accept_immediately boolean default false
)
returns table (
  application_id uuid,
  application_status text,
  listing_id uuid,
  listing_status text,
  applied_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  target_listing public.listings%rowtype;
  result_application public.applications%rowtype;
begin
  if auth.uid() is null then
    raise exception 'You must be logged in to apply.';
  end if;

  select l.*
  into target_listing
  from public.listings as l
  where l.id = target_listing_id
    and l.type = 'job';

  if not found then
    raise exception 'This job could not be found.';
  end if;

  if target_listing.owner_id = auth.uid() then
    raise exception 'You cannot apply to your own job.';
  end if;

  if target_listing.status <> 'open' then
    raise exception 'This job is no longer accepting applications.';
  end if;

  if accept_immediately then
    if not target_listing.instant_accept then
      raise exception 'This job does not support instant accept.';
    end if;

    update public.listings as l
    set
      status = 'accepted',
      updated_at = timezone('utc'::text, now())
    where l.id = target_listing.id
      and l.status = 'open'
    returning l.*
    into target_listing;

    if not found then
      raise exception 'This job has already been taken.';
    end if;

    insert into public.applications as app (listing_id, applicant_id, status)
    values (target_listing.id, auth.uid(), 'accepted')
    on conflict on constraint applications_listing_id_applicant_id_key
    do update
    set status = 'accepted'
    returning app.*
    into result_application;
  else
    insert into public.applications as app (listing_id, applicant_id, status)
    values (target_listing.id, auth.uid(), 'pending')
    on conflict on constraint applications_listing_id_applicant_id_key
    do nothing
    returning app.*
    into result_application;

    if result_application.id is null then
      select a.*
      into result_application
      from public.applications as a
      where a.listing_id = target_listing.id
        and a.applicant_id = auth.uid();
    end if;
  end if;

  return query
  select
    result_application.id,
    result_application.status,
    target_listing.id,
    target_listing.status,
    result_application.created_at;
end;
$$;

revoke all on function public.apply_to_job(uuid, boolean) from public;
grant execute on function public.apply_to_job(uuid, boolean) to authenticated;

drop function if exists public.review_job_application(uuid, text);
create or replace function public.review_job_application(
  target_application_id uuid,
  next_status text
)
returns table (
  application_id uuid,
  application_status text,
  listing_id uuid,
  listing_status text,
  applicant_id uuid,
  reviewed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  target_application public.applications%rowtype;
  target_listing public.listings%rowtype;
  normalized_status text := lower(btrim(next_status));
  current_timestamp_utc timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'You must be logged in to review applications.';
  end if;

  if normalized_status not in ('accepted', 'rejected') then
    raise exception 'Application reviews only support accepted or rejected.';
  end if;

  select a.*
  into target_application
  from public.applications as a
  where a.id = target_application_id;

  if not found then
    raise exception 'This application could not be found.';
  end if;

  select l.*
  into target_listing
  from public.listings as l
  where l.id = target_application.listing_id
    and l.type = 'job';

  if not found then
    raise exception 'This job could not be found.';
  end if;

  if target_listing.owner_id <> auth.uid() then
    raise exception 'Only the job owner can review applications.';
  end if;

  if target_listing.status in ('cancelled', 'completed') then
    raise exception 'This job can no longer be reviewed.';
  end if;

  if normalized_status = 'accepted' then
    if target_listing.status <> 'open' then
      raise exception 'This job is no longer open for new acceptances.';
    end if;

    update public.applications as a
    set status = 'accepted'
    where a.id = target_application.id;

    update public.applications as a
    set status = 'rejected'
    where a.listing_id = target_listing.id
      and a.id <> target_application.id
      and a.status = 'pending';

    update public.listings as l
    set
      status = 'accepted',
      updated_at = current_timestamp_utc
    where l.id = target_listing.id
    returning l.*
    into target_listing;
  else
    update public.applications as a
    set status = 'rejected'
    where a.id = target_application.id;
  end if;

  select a.*
  into target_application
  from public.applications as a
  where a.id = target_application.id;

  return query
  select
    target_application.id,
    target_application.status,
    target_listing.id,
    target_listing.status,
    target_application.applicant_id,
    current_timestamp_utc;
end;
$$;

revoke all on function public.review_job_application(uuid, text) from public;
grant execute on function public.review_job_application(uuid, text) to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'listings'
  ) then
    alter publication supabase_realtime add table public.listings;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'listing_images'
  ) then
    alter publication supabase_realtime add table public.listing_images;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'applications'
  ) then
    alter publication supabase_realtime add table public.applications;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'threads'
  ) then
    alter publication supabase_realtime add table public.threads;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'thread_members'
  ) then
    alter publication supabase_realtime add table public.thread_members;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end;
$$;


-- ============================================================================
-- Source: migrations/003_username_login_lookup.sql
-- ============================================================================

create or replace function public.resolve_login_email(input_identifier text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_identifier text := lower(trim(coalesce(input_identifier, '')));
  matched_email text;
  matched_count integer;
begin
  if normalized_identifier = '' then
    return null;
  end if;

  if position('@' in normalized_identifier) > 0 then
    return normalized_identifier;
  end if;

  select count(*), min(email)
  into matched_count, matched_email
  from public.profiles
  where email is not null
    and lower(split_part(email, '@', 1)) = normalized_identifier;

  if matched_count = 1 then
    return matched_email;
  end if;

  if matched_count > 1 then
    raise exception 'Multiple accounts match that username. Use your full email instead.';
  end if;

  return null;
end;
$$;

revoke all on function public.resolve_login_email(text) from public;
grant execute on function public.resolve_login_email(text) to anon, authenticated;


-- ============================================================================
-- Source: migrations/004_username_support.sql
-- ============================================================================

alter table public.profiles
add column if not exists username text;

create unique index if not exists profiles_username_lower_idx
on public.profiles (lower(username))
where username is not null and btrim(username) <> '';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    email,
    username,
    full_name,
    avatar_url,
    short_bio
  )
  values (
    new.id,
    new.email,
    nullif(lower(trim(coalesce(new.raw_user_meta_data ->> 'username', ''))), ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.raw_user_meta_data ->> 'avatar_url',
    coalesce(new.raw_user_meta_data ->> 'short_bio', '')
  )
  on conflict (id) do update
  set
    email = excluded.email,
    username = case
      when excluded.username is null then public.profiles.username
      else excluded.username
    end,
    full_name = case
      when excluded.full_name = '' then public.profiles.full_name
      else excluded.full_name
    end,
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    short_bio = case
      when excluded.short_bio = '' then public.profiles.short_bio
      else excluded.short_bio
    end,
    updated_at = timezone('utc'::text, now());

  return new;
end;
$$;

create or replace function public.resolve_login_email(input_identifier text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_identifier text := lower(trim(coalesce(input_identifier, '')));
  matched_email text;
  matched_count integer;
begin
  if normalized_identifier = '' then
    return null;
  end if;

  if position('@' in normalized_identifier) > 0 then
    return normalized_identifier;
  end if;

  select count(*), min(email)
  into matched_count, matched_email
  from public.profiles
  where email is not null
    and lower(username) = normalized_identifier;

  if matched_count = 1 then
    return matched_email;
  end if;

  select count(*), min(email)
  into matched_count, matched_email
  from public.profiles
  where email is not null
    and lower(split_part(email, '@', 1)) = normalized_identifier;

  if matched_count = 1 then
    return matched_email;
  end if;

  if matched_count > 1 then
    raise exception 'Multiple accounts match that username. Use your full email instead.';
  end if;

  return null;
end;
$$;

revoke all on function public.resolve_login_email(text) from public;
grant execute on function public.resolve_login_email(text) to anon, authenticated;


-- ============================================================================
-- Source: migrations/005_rental_request_flow.sql
-- ============================================================================

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


-- ============================================================================
-- Source: migrations/006_public_profile_reviews.sql
-- ============================================================================

drop policy if exists "rental_reviews_select_related_users" on public.rental_reviews;
drop policy if exists "rental_reviews_select_authenticated" on public.rental_reviews;
create policy "rental_reviews_select_authenticated"
on public.rental_reviews
for select
to authenticated
using (true);

create index if not exists rental_reviews_reviewee_id_created_at_idx
on public.rental_reviews (reviewee_id, created_at desc);

create or replace function public.refresh_profile_rating(target_user_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles as p
  set
    rating = coalesce(
      (
        select round(avg(rr.rating)::numeric, 1)
        from public.rental_reviews as rr
        where rr.reviewee_id = target_user_id
      ),
      5.0
    ),
    updated_at = timezone('utc'::text, now())
  where p.id = target_user_id;
$$;

revoke all on function public.refresh_profile_rating(uuid) from public;
grant execute on function public.refresh_profile_rating(uuid) to authenticated;

drop function if exists public.list_my_threads();
create or replace function public.list_my_threads()
returns table (
  thread_id uuid,
  listing_id uuid,
  listing_type text,
  listing_title text,
  listing_location_name text,
  participant_id uuid,
  participant_full_name text,
  participant_school_name text,
  participant_student_verified boolean,
  participant_avatar_url text,
  last_message_body text,
  last_message_at timestamptz,
  unread_count integer
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'You must be logged in to view conversations.';
  end if;

  return query
  with my_memberships as (
    select tm.thread_id, tm.last_read_at
    from public.thread_members as tm
    where tm.user_id = auth.uid()
  )
  select
    t.id as thread_id,
    l.id as listing_id,
    l.type as listing_type,
    coalesce(l.title, 'Listing removed') as listing_title,
    coalesce(l.location_name, 'Campus') as listing_location_name,
    participant.id as participant_id,
    coalesce(participant.full_name, 'Student User') as participant_full_name,
    coalesce(participant.school_name, 'Seoul Global University') as participant_school_name,
    coalesce(participant.student_verified, false) as participant_student_verified,
    participant.avatar_url as participant_avatar_url,
    latest_message.body as last_message_body,
    coalesce(latest_message.created_at, t.last_message_at, t.created_at) as last_message_at,
    coalesce(unread_summary.unread_count, 0)::integer as unread_count
  from my_memberships as mm
  join public.threads as t
    on t.id = mm.thread_id
  left join public.listings as l
    on l.id = t.listing_id
  left join lateral (
    select p.id, p.full_name, p.school_name, p.student_verified, p.avatar_url
    from public.thread_members as tm_other
    join public.profiles as p
      on p.id = tm_other.user_id
    where tm_other.thread_id = t.id
      and tm_other.user_id <> auth.uid()
    order by tm_other.joined_at asc
    limit 1
  ) as participant
    on true
  left join lateral (
    select m.body, m.created_at
    from public.messages as m
    where m.thread_id = t.id
    order by m.created_at desc
    limit 1
  ) as latest_message
    on true
  left join lateral (
    select count(*) as unread_count
    from public.messages as m
    where m.thread_id = t.id
      and m.sender_id <> auth.uid()
      and m.created_at > coalesce(mm.last_read_at, to_timestamp(0))
  ) as unread_summary
    on true
  order by coalesce(latest_message.created_at, t.last_message_at, t.created_at) desc;
end;
$$;

revoke all on function public.list_my_threads() from public;
grant execute on function public.list_my_threads() to authenticated;

drop function if exists public.get_thread_summary(uuid);
create or replace function public.get_thread_summary(target_thread_id uuid)
returns table (
  thread_id uuid,
  listing_id uuid,
  listing_type text,
  listing_title text,
  listing_location_name text,
  participant_id uuid,
  participant_full_name text,
  participant_school_name text,
  participant_student_verified boolean,
  participant_avatar_url text,
  last_message_body text,
  last_message_at timestamptz,
  unread_count integer
)
language sql
security definer
stable
set search_path = public
as $$
  select *
  from public.list_my_threads()
  where thread_id = target_thread_id
  limit 1;
$$;

revoke all on function public.get_thread_summary(uuid) from public;
grant execute on function public.get_thread_summary(uuid) to authenticated;

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

  perform public.refresh_profile_rating(inserted_review.reviewee_id);

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
declare
  next_reviewee_id uuid;
begin
  for next_reviewee_id in
    select distinct rr.reviewee_id
    from public.rental_reviews as rr
  loop
    perform public.refresh_profile_rating(next_reviewee_id);
  end loop;
end;
$$;


-- ============================================================================
-- Source: migrations/007_profile_id_card_fields.sql
-- ============================================================================

alter table public.profiles
add column if not exists year_level text not null default 'Year 1';

alter table public.profiles
add column if not exists id_card_color text not null default '#B9D9F7';


-- ============================================================================
-- Source: migrations/008_profile_badges_and_university.sql
-- ============================================================================

alter table public.profiles
add column if not exists university_key text;

alter table public.profiles
add column if not exists custom_badges text[] not null default '{}';

alter table public.profiles
add column if not exists selected_achievement_badges text[] not null default '{}';

update public.profiles
set custom_badges = coalesce(skills, '{}'::text[])
where coalesce(cardinality(custom_badges), 0) = 0
  and coalesce(cardinality(skills), 0) > 0;

update public.profiles
set university_key = 'hanyang'
where university_key is null
  and (
    lower(coalesce(email, '')) like '%hanyang.ac.kr%'
    or lower(coalesce(school_name, '')) like '%hanyang%'
  );

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_custom_badges_max_check'
  ) then
    alter table public.profiles
    add constraint profiles_custom_badges_max_check
    check (coalesce(cardinality(custom_badges), 0) <= 5);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_selected_achievement_badges_max_check'
  ) then
    alter table public.profiles
    add constraint profiles_selected_achievement_badges_max_check
    check (coalesce(cardinality(selected_achievement_badges), 0) <= 3);
  end if;
end;
$$;


