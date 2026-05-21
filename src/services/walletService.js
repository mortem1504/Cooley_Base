import { getSupabaseClient } from './supabaseClient';

/**
 * Get or create the current user's wallet.
 */
export async function getOrCreateWallet() {
  const client = getSupabaseClient();

  const { data, error } = await client.rpc('get_or_create_wallet');

  if (error) {
    throw new Error(error.message || 'Failed to load wallet.');
  }

  const row = Array.isArray(data) ? data[0] : data;

  if (!row) {
    throw new Error('Wallet could not be created.');
  }

  return mapWalletRow(row);
}

/**
 * Top up the current user's wallet.
 */
export async function topUpWallet(amount, description = 'Wallet top-up') {
  const client = getSupabaseClient();

  const { data, error } = await client.rpc('top_up_wallet', {
    top_up_amount: amount,
    top_up_description: description,
  });

  if (error) {
    throw new Error(error.message || 'Top-up failed.');
  }

  const row = Array.isArray(data) ? data[0] : data;

  if (!row) {
    throw new Error('Top-up could not be processed.');
  }

  return {
    transactionId: row.transaction_id,
    walletId: row.wallet_id,
    newBalance: parseFloat(row.new_balance),
    amount: parseFloat(row.amount),
    createdAt: new Date(row.created_at).getTime(),
  };
}

/**
 * Request a withdrawal from the wallet.
 */
export async function requestWithdrawal({ amount, bankName, accountNumber, accountHolder }) {
  const client = getSupabaseClient();

  const { data, error } = await client.rpc('request_withdrawal', {
    withdrawal_amount: amount,
    p_bank_name: bankName || '',
    p_account_number: accountNumber || '',
    p_account_holder: accountHolder || '',
  });

  if (error) {
    throw new Error(error.message || 'Withdrawal request failed.');
  }

  const row = Array.isArray(data) ? data[0] : data;

  if (!row) {
    throw new Error('Withdrawal could not be processed.');
  }

  return {
    requestId: row.request_id,
    walletId: row.wallet_id,
    newBalance: parseFloat(row.new_balance),
    amount: parseFloat(row.amount),
    status: row.status,
    createdAt: new Date(row.created_at).getTime(),
  };
}

/**
 * Pay for a job listing (escrow hold).
 */
export async function payForJob(listingId) {
  const client = getSupabaseClient();

  const { data, error } = await client.rpc('wallet_pay_for_job', {
    target_listing_id: listingId,
  });

  if (error) {
    throw new Error(error.message || 'Payment failed.');
  }

  const row = Array.isArray(data) ? data[0] : data;

  if (!row) {
    throw new Error('Payment could not be processed.');
  }

  return {
    transactionId: row.transaction_id,
    walletId: row.wallet_id,
    newBalance: parseFloat(row.new_balance),
    amount: parseFloat(row.amount),
    listingId: row.listing_id,
    createdAt: new Date(row.created_at).getTime(),
  };
}

/**
 * Release escrow payment to a worker when job is completed.
 */
export async function releaseJobPayment(listingId, workerId) {
  const client = getSupabaseClient();

  const { data, error } = await client.rpc('wallet_release_job_payment', {
    target_listing_id: listingId,
    worker_id: workerId,
  });

  if (error) {
    throw new Error(error.message || 'Payment release failed.');
  }

  const row = Array.isArray(data) ? data[0] : data;

  if (!row) {
    throw new Error('Payment release could not be processed.');
  }

  return {
    transactionId: row.transaction_id,
    workerWalletId: row.worker_wallet_id,
    workerNewBalance: parseFloat(row.worker_new_balance),
    amount: parseFloat(row.amount),
    createdAt: new Date(row.created_at).getTime(),
  };
}

/**
 * Fetch transaction history for the current user.
 */
export async function fetchWalletTransactions(limit = 50, offset = 0) {
  const client = getSupabaseClient();

  const { data, error } = await client.rpc('get_wallet_transactions', {
    p_limit: limit,
    p_offset: offset,
  });

  if (error) {
    throw new Error(error.message || 'Failed to load transactions.');
  }

  if (!data || !Array.isArray(data)) {
    return [];
  }

  return data.map(mapTransactionRow);
}

// --- Mappers ---

function mapWalletRow(row) {
  return {
    id: row.id,
    userId: row.user_id,
    balance: parseFloat(row.balance),
    currency: row.currency,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

function mapTransactionRow(row) {
  return {
    id: row.id,
    type: row.type,
    amount: parseFloat(row.amount),
    balanceAfter: parseFloat(row.balance_after),
    description: row.description,
    referenceId: row.reference_id,
    referenceType: row.reference_type,
    status: row.status,
    createdAt: new Date(row.created_at).getTime(),
  };
}
