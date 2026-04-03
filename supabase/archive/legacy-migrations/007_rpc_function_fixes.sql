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
declare
  target_listing public.listings;
  result_application public.applications;
begin
  if auth.uid() is null then
    raise exception 'You must be logged in to apply.';
  end if;

  select *
  into target_listing
  from public.listings
  where public.listings.id = target_listing_id
    and public.listings.type = 'job';

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

    update public.listings
    set
      status = 'accepted',
      updated_at = timezone('utc'::text, now())
    where public.listings.id = target_listing.id
      and public.listings.status = 'open'
    returning *
    into target_listing;

    if not found then
      raise exception 'This job has already been taken.';
    end if;

    insert into public.applications (listing_id, applicant_id, status)
    values (target_listing.id, auth.uid(), 'accepted')
    on conflict (listing_id, applicant_id) do update
    set status = 'accepted'
    returning *
    into result_application;
  else
    insert into public.applications (listing_id, applicant_id, status)
    values (target_listing.id, auth.uid(), 'pending')
    on conflict (listing_id, applicant_id) do nothing
    returning *
    into result_application;

    if result_application.id is null then
      select *
      into result_application
      from public.applications as existing_application
      where existing_application.listing_id = target_listing.id
        and existing_application.applicant_id = auth.uid();
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
  current_timestamp_utc timestamptz := timezone('utc'::text, now());
begin
  if auth.uid() is null then
    raise exception 'You must be logged in to start a conversation.';
  end if;

  select *
  into target_listing
  from public.listings
  where public.listings.id = target_listing_id;

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
