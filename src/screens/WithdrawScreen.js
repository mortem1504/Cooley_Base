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

export default function WithdrawScreen({ navigation }) {
  const { wallet, withdrawFromWallet } = useAppState();
  const [amount, setAmount] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [notice, setNotice] = useState('');

  const balance = wallet?.balance ?? 0;
  const numericAmount = parseFloat(amount) || 0;
  const isValid = numericAmount > 0 && numericAmount <= balance && bankName.trim() && accountNumber.trim() && accountHolder.trim();

  const handleWithdrawAll = () => {
    setAmount(String(Math.floor(balance)));
    setNotice('');
  };

  const handleWithdraw = async () => {
    if (numericAmount <= 0) {
      setNotice('Please enter a valid amount.');
      return;
    }

    if (numericAmount > balance) {
      setNotice('Insufficient balance.');
      return;
    }

    if (!bankName.trim() || !accountNumber.trim() || !accountHolder.trim()) {
      setNotice('Please fill in all bank details.');
      return;
    }

    setIsLoading(true);
    setNotice('');

    try {
      await withdrawFromWallet({
        amount: numericAmount,
        bankName: bankName.trim(),
        accountNumber: accountNumber.trim(),
        accountHolder: accountHolder.trim(),
      });
      Alert.alert(
        'Withdrawal Requested',
        `Your withdrawal of ${formatAmount(numericAmount, 'KRW')} is being processed. It may take 1-3 business days.`,
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
          <Text style={styles.balanceLabel}>Available Balance</Text>
          <PriceDisplay
            amount={balance}
            currency="KRW"
            size="sm"
            align="right"
          />
        </View>

        {/* Amount Input */}
        <View style={styles.inputSection}>
          <View style={styles.inputLabelRow}>
            <Text style={styles.inputLabel}>Withdrawal Amount (KRW)</Text>
            <Pressable onPress={handleWithdrawAll}>
              <Text style={styles.withdrawAllText}>Withdraw all</Text>
            </Pressable>
          </View>
          <View style={styles.inputWrapper}>
            <Text style={styles.currencyPrefix}>₩</Text>
            <TextInput
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

        {/* Bank Details */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>Bank Name</Text>
          <TextInput
            onChangeText={(text) => {
              setBankName(text);
              setNotice('');
            }}
            placeholder="e.g. KB Kookmin, Shinhan, Woori"
            placeholderTextColor={colors.subtleText}
            style={styles.textInput}
            value={bankName}
          />
        </View>

        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>Account Number</Text>
          <TextInput
            keyboardType="numeric"
            onChangeText={(text) => {
              setAccountNumber(text.replace(/[^0-9-]/g, ''));
              setNotice('');
            }}
            placeholder="Enter your account number"
            placeholderTextColor={colors.subtleText}
            style={styles.textInput}
            value={accountNumber}
          />
        </View>

        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>Account Holder Name</Text>
          <TextInput
            onChangeText={(text) => {
              setAccountHolder(text);
              setNotice('');
            }}
            placeholder="Name on the bank account"
            placeholderTextColor={colors.subtleText}
            style={styles.textInput}
            value={accountHolder}
          />
        </View>

        {/* Notice */}
        {notice ? <Text style={styles.noticeText}>{notice}</Text> : null}

        {/* Summary */}
        {numericAmount > 0 && numericAmount <= balance && (
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Withdrawal amount</Text>
              <PriceDisplay amount={numericAmount} currency="KRW" size="sm" align="right" />
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Remaining balance</Text>
              <PriceDisplay
                amount={balance - numericAmount}
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
          onPress={handleWithdraw}
          style={[styles.confirmButton, (!isValid || isLoading) && styles.confirmButtonDisabled]}
        >
          {isLoading ? (
            <ActivityIndicator color={colors.card} size="small" />
          ) : (
            <Text style={styles.confirmButtonText}>
              {isValid ? `Withdraw ${formatAmount(numericAmount, 'KRW')}` : 'Fill in Details'}
            </Text>
          )}
        </Pressable>

        <Text style={styles.disclaimerText}>
          Withdrawals are processed within 1-3 business days. Ensure your bank details are correct.
        </Text>
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
  inputLabelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  inputLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  withdrawAllText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
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
  textInput: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
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
    backgroundColor: colors.danger,
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
  disclaimerText: {
    color: colors.subtleText,
    fontSize: 12,
    marginTop: spacing.md,
    textAlign: 'center',
  },
});
