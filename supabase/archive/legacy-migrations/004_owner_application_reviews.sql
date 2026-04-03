create index if not exists applications_listing_id_status_idx
on public.applications (listing_id, status, created_at desc);

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
declare
  target_application public.applications;
  target_listing public.listings;
  normalized_status text := lower(btrim(next_status));
  current_time timestamptz := timezone('utc'::text, now());
begin
  if auth.uid() is null then
    raise exception 'You must be logged in to review applications.';
  end if;

  if normalized_status not in ('accepted', 'rejected') then
    raise exception 'Application reviews only support accepted or rejected.';
  end if;

  select *
  into target_application
  from public.applications
  where id = target_application_id;

  if not found then
    raise exception 'This application could not be found.';
  end if;

  select *
  into target_listing
  from public.listings
  where id = target_application.listing_id
    and type = 'job';

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

    update public.applications
    set status = 'accepted'
    where id = target_application.id;

    update public.applications
    set status = 'rejected'
    where listing_id = target_listing.id
      and id <> target_application.id
      and status = 'pending';

    update public.listings
    set
      status = 'accepted',
      updated_at = current_time
    where id = target_listing.id
    returning *
    into target_listing;
  else
    update public.applications
    set status = 'rejected'
    where id = target_application.id;
  end if;

  select *
  into target_application
  from public.applications
  where id = target_application.id;

  return query
  select
    target_application.id,
    target_application.status,
    target_listing.id,
    target_listing.status,
    target_application.applicant_id,
    current_time;
end;
$$;

revoke all on function public.review_job_application(uuid, text) from public;
grant execute on function public.review_job_application(uuid, text) to authenticated;
