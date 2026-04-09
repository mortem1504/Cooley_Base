import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text } from 'react-native';
import AuthScreen from '../screens/AuthScreen';
import BadgeManagementScreen from '../screens/BadgeManagementScreen';
import ChatThreadScreen from '../screens/ChatThreadScreen';
import JobDetailScreen from '../screens/JobDetailScreen';
import LaunchSplashScreen from '../screens/LaunchSplashScreen';
import ProfileScreen from '../screens/ProfileScreen';
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
  const [isLaunchSplashVisible, setIsLaunchSplashVisible] = useState(true);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setIsLaunchSplashVisible(false);
    }, 3000);

    return () => {
      clearTimeout(timeoutId);
    };
  }, []);

  const shouldShowLaunchSplash = isLaunchSplashVisible || isAuthLoading;

  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator screenOptions={screenOptions}>
        {shouldShowLaunchSplash ? (
          <Stack.Screen
            component={LaunchSplashScreen}
            name="LaunchSplash"
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
            <Stack.Screen
              component={ProfileScreen}
              name={ROOT_ROUTES.USER_PROFILE}
              options={({ navigation }) => ({
                title: 'Profile',
                headerLeft: () => (
                  <Pressable hitSlop={12} onPress={() => navigation.goBack()}>
                    <Text style={styles.backText}>Back</Text>
                  </Pressable>
                ),
              })}
            />
            <Stack.Screen
              component={BadgeManagementScreen}
              name={ROOT_ROUTES.BADGE_MANAGEMENT}
              options={({ navigation }) => ({
                title: 'Manage badges',
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

const styles = StyleSheet.create({
  backText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '700',
  },
});
