import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import PriceDisplay from '../components/PriceDisplay';
import useAppState from '../hooks/useAppState';
import { colors, radius, spacing } from '../utils/theme';

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

function formatFullDate(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function TransactionItem({ transaction }) {
  const typeLabel = TRANSACTION_TYPE_LABELS[transaction.type] || transaction.type;
  const typeColor = TRANSACTION_TYPE_COLORS[transaction.type] || colors.text;
  const credit = isCredit(transaction.type);
  const sign = credit ? '+' : '-';

  return (
    <View style={styles.transactionItem}>
      <View style={styles.transactionHeader}>
        <View style={styles.transactionLeft}>
          <View style={[styles.transactionDot, { backgroundColor: typeColor }]} />
          <Text style={styles.transactionType}>{typeLabel}</Text>
        </View>
        <PriceDisplay
          amount={transaction.amount}
          currency="KRW"
          size="sm"
          align="right"
          priceStyle={{ color: typeColor }}
        />
      </View>
      <Text style={styles.transactionDesc} numberOfLines={2}>
        {transaction.description || typeLabel}
      </Text>
      <View style={styles.transactionFooter}>
        <Text style={styles.transactionDate}>{formatFullDate(transaction.createdAt)}</Text>
        <PriceDisplay
          amount={transaction.balanceAfter}
          currency="KRW"
          size="sm"
          align="right"
          priceStyle={styles.transactionBalance}
          estimateStyle={styles.transactionBalanceEstimate}
        />
      </View>
      {transaction.status !== 'completed' && (
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>{transaction.status}</Text>
        </View>
      )}
    </View>
  );
}

export default function TransactionHistoryScreen() {
  const { walletTransactions, loadWalletTransactions } = useAppState();
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadWalletTransactions(100, 0)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadWalletTransactions(100, 0);
    } catch (_) {}
    setRefreshing(false);
  }, []);

  const renderTransaction = useCallback(({ item }) => (
    <TransactionItem transaction={item} />
  ), []);

  const keyExtractor = useCallback((item) => item.id, []);

  const ListEmpty = () => (
    <View style={styles.emptyContainer}>
      {isLoading ? (
        <ActivityIndicator color={colors.primary} size="large" />
      ) : (
        <>
          <Text style={styles.emptyTitle}>No transactions</Text>
          <Text style={styles.emptySubtitle}>
            Your transaction history will appear here once you start using your wallet.
          </Text>
        </>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        contentContainerStyle={styles.listContent}
        data={walletTransactions}
        keyExtractor={keyExtractor}
        ListEmptyComponent={ListEmpty}
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
    paddingTop: spacing.md,
  },
  transactionItem: {
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  transactionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  transactionLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  transactionDot: {
    borderRadius: 999,
    height: 10,
    width: 10,
  },
  transactionType: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  transactionAmount: {
    fontSize: 15,
    fontWeight: '700',
  },
  transactionDesc: {
    color: colors.secondaryText,
    fontSize: 13,
    marginTop: spacing.xs,
    paddingLeft: 18,
  },
  transactionFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
    paddingLeft: 18,
  },
  transactionDate: {
    color: colors.subtleText,
    fontSize: 12,
  },
  transactionBalance: {
    color: colors.subtleText,
    fontSize: 12,
  },
  transactionBalanceEstimate: {
    color: colors.subtleText,
    fontSize: 10,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.warning + '20',
    borderRadius: radius.pill,
    marginLeft: 18,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  statusText: {
    color: colors.warning,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: spacing.xxl * 2,
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
});
