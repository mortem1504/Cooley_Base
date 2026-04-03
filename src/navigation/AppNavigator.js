import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import AuthScreen from '../screens/AuthScreen';
import ChatThreadScreen from '../screens/ChatThreadScreen';
import JobDetailScreen from '../screens/JobDetailScreen';
import useAppState from '../hooks/useAppState';
import { colors } from '../utils/theme';
import { navigationTheme } from './navigationTheme';
import MainTabNavigator from './MainTabNavigator';
import { ROOT_ROUTES } from './routes';

const Stack = createNativeStackNavigator();

const screenOptions = {
  contentStyle: { backgroundColor: colors.background },
  headerShadowVisible: false,
  headerStyle: { backgroundColor: colors.background },
  headerTitleStyle: { color: colors.text, fontSize: 18, fontWeight: '700' },
};

export default function AppNavigator() {
  const { isAuthenticated, isAuthLoading } = useAppState();

  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator screenOptions={screenOptions}>
        {isAuthLoading ? (
          <Stack.Screen
            component={AuthLoadingScreen}
            name="AuthLoading"
            options={{ headerShown: false }}
          />
        ) : !isAuthenticated ? (
          <Stack.Screen
            component={AuthScreen}
            name={ROOT_ROUTES.AUTH}
            options={{ headerShown: false }}
          />
        ) : (
          <>
            <Stack.Screen
              component={MainTabNavigator}
              name={ROOT_ROUTES.MAIN_TABS}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              component={ChatThreadScreen}
              name={ROOT_ROUTES.CHAT_THREAD}
              options={({ navigation, route }) => ({
                title: route.params?.threadName || 'Chat',
                headerLeft: () => (
                  <Pressable hitSlop={12} onPress={() => navigation.goBack()}>
                    <Text style={styles.backText}>Back</Text>
                  </Pressable>
                ),
              })}
            />
            <Stack.Screen
              component={JobDetailScreen}
              name={ROOT_ROUTES.JOB_DETAIL}
              options={({ navigation }) => ({
                title: 'Job details',
                headerLeft: () => (
                  <Pressable hitSlop={12} onPress={() => navigation.goBack()}>
                    <Text style={styles.backText}>Back</Text>
                  </Pressable>
                ),
              })}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

function AuthLoadingScreen() {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={styles.loadingTitle}>Connecting your secure account</Text>
      <Text style={styles.loadingText}>Checking your saved session and profile.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  loadingContainer: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  loadingTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    marginTop: 18,
  },
  loadingText: {
    color: colors.secondaryText,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
    textAlign: 'center',
  },
});
