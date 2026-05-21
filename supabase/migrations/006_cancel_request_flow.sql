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
    where app.status = 'withdrawn'
    returning app.*
    into result_application;
  else
    insert into public.applications as app (listing_id, applicant_id, status)
    values (target_listing.id, auth.uid(), 'pending')
    on conflict on constraint applications_listing_id_applicant_id_key
    do update
    set status = 'pending'
    where app.status = 'withdrawn'
    returning app.*
    into result_application;
  end if;

  if result_application.id is null then
    select a.*
    into result_application
    from public.applications as a
    where a.listing_id = target_listing.id
      and a.applicant_id = auth.uid();
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

drop function if exists public.cancel_job_application(uuid);
create or replace function public.cancel_job_application(target_application_id uuid)
returns table (
  application_id uuid,
  application_status text,
  listing_id uuid,
  listing_status text,
  cancelled_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  target_application public.applications%rowtype;
  target_listing public.listings%rowtype;
  current_timestamp_utc timestamptz := timezone('utc'::text, now());
begin
  if auth.uid() is null then
    raise exception 'You must be logged in to cancel an application.';
  end if;

  select a.*
  into target_application
  from public.applications as a
  where a.id = target_application_id;

  if not found then
    raise exception 'This application could not be found.';
  end if;

  if target_application.applicant_id <> auth.uid() then
    raise exception 'Only the applicant can cancel this application.';
  end if;

  if target_application.status not in ('pending', 'accepted') then
    raise exception 'Only pending or accepted applications can be cancelled.';
  end if;

  select l.*
  into target_listing
  from public.listings as l
  where l.id = target_application.listing_id
    and l.type = 'job';

  if not found then
    raise exception 'This job could not be found.';
  end if;

  update public.applications as a
  set status = 'withdrawn'
  where a.id = target_application.id
  returning a.*
  into target_application;

  if target_listing.status = 'accepted' then
    update public.listings as l
    set
      status = 'open',
      updated_at = current_timestamp_utc
    where l.id = target_listing.id
      and l.status = 'accepted'
    returning l.*
    into target_listing;
  end if;

  return query
  select
    target_application.id,
    target_application.status,
    target_listing.id,
    target_listing.status,
    current_timestamp_utc;
end;
$$;

revoke all on function public.cancel_job_application(uuid) from public;
grant execute on function public.cancel_job_application(uuid) to authenticated;

drop function if exists public.cancel_rental_request(uuid);
create or replace function public.cancel_rental_request(target_request_id uuid)
returns table (
  request_id uuid,
  thread_id uuid,
  listing_id uuid,
  request_status text,
  listing_status text,
  cancelled_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_request public.rental_requests%rowtype;
  target_listing public.listings%rowtype;
  current_timestamp_utc timestamptz := timezone('utc'::text, now());
begin
  if auth.uid() is null then
    raise exception 'You must be logged in to cancel a rental request.';
  end if;

  select rr.*
  into target_request
  from public.rental_requests as rr
  where rr.id = target_request_id;

  if not found then
    raise exception 'This rental request could not be found.';
  end if;

  if target_request.renter_id <> auth.uid() then
    raise exception 'Only the renter can cancel this rental request.';
  end if;

  if target_request.status not in ('requested', 'accepted') then
    raise exception 'Only requested or accepted rentals can be cancelled.';
  end if;

  select l.*
  into target_listing
  from public.listings as l
  where l.id = target_request.listing_id
    and l.type = 'rental';

  if not found then
    raise exception 'This rental listing could not be found.';
  end if;

  update public.rental_requests as rr
  set
    status = 'cancelled',
    updated_at = current_timestamp_utc
  where rr.id = target_request.id
  returning rr.*
  into target_request;

  update public.listings as l
  set
    status = 'open',
    updated_at = current_timestamp_utc
  where l.id = target_listing.id
  returning l.*
  into target_listing;

  perform public.append_thread_event_message(
    target_request.thread_id,
    auth.uid(),
    'Rental request cancelled. The listing is available again.',
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

revoke all on function public.cancel_rental_request(uuid) from public;
grant execute on function public.cancel_rental_request(uuid) to authenticated;
