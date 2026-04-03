create index if not exists listings_owner_id_created_at_idx
on public.listings (owner_id, created_at desc);

create index if not exists applications_applicant_id_created_at_idx
on public.applications (applicant_id, created_at desc);

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
  where id = target_listing_id
    and type = 'job';

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
    where id = target_listing.id
      and status = 'open'
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
      from public.applications
      where listing_id = target_listing.id
        and applicant_id = auth.uid();
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
