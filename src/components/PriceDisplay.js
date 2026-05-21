import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { convertCurrency, formatAmount, getAppCurrency } from '../utils/currency';
import { colors } from '../utils/theme';

/**
 * Displays a price with an optional estimated conversion below it.
 * When the price currency differs from the app's preferred currency,
 * the estimation is shown underneath in smaller gray text.
 *
 * Props:
 *   amount       - numeric price value
 *   currency     - the currency the price is stored in (e.g. 'USD', 'KRW')
 *   suffix       - optional suffix like '/day'
 *   size         - 'sm' | 'md' | 'lg' (controls font size)
 *   align        - 'left' | 'center' | 'right'
 *   priceStyle   - override style for the main price text
 *   estimateStyle - override style for the estimate text
 */
export default function PriceDisplay({
  amount,
  currency = 'USD',
  suffix = '',
  size = 'md',
  align = 'left',
  priceStyle,
  estimateStyle,
}) {
  const appCurrency = getAppCurrency();
  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount)) {
    return (
      <View style={[styles.container, alignStyles[align]]}>
        <Text style={[styles.price, sizeStyles[size], priceStyle]}>
          {formatAmount(0, currency)}{suffix}
        </Text>
      </View>
    );
  }

  const formattedPrice = `${formatAmount(numericAmount, currency)}${suffix}`;
  const showEstimate = currency !== appCurrency && numericAmount > 0;

  let formattedEstimate = '';
  if (showEstimate) {
    const convertedAmount = convertCurrency(numericAmount, currency, appCurrency);
    formattedEstimate = `~${formatAmount(convertedAmount, appCurrency)}${suffix}`;
  }

  return (
    <View style={[styles.container, alignStyles[align]]}>
      <Text style={[styles.price, sizeStyles[size], priceStyle]}>
        {formattedPrice}
      </Text>
      {showEstimate && (
        <Text style={[styles.estimate, estimateSizeStyles[size], estimateStyle]}>
          {formattedEstimate}
        </Text>
      )}
    </View>
  );
}

const alignStyles = {
  left: { alignItems: 'flex-start' },
  center: { alignItems: 'center' },
  right: { alignItems: 'flex-end' },
};

const sizeStyles = {
  sm: { fontSize: 14 },
  md: { fontSize: 18 },
  lg: { fontSize: 28 },
};

const estimateSizeStyles = {
  sm: { fontSize: 11 },
  md: { fontSize: 13 },
  lg: { fontSize: 15 },
};

const styles = StyleSheet.create({
  container: {
    flexShrink: 1,
  },
  price: {
    color: colors.text,
    fontWeight: '800',
  },
  estimate: {
    color: colors.subtleText,
    fontWeight: '600',
    marginTop: 2,
  },
});
