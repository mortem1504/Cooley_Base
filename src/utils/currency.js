/**
 * Currency utility for multi-currency support.
 * Handles formatting and estimated conversion between USD, KRW, and MYR (RM).
 *
 * The app's base display currency can be set via `setAppCurrency()`.
 * When a price is in a different currency than the app setting,
 * it shows the original price with an estimated conversion.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const CURRENCY_STORAGE_KEY = '@cooley_preferred_currency';

// Supported currencies
export const CURRENCIES = {
  USD: 'USD',
  KRW: 'KRW',
  MYR: 'MYR',
};

export const CURRENCY_LIST = [
  { code: 'USD', symbol: '$', label: 'US Dollar' },
  { code: 'KRW', symbol: '₩', label: 'Korean Won' },
  { code: 'MYR', symbol: 'RM', label: 'Malaysian Ringgit' },
];

// Currency symbols
const CURRENCY_SYMBOLS = {
  USD: '$',
  KRW: '₩',
  MYR: 'RM',
};

// Approximate exchange rates (base: USD)
// These are estimates — in production, fetch live rates from an API.
const EXCHANGE_RATES_FROM_USD = {
  USD: 1,
  KRW: 1380,
  MYR: 4.65,
};

// Default app currency
let appCurrency = CURRENCIES.KRW;

/**
 * Set the app's display currency and persist it.
 * @param {'USD' | 'KRW' | 'MYR'} currency
 */
export async function setAppCurrency(currency) {
  if (CURRENCIES[currency]) {
    appCurrency = currency;
    try {
      await AsyncStorage.setItem(CURRENCY_STORAGE_KEY, currency);
    } catch (_) {
      // Silently fail on storage error
    }
  }
}

/**
 * Load the persisted currency preference from storage.
 * Call this on app startup.
 * @returns {Promise<string>} The loaded currency code
 */
export async function loadAppCurrency() {
  try {
    const stored = await AsyncStorage.getItem(CURRENCY_STORAGE_KEY);
    if (stored && CURRENCIES[stored]) {
      appCurrency = stored;
    }
  } catch (_) {
    // Silently fail, use default
  }
  return appCurrency;
}

/**
 * Get the current app display currency.
 * @returns {'USD' | 'KRW' | 'MYR'}
 */
export function getAppCurrency() {
  return appCurrency;
}

/**
 * Convert an amount from one currency to another using estimated rates.
 * @param {number} amount
 * @param {string} fromCurrency
 * @param {string} toCurrency
 * @returns {number}
 */
export function convertCurrency(amount, fromCurrency, toCurrency) {
  if (fromCurrency === toCurrency) {
    return amount;
  }

  const fromRate = EXCHANGE_RATES_FROM_USD[fromCurrency] || 1;
  const toRate = EXCHANGE_RATES_FROM_USD[toCurrency] || 1;

  // Convert to USD first, then to target
  const amountInUsd = amount / fromRate;
  return amountInUsd * toRate;
}

/**
 * Format an amount in a specific currency with proper symbol and decimals.
 * @param {number} amount
 * @param {string} currency - 'USD', 'KRW', or 'MYR'
 * @returns {string}
 */
export function formatAmount(amount, currency) {
  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount)) {
    return `${CURRENCY_SYMBOLS[currency] || ''}0`;
  }

  const symbol = CURRENCY_SYMBOLS[currency] || currency + ' ';

  switch (currency) {
    case CURRENCIES.KRW:
      // KRW has no decimal places
      return `${symbol}${Math.round(numericAmount).toLocaleString()}`;
    case CURRENCIES.MYR:
      return `${symbol}${numericAmount.toFixed(2)}`;
    case CURRENCIES.USD:
    default:
      return `$${numericAmount.toFixed(2)}`;
  }
}

/**
 * Format a price for display. If the price currency differs from the app currency,
 * shows the original price with an estimated conversion.
 *
 * Examples:
 *   - App set to KRW, price is USD 50:
 *     "$50.00 (~₩69,000)"
 *   - App set to KRW, price is KRW 50000:
 *     "₩50,000"
 *   - App set to USD, price is KRW 69000:
 *     "₩69,000 (~$50.00)"
 *   - App set to MYR, price is USD 50:
 *     "$50.00 (~RM232.50)"
 *
 * @param {number} amount - The price amount
 * @param {string} [priceCurrency='USD'] - The currency the price is stored in
 * @param {object} [options]
 * @param {string} [options.displayCurrency] - Override the app currency for this call
 * @param {boolean} [options.showEstimate=true] - Whether to show the conversion estimate
 * @param {string} [options.suffix] - Optional suffix like '/day'
 * @returns {string}
 */
export function formatPriceWithConversion(amount, priceCurrency = 'USD', options = {}) {
  const {
    displayCurrency = appCurrency,
    showEstimate = true,
    suffix = '',
  } = options;

  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount) || numericAmount === 0) {
    return `${formatAmount(0, displayCurrency)}${suffix}`;
  }

  const originalFormatted = formatAmount(numericAmount, priceCurrency);

  // Same currency — just show the formatted amount
  if (priceCurrency === displayCurrency || !showEstimate) {
    return `${originalFormatted}${suffix}`;
  }

  // Different currency — show original + estimated conversion
  const convertedAmount = convertCurrency(numericAmount, priceCurrency, displayCurrency);
  const convertedFormatted = formatAmount(convertedAmount, displayCurrency);

  return `${originalFormatted}${suffix} (~${convertedFormatted}${suffix})`;
}

/**
 * Simple format for the app's current currency (no conversion needed).
 * Use this when the amount is already in the app's display currency.
 * @param {number} amount
 * @param {object} [options]
 * @param {string} [options.currency] - Override currency
 * @param {string} [options.suffix] - Optional suffix
 * @returns {string}
 */
export function formatAppCurrency(amount, options = {}) {
  const { currency = appCurrency, suffix = '' } = options;
  return `${formatAmount(amount, currency)}${suffix}`;
}

/**
 * Get the exchange rate between two currencies.
 * @param {string} fromCurrency
 * @param {string} toCurrency
 * @returns {number}
 */
export function getExchangeRate(fromCurrency, toCurrency) {
  if (fromCurrency === toCurrency) {
    return 1;
  }

  const fromRate = EXCHANGE_RATES_FROM_USD[fromCurrency] || 1;
  const toRate = EXCHANGE_RATES_FROM_USD[toCurrency] || 1;

  return toRate / fromRate;
}

/**
 * Update exchange rates (call this with live data from an API if available).
 * @param {object} rates - Object with currency codes as keys and USD-based rates as values
 */
export function updateExchangeRates(rates) {
  if (rates && typeof rates === 'object') {
    Object.keys(rates).forEach((currency) => {
      if (CURRENCIES[currency] && typeof rates[currency] === 'number') {
        EXCHANGE_RATES_FROM_USD[currency] = rates[currency];
      }
    });
  }
}
