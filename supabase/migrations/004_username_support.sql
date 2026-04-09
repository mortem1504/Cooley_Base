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
