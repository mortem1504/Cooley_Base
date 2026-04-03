alter table public.thread_members
add column if not exists last_read_at timestamptz not null default timezone('utc'::text, now());

create index if not exists thread_members_user_id_idx
on public.thread_members (user_id, thread_id);

create index if not exists threads_listing_id_idx
on public.threads (listing_id, last_message_at desc);

create index if not exists messages_thread_id_created_at_idx
on public.messages (thread_id, created_at desc);

drop policy if exists "thread_members_update_self" on public.thread_members;
create policy "thread_members_update_self"
on public.thread_members
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

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
  target_listing public.listings;
  existing_thread_id uuid;
  created_thread_id uuid;
  current_time timestamptz := timezone('utc'::text, now());
begin
  if auth.uid() is null then
    raise exception 'You must be logged in to start a conversation.';
  end if;

  select *
  into target_listing
  from public.listings
  where id = target_listing_id;

  if not found then
    raise exception 'This listing could not be found.';
  end if;

  if target_listing.owner_id = auth.uid() then
    raise exception 'You already own this listing.';
  end if;

  select t.id
  into existing_thread_id
  from public.threads t
  join public.thread_members requester_member
    on requester_member.thread_id = t.id
   and requester_member.user_id = auth.uid()
  join public.thread_members owner_member
    on owner_member.thread_id = t.id
   and owner_member.user_id = target_listing.owner_id
  where t.listing_id = target_listing_id
  limit 1;

  if existing_thread_id is not null then
    return query select existing_thread_id;
    return;
  end if;

  insert into public.threads (listing_id, created_by, last_message_at)
  values (target_listing_id, auth.uid(), current_time)
  returning id
  into created_thread_id;

  insert into public.thread_members (thread_id, user_id, last_read_at)
  values
    (created_thread_id, auth.uid(), current_time),
    (created_thread_id, target_listing.owner_id, current_time);

  return query select created_thread_id;
end;
$$;

revoke all on function public.get_or_create_listing_thread(uuid) from public;
grant execute on function public.get_or_create_listing_thread(uuid) to authenticated;

drop function if exists public.send_thread_message(uuid, text);
create or replace function public.send_thread_message(target_thread_id uuid, message_body text)
returns table (
  message_id uuid,
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
  inserted_message public.messages;
begin
  if auth.uid() is null then
    raise exception 'You must be logged in to send a message.';
  end if;

  if trimmed_body = '' then
    raise exception 'Message body cannot be empty.';
  end if;

  if not exists (
    select 1
    from public.thread_members
    where thread_id = target_thread_id
      and user_id = auth.uid()
  ) then
    raise exception 'You are not part of this conversation.';
  end if;

  insert into public.messages (thread_id, sender_id, body)
  values (target_thread_id, auth.uid(), trimmed_body)
  returning *
  into inserted_message;

  update public.threads
  set last_message_at = inserted_message.created_at
  where id = target_thread_id;

  update public.thread_members
  set last_read_at = inserted_message.created_at
  where thread_id = target_thread_id
    and user_id = auth.uid();

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

  update public.thread_members
  set last_read_at = marked_time
  where thread_id = target_thread_id
    and user_id = auth.uid();

  if not found then
    raise exception 'You are not part of this conversation.';
  end if;

  return query select target_thread_id, marked_time;
end;
$$;

revoke all on function public.mark_thread_read(uuid) from public;
grant execute on function public.mark_thread_read(uuid) to authenticated;

do $$
begin
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
