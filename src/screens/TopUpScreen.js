import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import PriceDisplay from '../components/PriceDisplay';
import useAppState from '../hooks/useAppState';
import { formatAmount } from '../utils/currency';
import { colors, radius, shadow, spacing } from '../utils/theme';

const PRESET_AMOUNTS = [5000, 10000, 20000, 50000, 100000];

export default function TopUpScreen({ navigation }) {
  const { wallet, topUpWallet } = useAppState();
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [notice, setNotice] = useState('');

  const numericAmount = parseFloat(amount) || 0;
  const isValid = numericAmount > 0;

  const handlePresetPress = (preset) => {
    setAmount(String(preset));
    setNotice('');
  };

  const handleTopUp = async () => {
    if (!isValid) {
      setNotice('Please enter a valid amount.');
      return;
    }

    setIsLoading(true);
    setNotice('');

    try {
      await topUpWallet(numericAmount);
      Alert.alert(
        'Top Up Successful',
        `${formatAmount(numericAmount, 'KRW')} has been added to your wallet.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      setNotice(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Current Balance */}
        <View style={styles.balanceRow}>
          <Text style={styles.balanceLabel}>Current Balance</Text>
          <PriceDisplay
            amount={wallet?.balance ?? 0}
            currency="KRW"
            size="sm"
            align="right"
          />
        </View>

        {/* Amount Input */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>Top-up Amount (KRW)</Text>
          <View style={styles.inputWrapper}>
            <Text style={styles.currencyPrefix}>₩</Text>
            <TextInput
              autoFocus
              keyboardType="numeric"
              onChangeText={(text) => {
                setAmount(text.replace(/[^0-9]/g, ''));
                setNotice('');
              }}
              placeholder="0"
              placeholderTextColor={colors.subtleText}
              style={styles.amountInput}
              value={amount}
            />
          </View>
        </View>

        {/* Preset Amounts */}
        <View style={styles.presetSection}>
          <Text style={styles.presetLabel}>Quick select</Text>
          <View style={styles.presetRow}>
            {PRESET_AMOUNTS.map((preset) => (
              <Pressable
                key={preset}
                onPress={() => handlePresetPress(preset)}
                style={[
                  styles.presetChip,
                  numericAmount === preset && styles.presetChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.presetChipText,
                    numericAmount === preset && styles.presetChipTextActive,
                  ]}
                >
                  {formatAmount(preset, 'KRW')}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Notice */}
        {notice ? <Text style={styles.noticeText}>{notice}</Text> : null}

        {/* Summary */}
        {isValid && (
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Top-up amount</Text>
              <PriceDisplay amount={numericAmount} currency="KRW" size="sm" align="right" />
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>New balance</Text>
              <PriceDisplay
                amount={(wallet?.balance ?? 0) + numericAmount}
                currency="KRW"
                size="sm"
                align="right"
                priceStyle={styles.summaryValueBold}
              />
            </View>
          </View>
        )}

        {/* Confirm Button */}
        <Pressable
          disabled={!isValid || isLoading}
          onPress={handleTopUp}
          style={[styles.confirmButton, (!isValid || isLoading) && styles.confirmButtonDisabled]}
        >
          {isLoading ? (
            <ActivityIndicator color={colors.card} size="small" />
          ) : (
            <Text style={styles.confirmButtonText}>
              {isValid ? `Top Up ${formatAmount(numericAmount, 'KRW')}` : 'Enter Amount'}
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
  },
  balanceRow: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  balanceLabel: {
    color: colors.secondaryText,
    fontSize: 14,
    fontWeight: '600',
  },
  balanceValue: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  inputSection: {
    marginTop: spacing.lg,
  },
  inputLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  inputWrapper: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
  },
  currencyPrefix: {
    color: colors.subtleText,
    fontSize: 20,
    fontWeight: '700',
    marginRight: spacing.xs,
  },
  amountInput: {
    color: colors.text,
    flex: 1,
    fontSize: 24,
    fontWeight: '700',
    paddingVertical: spacing.md,
  },
  presetSection: {
    marginTop: spacing.lg,
  },
  presetLabel: {
    color: colors.subtleText,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  presetChip: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  presetChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  presetChipText: {
    color: colors.secondaryText,
    fontSize: 13,
    fontWeight: '600',
  },
  presetChipTextActive: {
    color: colors.card,
  },
  noticeText: {
    color: colors.danger,
    fontSize: 13,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  summaryCard: {
    ...shadow,
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  summaryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  summaryLabel: {
    color: colors.subtleText,
    fontSize: 14,
  },
  summaryValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  summaryValueBold: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  divider: {
    backgroundColor: colors.border,
    height: 1,
    marginVertical: spacing.xs,
  },
  confirmButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    marginTop: spacing.xl,
    paddingVertical: spacing.md,
  },
  confirmButtonDisabled: {
    opacity: 0.5,
  },
  confirmButtonText: {
    color: colors.card,
    fontSize: 16,
    fontWeight: '700',
  },
});
