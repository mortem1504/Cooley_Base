drop function if exists public.apply_to_job(uuid);
drop function if exists public.apply_to_job(uuid, boolean);

create or replace function public.apply_to_job(
  p_target_listing_id uuid,
  p_accept_immediately boolean default false
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
  v_target_listing public.listings;
  v_result_application public.applications;
begin
  if auth.uid() is null then
    raise exception 'You must be logged in to apply.';
  end if;

  select *
  into v_target_listing
  from public.listings as l
  where l.id = p_target_listing_id
    and l.type = 'job';

  if not found then
    raise exception 'This job could not be found.';
  end if;

  if v_target_listing.owner_id = auth.uid() then
    raise exception 'You cannot apply to your own job.';
  end if;

  if v_target_listing.status <> 'open' then
    raise exception 'This job is no longer accepting applications.';
  end if;

  if p_accept_immediately then
    if not v_target_listing.instant_accept then
      raise exception 'This job does not support instant accept.';
    end if;

    update public.listings as l
    set
      status = 'accepted',
      updated_at = timezone('utc'::text, now())
    where l.id = v_target_listing.id
      and l.status = 'open'
    returning *
    into v_target_listing;

    if not found then
      raise exception 'This job has already been taken.';
    end if;

    insert into public.applications (listing_id, applicant_id, status)
    values (v_target_listing.id, auth.uid(), 'accepted')
    on conflict (listing_id, applicant_id) do update
    set status = 'accepted'
    returning *
    into v_result_application;
  else
    insert into public.applications (listing_id, applicant_id, status)
    values (v_target_listing.id, auth.uid(), 'pending')
    on conflict (listing_id, applicant_id) do nothing
    returning *
    into v_result_application;

    if v_result_application.id is null then
      select *
      into v_result_application
      from public.applications as a
      where a.listing_id = v_target_listing.id
        and a.applicant_id = auth.uid();
    end if;
  end if;

  return query
  select
    v_result_application.id,
    v_result_application.status,
    v_target_listing.id,
    v_target_listing.status,
    v_result_application.created_at;
end;
$$;

revoke all on function public.apply_to_job(uuid, boolean) from public;
grant execute on function public.apply_to_job(uuid, boolean) to authenticated;

drop function if exists public.get_or_create_listing_thread(uuid);
create or replace function public.get_or_create_listing_thread(p_target_listing_id uuid)
returns table (
  thread_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_listing public.listings;
  v_existing_thread_id uuid;
  v_created_thread_id uuid;
  v_current_timestamp_utc timestamptz := timezone('utc'::text, now());
begin
  if auth.uid() is null then
    raise exception 'You must be logged in to start a conversation.';
  end if;

  select *
  into v_target_listing
  from public.listings as l
  where l.id = p_target_listing_id;

  if not found then
    raise exception 'This listing could not be found.';
  end if;

  if v_target_listing.owner_id = auth.uid() then
    raise exception 'You already own this listing.';
  end if;

  select t.id
  into v_existing_thread_id
  from public.threads as t
  join public.thread_members as requester_member
    on requester_member.thread_id = t.id
   and requester_member.user_id = auth.uid()
  join public.thread_members as owner_member
    on owner_member.thread_id = t.id
   and owner_member.user_id = v_target_listing.owner_id
  where t.listing_id = p_target_listing_id
  limit 1;

  if v_existing_thread_id is not null then
    return query select v_existing_thread_id;
    return;
  end if;

  insert into public.threads (listing_id, created_by, last_message_at)
  values (p_target_listing_id, auth.uid(), v_current_timestamp_utc)
  returning id
  into v_created_thread_id;

  insert into public.thread_members (thread_id, user_id, last_read_at)
  values
    (v_created_thread_id, auth.uid(), v_current_timestamp_utc),
    (v_created_thread_id, v_target_listing.owner_id, v_current_timestamp_utc);

  return query select v_created_thread_id;
end;
$$;

revoke all on function public.get_or_create_listing_thread(uuid) from public;
grant execute on function public.get_or_create_listing_thread(uuid) to authenticated;

drop function if exists public.review_job_application(uuid, text);
create or replace function public.review_job_application(
  p_target_application_id uuid,
  p_next_status text
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
declare
  v_target_application public.applications;
  v_target_listing public.listings;
  v_normalized_status text := lower(btrim(p_next_status));
  v_current_timestamp_utc timestamptz := timezone('utc'::text, now());
begin
  if auth.uid() is null then
    raise exception 'You must be logged in to review applications.';
  end if;

  if v_normalized_status not in ('accepted', 'rejected') then
    raise exception 'Application reviews only support accepted or rejected.';
  end if;

  select *
  into v_target_application
  from public.applications as a
  where a.id = p_target_application_id;

  if not found then
    raise exception 'This application could not be found.';
  end if;

  select *
  into v_target_listing
  from public.listings as l
  where l.id = v_target_application.listing_id
    and l.type = 'job';

  if not found then
    raise exception 'This job could not be found.';
  end if;

  if v_target_listing.owner_id <> auth.uid() then
    raise exception 'Only the job owner can review applications.';
  end if;

  if v_target_listing.status in ('cancelled', 'completed') then
    raise exception 'This job can no longer be reviewed.';
  end if;

  if v_normalized_status = 'accepted' then
    if v_target_listing.status <> 'open' then
      raise exception 'This job is no longer open for new acceptances.';
    end if;

    update public.applications as a
    set status = 'accepted'
    where a.id = v_target_application.id;

    update public.applications as a
    set status = 'rejected'
    where a.listing_id = v_target_listing.id
      and a.id <> v_target_application.id
      and a.status = 'pending';

    update public.listings as l
    set
      status = 'accepted',
      updated_at = v_current_timestamp_utc
    where l.id = v_target_listing.id
    returning *
    into v_target_listing;
  else
    update public.applications as a
    set status = 'rejected'
    where a.id = v_target_application.id;
  end if;

  select *
  into v_target_application
  from public.applications as a
  where a.id = v_target_application.id;

  return query
  select
    v_target_application.id,
    v_target_application.status,
    v_target_listing.id,
    v_target_listing.status,
    v_target_application.applicant_id,
    v_current_timestamp_utc;
end;
$$;

revoke all on function public.review_job_application(uuid, text) from public;
grant execute on function public.review_job_application(uuid, text) to authenticated;
