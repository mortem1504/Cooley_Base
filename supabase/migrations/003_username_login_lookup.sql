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
