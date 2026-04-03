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
