-- Wallet system: balances, transactions, top-ups, withdrawals, and job escrow

-- Wallets table: one per user, stores current balance
create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  balance numeric(12, 2) not null default 0.00 check (balance >= 0),
  currency text not null default 'KRW',
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

-- Transactions table: full ledger of all wallet movements
create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.wallets (id) on delete cascade,
  type text not null check (type in ('top_up', 'withdrawal', 'payment', 'earning', 'refund', 'escrow_hold', 'escrow_release')),
  amount numeric(12, 2) not null check (amount > 0),
  balance_after numeric(12, 2) not null,
  description text not null default '',
  reference_id uuid,
  reference_type text check (reference_type in ('listing', 'application', 'withdrawal_request', null)),
  status text not null default 'completed' check (status in ('pending', 'completed', 'failed', 'cancelled')),
  created_at timestamptz not null default timezone('utc'::text, now())
);

-- Withdrawal requests table
create table if not exists public.withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.wallets (id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  bank_name text not null default '',
  account_number text not null default '',
  account_holder text not null default '',
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'rejected')),
  admin_note text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  processed_at timestamptz
);

-- Indexes
create index if not exists wallets_user_id_idx
on public.wallets (user_id);

create index if not exists wallet_transactions_wallet_id_created_at_idx
on public.wallet_transactions (wallet_id, created_at desc);

create index if not exists wallet_transactions_reference_idx
on public.wallet_transactions (reference_id, reference_type);

create index if not exists withdrawal_requests_wallet_id_status_idx
on public.withdrawal_requests (wallet_id, status, created_at desc);

-- Updated_at trigger for wallets
drop trigger if exists wallets_set_updated_at on public.wallets;
create trigger wallets_set_updated_at
before update on public.wallets
for each row
execute function public.set_updated_at();

-- RLS
alter table public.wallets enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.withdrawal_requests enable row level security;

-- Wallet policies: users can only see/manage their own wallet
drop policy if exists "wallets_select_own" on public.wallets;
create policy "wallets_select_own"
on public.wallets
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "wallets_insert_own" on public.wallets;
create policy "wallets_insert_own"
on public.wallets
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "wallets_update_own" on public.wallets;
create policy "wallets_update_own"
on public.wallets
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Transaction policies: users can only see their own transactions
drop policy if exists "wallet_transactions_select_own" on public.wallet_transactions;
create policy "wallet_transactions_select_own"
on public.wallet_transactions
for select
to authenticated
using (
  exists (
    select 1
    from public.wallets as w
    where w.id = wallet_transactions.wallet_id
      and w.user_id = auth.uid()
  )
);

-- Withdrawal request policies
drop policy if exists "withdrawal_requests_select_own" on public.withdrawal_requests;
create policy "withdrawal_requests_select_own"
on public.withdrawal_requests
for select
to authenticated
using (
  exists (
    select 1
    from public.wallets as w
    where w.id = withdrawal_requests.wallet_id
      and w.user_id = auth.uid()
  )
);

drop policy if exists "withdrawal_requests_insert_own" on public.withdrawal_requests;
create policy "withdrawal_requests_insert_own"
on public.withdrawal_requests
for insert
to authenticated
with check (
  exists (
    select 1
    from public.wallets as w
    where w.id = withdrawal_requests.wallet_id
      and w.user_id = auth.uid()
  )
);

-- Function: get or create wallet for current user
drop function if exists public.get_or_create_wallet();
create or replace function public.get_or_create_wallet()
returns table (
  id uuid,
  user_id uuid,
  balance numeric,
  currency text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  wallet_record public.wallets%rowtype;
begin
  if auth.uid() is null then
    raise exception 'You must be logged in to access your wallet.';
  end if;

  select w.*
  into wallet_record
  from public.wallets as w
  where w.user_id = auth.uid();

  if not found then
    insert into public.wallets (user_id)
    values (auth.uid())
    returning *
    into wallet_record;
  end if;

  return query
  select
    wallet_record.id,
    wallet_record.user_id,
    wallet_record.balance,
    wallet_record.currency,
    wallet_record.created_at,
    wallet_record.updated_at;
end;
$$;

revoke all on function public.get_or_create_wallet() from public;
grant execute on function public.get_or_create_wallet() to authenticated;

-- Function: top up wallet
drop function if exists public.top_up_wallet(numeric, text);
create or replace function public.top_up_wallet(
  top_up_amount numeric,
  top_up_description text default 'Wallet top-up'
)
returns table (
  transaction_id uuid,
  wallet_id uuid,
  new_balance numeric,
  amount numeric,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  wallet_record public.wallets%rowtype;
  new_balance_value numeric;
  transaction_record public.wallet_transactions%rowtype;
begin
  if auth.uid() is null then
    raise exception 'You must be logged in to top up your wallet.';
  end if;

  if top_up_amount <= 0 then
    raise exception 'Top-up amount must be greater than zero.';
  end if;

  -- Get or create wallet
  select w.*
  into wallet_record
  from public.wallets as w
  where w.user_id = auth.uid()
  for update;

  if not found then
    insert into public.wallets (user_id)
    values (auth.uid())
    returning *
    into wallet_record;
  end if;

  -- Update balance
  new_balance_value := wallet_record.balance + top_up_amount;

  update public.wallets
  set balance = new_balance_value,
      updated_at = timezone('utc'::text, now())
  where id = wallet_record.id;

  -- Record transaction
  insert into public.wallet_transactions (wallet_id, type, amount, balance_after, description, status)
  values (wallet_record.id, 'top_up', top_up_amount, new_balance_value, coalesce(top_up_description, 'Wallet top-up'), 'completed')
  returning *
  into transaction_record;

  return query
  select
    transaction_record.id,
    wallet_record.id,
    new_balance_value,
    top_up_amount,
    transaction_record.created_at;
end;
$$;

revoke all on function public.top_up_wallet(numeric, text) from public;
grant execute on function public.top_up_wallet(numeric, text) to authenticated;

-- Function: request withdrawal
drop function if exists public.request_withdrawal(numeric, text, text, text);
create or replace function public.request_withdrawal(
  withdrawal_amount numeric,
  p_bank_name text default '',
  p_account_number text default '',
  p_account_holder text default ''
)
returns table (
  request_id uuid,
  wallet_id uuid,
  new_balance numeric,
  amount numeric,
  status text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  wallet_record public.wallets%rowtype;
  new_balance_value numeric;
  transaction_record public.wallet_transactions%rowtype;
  withdrawal_record public.withdrawal_requests%rowtype;
begin
  if auth.uid() is null then
    raise exception 'You must be logged in to withdraw funds.';
  end if;

  if withdrawal_amount <= 0 then
    raise exception 'Withdrawal amount must be greater than zero.';
  end if;

  -- Get wallet with lock
  select w.*
  into wallet_record
  from public.wallets as w
  where w.user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Wallet not found. Please top up first.';
  end if;

  if wallet_record.balance < withdrawal_amount then
    raise exception 'Insufficient balance. Your current balance is %', wallet_record.balance;
  end if;

  -- Deduct balance
  new_balance_value := wallet_record.balance - withdrawal_amount;

  update public.wallets
  set balance = new_balance_value,
      updated_at = timezone('utc'::text, now())
  where id = wallet_record.id;

  -- Create withdrawal request
  insert into public.withdrawal_requests (wallet_id, amount, bank_name, account_number, account_holder)
  values (wallet_record.id, withdrawal_amount, coalesce(p_bank_name, ''), coalesce(p_account_number, ''), coalesce(p_account_holder, ''))
  returning *
  into withdrawal_record;

  -- Record transaction
  insert into public.wallet_transactions (wallet_id, type, amount, balance_after, description, reference_id, reference_type, status)
  values (wallet_record.id, 'withdrawal', withdrawal_amount, new_balance_value, 'Withdrawal to bank account', withdrawal_record.id, 'withdrawal_request', 'pending')
  returning *
  into transaction_record;

  return query
  select
    withdrawal_record.id,
    wallet_record.id,
    new_balance_value,
    withdrawal_amount,
    withdrawal_record.status,
    withdrawal_record.created_at;
end;
$$;

revoke all on function public.request_withdrawal(numeric, text, text, text) from public;
grant execute on function public.request_withdrawal(numeric, text, text, text) to authenticated;

-- Function: pay for a job (escrow hold from poster's wallet)
drop function if exists public.wallet_pay_for_job(uuid);
create or replace function public.wallet_pay_for_job(target_listing_id uuid)
returns table (
  transaction_id uuid,
  wallet_id uuid,
  new_balance numeric,
  amount numeric,
  listing_id uuid,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  wallet_record public.wallets%rowtype;
  target_listing public.listings%rowtype;
  new_balance_value numeric;
  transaction_record public.wallet_transactions%rowtype;
begin
  if auth.uid() is null then
    raise exception 'You must be logged in to pay for a job.';
  end if;

  -- Get listing
  select l.*
  into target_listing
  from public.listings as l
  where l.id = target_listing_id;

  if not found then
    raise exception 'Listing not found.';
  end if;

  if target_listing.owner_id <> auth.uid() then
    raise exception 'Only the job poster can pay for this job.';
  end if;

  -- Get wallet with lock
  select w.*
  into wallet_record
  from public.wallets as w
  where w.user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Wallet not found. Please top up first.';
  end if;

  if wallet_record.balance < target_listing.price then
    raise exception 'Insufficient balance. You need % but have %', target_listing.price, wallet_record.balance;
  end if;

  -- Deduct balance (escrow hold)
  new_balance_value := wallet_record.balance - target_listing.price;

  update public.wallets
  set balance = new_balance_value,
      updated_at = timezone('utc'::text, now())
  where id = wallet_record.id;

  -- Record transaction
  insert into public.wallet_transactions (wallet_id, type, amount, balance_after, description, reference_id, reference_type, status)
  values (wallet_record.id, 'escrow_hold', target_listing.price, new_balance_value, 'Payment held for job: ' || target_listing.title, target_listing.id, 'listing', 'completed')
  returning *
  into transaction_record;

  return query
  select
    transaction_record.id,
    wallet_record.id,
    new_balance_value,
    target_listing.price,
    target_listing.id,
    transaction_record.created_at;
end;
$$;

revoke all on function public.wallet_pay_for_job(uuid) from public;
grant execute on function public.wallet_pay_for_job(uuid) to authenticated;

-- Function: release escrow to worker (called when job is completed)
drop function if exists public.wallet_release_job_payment(uuid, uuid);
create or replace function public.wallet_release_job_payment(
  target_listing_id uuid,
  worker_id uuid
)
returns table (
  transaction_id uuid,
  worker_wallet_id uuid,
  worker_new_balance numeric,
  amount numeric,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_listing public.listings%rowtype;
  worker_wallet public.wallets%rowtype;
  new_balance_value numeric;
  transaction_record public.wallet_transactions%rowtype;
begin
  if auth.uid() is null then
    raise exception 'You must be logged in to release payment.';
  end if;

  -- Get listing
  select l.*
  into target_listing
  from public.listings as l
  where l.id = target_listing_id;

  if not found then
    raise exception 'Listing not found.';
  end if;

  if target_listing.owner_id <> auth.uid() then
    raise exception 'Only the job poster can release payment.';
  end if;

  -- Get or create worker wallet
  select w.*
  into worker_wallet
  from public.wallets as w
  where w.user_id = worker_id
  for update;

  if not found then
    insert into public.wallets (user_id)
    values (worker_id)
    returning *
    into worker_wallet;
  end if;

  -- Credit worker
  new_balance_value := worker_wallet.balance + target_listing.price;

  update public.wallets
  set balance = new_balance_value,
      updated_at = timezone('utc'::text, now())
  where id = worker_wallet.id;

  -- Record earning transaction for worker
  insert into public.wallet_transactions (wallet_id, type, amount, balance_after, description, reference_id, reference_type, status)
  values (worker_wallet.id, 'earning', target_listing.price, new_balance_value, 'Payment received for job: ' || target_listing.title, target_listing.id, 'listing', 'completed')
  returning *
  into transaction_record;

  return query
  select
    transaction_record.id,
    worker_wallet.id,
    new_balance_value,
    target_listing.price,
    transaction_record.created_at;
end;
$$;

revoke all on function public.wallet_release_job_payment(uuid, uuid) from public;
grant execute on function public.wallet_release_job_payment(uuid, uuid) to authenticated;

-- Function: get transaction history
drop function if exists public.get_wallet_transactions(integer, integer);
create or replace function public.get_wallet_transactions(
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid,
  type text,
  amount numeric,
  balance_after numeric,
  description text,
  reference_id uuid,
  reference_type text,
  status text,
  created_at timestamptz
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  wallet_record public.wallets%rowtype;
begin
  if auth.uid() is null then
    raise exception 'You must be logged in to view transactions.';
  end if;

  select w.*
  into wallet_record
  from public.wallets as w
  where w.user_id = auth.uid();

  if not found then
    return;
  end if;

  return query
  select
    wt.id,
    wt.type,
    wt.amount,
    wt.balance_after,
    wt.description,
    wt.reference_id,
    wt.reference_type,
    wt.status,
    wt.created_at
  from public.wallet_transactions as wt
  where wt.wallet_id = wallet_record.id
  order by wt.created_at desc
  limit p_limit
  offset p_offset;
end;
$$;

revoke all on function public.get_wallet_transactions(integer, integer) from public;
grant execute on function public.get_wallet_transactions(integer, integer) to authenticated;

-- Add wallets and wallet_transactions to realtime
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'wallets'
  ) then
    alter publication supabase_realtime add table public.wallets;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'wallet_transactions'
  ) then
    alter publication supabase_realtime add table public.wallet_transactions;
  end if;
end;
$$;
