import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SidebarMenuButton from '../components/SidebarMenuButton';
import TopUpScreen from '../screens/TopUpScreen';
import TransactionHistoryScreen from '../screens/TransactionHistoryScreen';
import WalletScreen from '../screens/WalletScreen';
import WithdrawScreen from '../screens/WithdrawScreen';
import { colors } from '../utils/theme';
import { useMainShell } from './MainShellContext';
import { WALLET_ROUTES } from './routes';

const Stack = createNativeStackNavigator();

const screenOptions = {
  contentStyle: { backgroundColor: colors.background },
  headerShadowVisible: false,
  headerStyle: { backgroundColor: colors.background },
  headerTitleStyle: { color: colors.text, fontSize: 18, fontWeight: '700' },
};

export default function WalletNavigator() {
  const { openSidebar } = useMainShell();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        component={WalletScreen}
        name={WALLET_ROUTES.HOME}
        options={{
          title: 'Wallet',
          headerLeft: () => <SidebarMenuButton onPress={openSidebar} />,
        }}
      />
      <Stack.Screen
        component={TopUpScreen}
        name={WALLET_ROUTES.TOP_UP}
        options={({ navigation }) => ({
          title: 'Top Up',
          headerLeft: () => (
            <Pressable hitSlop={12} onPress={() => navigation.goBack()}>
              <Text style={styles.backText}>Back</Text>
            </Pressable>
          ),
        })}
      />
      <Stack.Screen
        component={WithdrawScreen}
        name={WALLET_ROUTES.WITHDRAW}
        options={({ navigation }) => ({
          title: 'Withdraw',
          headerLeft: () => (
            <Pressable hitSlop={12} onPress={() => navigation.goBack()}>
              <Text style={styles.backText}>Back</Text>
            </Pressable>
          ),
        })}
      />
      <Stack.Screen
        component={TransactionHistoryScreen}
        name={WALLET_ROUTES.TRANSACTION_HISTORY}
        options={({ navigation }) => ({
          title: 'Transaction History',
          headerLeft: () => (
            <Pressable hitSlop={12} onPress={() => navigation.goBack()}>
              <Text style={styles.backText}>Back</Text>
            </Pressable>
          ),
        })}
      />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  backText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '700',
  },
});
