create or replace function public.is_thread_member(
  p_thread_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.thread_members as tm
    where tm.thread_id = p_thread_id
      and tm.user_id = coalesce(p_user_id, auth.uid())
  );
$$;

revoke all on function public.is_thread_member(uuid, uuid) from public;
grant execute on function public.is_thread_member(uuid, uuid) to authenticated;

drop policy if exists "threads_select_member" on public.threads;
create policy "threads_select_member"
on public.threads
for select
to authenticated
using (public.is_thread_member(id, auth.uid()));

drop policy if exists "thread_members_select_member" on public.thread_members;
create policy "thread_members_select_member"
on public.thread_members
for select
to authenticated
using (public.is_thread_member(thread_id, auth.uid()));

drop policy if exists "messages_select_member" on public.messages;
create policy "messages_select_member"
on public.messages
for select
to authenticated
using (public.is_thread_member(thread_id, auth.uid()));

drop policy if exists "messages_insert_sender_member" on public.messages;
create policy "messages_insert_sender_member"
on public.messages
for insert
to authenticated
with check (
  auth.uid() = sender_id
  and public.is_thread_member(thread_id, auth.uid())
);
