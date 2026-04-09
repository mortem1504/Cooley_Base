alter table public.profiles
add column if not exists year_level text not null default 'Year 1';

alter table public.profiles
add column if not exists id_card_color text not null default '#B9D9F7';
