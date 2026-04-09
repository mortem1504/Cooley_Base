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
