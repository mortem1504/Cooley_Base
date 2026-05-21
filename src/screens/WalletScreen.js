import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import PriceDisplay from '../components/PriceDisplay';
import useAppState from '../hooks/useAppState';
import { formatAmount } from '../utils/currency';
import { colors, radius, shadow, spacing } from '../utils/theme';

const TRANSACTION_TYPE_LABELS = {
  top_up: 'Top Up',
  withdrawal: 'Withdrawal',
  payment: 'Payment',
  earning: 'Earning',
  refund: 'Refund',
  escrow_hold: 'Payment Held',
  escrow_release: 'Payment Released',
};

const TRANSACTION_TYPE_COLORS = {
  top_up: '#27AE60',
  withdrawal: colors.danger,
  payment: colors.danger,
  earning: '#27AE60',
  refund: '#27AE60',
  escrow_hold: colors.warning,
  escrow_release: '#27AE60',
};

function isCredit(type) {
  return ['top_up', 'earning', 'refund', 'escrow_release'].includes(type);
}

function formatDate(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function TransactionItem({ transaction }) {
  const typeLabel = TRANSACTION_TYPE_LABELS[transaction.type] || transaction.type;
  const typeColor = TRANSACTION_TYPE_COLORS[transaction.type] || colors.text;
  const credit = isCredit(transaction.type);
  const sign = credit ? '+' : '-';

  return (
    <View style={styles.transactionItem}>
      <View style={styles.transactionLeft}>
        <View style={[styles.transactionDot, { backgroundColor: typeColor }]} />
        <View style={styles.transactionInfo}>
          <Text style={styles.transactionType}>{typeLabel}</Text>
          <Text style={styles.transactionDesc} numberOfLines={1}>
            {transaction.description || typeLabel}
          </Text>
          <Text style={styles.transactionDate}>{formatDate(transaction.createdAt)}</Text>
        </View>
      </View>
      <PriceDisplay
        amount={transaction.amount}
        currency="KRW"
        size="sm"
        align="right"
        priceStyle={{ color: typeColor }}
        estimateStyle={styles.transactionEstimate}
      />
    </View>
  );
}

export default function WalletScreen({ navigation }) {
  const {
    wallet,
    walletTransactions,
    isWalletLoading,
    walletNotice,
    loadWallet,
    loadWalletTransactions,
    preferredCurrency,
    changePreferredCurrency,
    currencyList,
  } = useAppState();

  const [refreshing, setRefreshing] = useState(false);
  const [isCurrencyModalVisible, setIsCurrencyModalVisible] = useState(false);

  useEffect(() => {
    loadWallet().catch(() => {});
    loadWalletTransactions().catch(() => {});
  }, []);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          hitSlop={12}
          onPress={() => setIsCurrencyModalVisible(true)}
          style={styles.currencyButton}
        >
          <Text style={styles.currencyButtonText}>{preferredCurrency}</Text>
        </Pressable>
      ),
    });
  }, [navigation, preferredCurrency]);

  const handleSelectCurrency = async (code) => {
    await changePreferredCurrency(code);
    setIsCurrencyModalVisible(false);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadWallet(), loadWalletTransactions()]);
    } catch (_) {}
    setRefreshing(false);
  }, []);

  const renderTransaction = useCallback(({ item }) => (
    <TransactionItem transaction={item} />
  ), []);

  const keyExtractor = useCallback((item) => item.id, []);

  const balance = wallet?.balance ?? 0;

  const ListHeader = () => (
    <View style={styles.headerSection}>
      {/* Balance Card */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Available Balance</Text>
        <PriceDisplay
          amount={balance}
          currency="KRW"
          size="lg"
          align="center"
          priceStyle={styles.balanceAmount}
        />
        {walletNotice ? (
          <Text style={styles.noticeText}>{walletNotice}</Text>
        ) : null}

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <Pressable
            style={[styles.actionButton, styles.topUpButton]}
            onPress={() => navigation.navigate('TopUp')}
          >
            <Text style={styles.actionButtonText}>Top Up</Text>
          </Pressable>
          <Pressable
            style={[styles.actionButton, styles.withdrawButton]}
            onPress={() => navigation.navigate('Withdraw')}
          >
            <Text style={styles.withdrawButtonText}>Withdraw</Text>
          </Pressable>
        </View>
      </View>

      {/* Transactions Header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Transactions</Text>
        {walletTransactions.length > 0 && (
          <Pressable onPress={() => navigation.navigate('TransactionHistory')}>
            <Text style={styles.seeAllText}>See all</Text>
          </Pressable>
        )}
      </View>
    </View>
  );

  const ListEmpty = () => (
    <View style={styles.emptyContainer}>
      {isWalletLoading ? (
        <ActivityIndicator color={colors.primary} size="large" />
      ) : (
        <>
          <Text style={styles.emptyTitle}>No transactions yet</Text>
          <Text style={styles.emptySubtitle}>
            Top up your wallet to start paying for jobs or receiving earnings.
          </Text>
        </>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        contentContainerStyle={styles.listContent}
        data={walletTransactions.slice(0, 10)}
        keyExtractor={keyExtractor}
        ListEmptyComponent={ListEmpty}
        ListHeaderComponent={ListHeader}
        refreshControl={
          <RefreshControl
            colors={[colors.primary]}
            onRefresh={onRefresh}
            refreshing={refreshing}
            tintColor={colors.primary}
          />
        }
        renderItem={renderTransaction}
        showsVerticalScrollIndicator={false}
      />

      {/* Currency Selector Modal */}
      <Modal
        animationType="fade"
        onRequestClose={() => setIsCurrencyModalVisible(false)}
        transparent
        visible={isCurrencyModalVisible}
      >
        <Pressable
          onPress={() => setIsCurrencyModalVisible(false)}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Currency</Text>
            <Text style={styles.modalSubtitle}>
              Prices will show the original amount with an estimated conversion to your preferred currency.
            </Text>
            {currencyList.map((currency) => (
              <Pressable
                key={currency.code}
                onPress={() => handleSelectCurrency(currency.code)}
                style={[
                  styles.currencyOption,
                  preferredCurrency === currency.code && styles.currencyOptionActive,
                ]}
              >
                <Text style={styles.currencySymbol}>{currency.symbol}</Text>
                <View style={styles.currencyInfo}>
                  <Text style={styles.currencyCode}>{currency.code}</Text>
                  <Text style={styles.currencyLabel}>{currency.label}</Text>
                </View>
                {preferredCurrency === currency.code && (
                  <Text style={styles.currencyCheck}>✓</Text>
                )}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
  },
  listContent: {
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.md,
  },
  headerSection: {
    gap: spacing.lg,
    paddingTop: spacing.lg,
  },
  balanceCard: {
    ...shadow,
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
  },
  balanceLabel: {
    color: colors.subtleText,
    fontSize: 14,
    fontWeight: '600',
  },
  balanceAmount: {
    color: colors.text,
    fontSize: 36,
    fontWeight: '800',
  },
  noticeText: {
    color: colors.danger,
    fontSize: 13,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
    width: '100%',
  },
  actionButton: {
    alignItems: 'center',
    borderRadius: radius.sm,
    flex: 1,
    paddingVertical: spacing.sm,
  },
  topUpButton: {
    backgroundColor: colors.primary,
  },
  actionButtonText: {
    color: colors.card,
    fontSize: 15,
    fontWeight: '700',
  },
  withdrawButton: {
    backgroundColor: colors.primarySoft,
  },
  withdrawButtonText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  seeAllText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  transactionItem: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  transactionLeft: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  transactionDot: {
    borderRadius: 999,
    height: 10,
    width: 10,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionType: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  transactionDesc: {
    color: colors.subtleText,
    fontSize: 12,
    marginTop: 2,
  },
  transactionDate: {
    color: colors.subtleText,
    fontSize: 11,
    marginTop: 2,
  },
  transactionAmount: {
    fontSize: 14,
    fontWeight: '700',
    marginLeft: spacing.sm,
  },
  transactionEstimate: {
    fontSize: 11,
    color: colors.subtleText,
    fontWeight: '600',
    marginTop: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: spacing.xxl,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  emptySubtitle: {
    color: colors.subtleText,
    fontSize: 13,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  currencyButton: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  currencyButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  modalOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    maxWidth: 340,
    padding: spacing.xl,
    width: '100%',
  },
  modalTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  modalSubtitle: {
    color: colors.subtleText,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: spacing.md,
    marginTop: spacing.xs,
  },
  currencyOption: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  currencyOptionActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  currencySymbol: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    minWidth: 30,
  },
  currencyInfo: {
    flex: 1,
  },
  currencyCode: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  currencyLabel: {
    color: colors.subtleText,
    fontSize: 12,
    marginTop: 1,
  },
  currencyCheck: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '800',
  },
});
