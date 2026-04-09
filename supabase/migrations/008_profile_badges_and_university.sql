alter table public.profiles
add column if not exists university_key text;

alter table public.profiles
add column if not exists custom_badges text[] not null default '{}';

alter table public.profiles
add column if not exists selected_achievement_badges text[] not null default '{}';

update public.profiles
set custom_badges = coalesce(skills, '{}'::text[])
where coalesce(cardinality(custom_badges), 0) = 0
  and coalesce(cardinality(skills), 0) > 0;

update public.profiles
set university_key = 'hanyang'
where university_key is null
  and (
    lower(coalesce(email, '')) like '%hanyang.ac.kr%'
    or lower(coalesce(school_name, '')) like '%hanyang%'
  );

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_custom_badges_max_check'
  ) then
    alter table public.profiles
    add constraint profiles_custom_badges_max_check
    check (coalesce(cardinality(custom_badges), 0) <= 5);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_selected_achievement_badges_max_check'
  ) then
    alter table public.profiles
    add constraint profiles_selected_achievement_badges_max_check
    check (coalesce(cardinality(selected_achievement_badges), 0) <= 3);
  end if;
end;
$$;
