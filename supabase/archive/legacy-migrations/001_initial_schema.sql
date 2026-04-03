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
    from public.listings
    where public.listings.id = listing_images.listing_id
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
    from public.listings
    where public.listings.id = listing_images.listing_id
      and public.listings.owner_id = auth.uid()
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
    from public.listings
    where public.listings.id = listing_images.listing_id
      and public.listings.owner_id = auth.uid()
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
    from public.listings
    where public.listings.id = applications.listing_id
      and public.listings.owner_id = auth.uid()
  )
);

drop policy if exists "applications_insert_applicant" on public.applications;
create policy "applications_insert_applicant"
on public.applications
for insert
to authenticated
with check (auth.uid() = applicant_id);

drop policy if exists "applications_update_related_users" on public.applications;
create policy "applications_update_related_users"
on public.applications
for update
to authenticated
using (
  auth.uid() = applicant_id
  or exists (
    select 1
    from public.listings
    where public.listings.id = applications.listing_id
      and public.listings.owner_id = auth.uid()
  )
)
with check (
  auth.uid() = applicant_id
  or exists (
    select 1
    from public.listings
    where public.listings.id = applications.listing_id
      and public.listings.owner_id = auth.uid()
  )
);

drop policy if exists "threads_select_member" on public.threads;
create policy "threads_select_member"
on public.threads
for select
to authenticated
using (public.is_thread_member(id, auth.uid()));

drop policy if exists "threads_insert_creator" on public.threads;
create policy "threads_insert_creator"
on public.threads
for insert
to authenticated
with check (auth.uid() = created_by);

drop policy if exists "thread_members_select_member" on public.thread_members;
create policy "thread_members_select_member"
on public.thread_members
for select
to authenticated
using (public.is_thread_member(thread_id, auth.uid()));

drop policy if exists "thread_members_insert_self_or_creator" on public.thread_members;
create policy "thread_members_insert_self_or_creator"
on public.thread_members
for insert
to authenticated
with check (
  auth.uid() = user_id
  or exists (
    select 1
    from public.threads
    where public.threads.id = thread_members.thread_id
      and public.threads.created_by = auth.uid()
  )
);

drop policy if exists "messages_select_member" on public.messages;
create policy "messages_select_member"
on public.messages
for select
to authenticated
using (public.is_thread_member(thread_id, auth.uid()));

drop policy if exists "messages_insert_sender_member" on public.messages;
create policy "messages_insert_sender_member"
on public.messages
for insert
to authenticated
with check (
  auth.uid() = sender_id
  and public.is_thread_member(thread_id, auth.uid())
);

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
