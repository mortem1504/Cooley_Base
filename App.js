import 'react-native-gesture-handler';
import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Pressable, Text, View } from 'react-native';
import AuthScreen from './src/screens/AuthScreen';
import HomeScreen from './src/screens/HomeScreen';
import MapBrowseScreen from './src/screens/MapBrowseScreen';
import ListBrowseScreen from './src/screens/ListBrowseScreen';
import PostJobScreen from './src/screens/PostJobScreen';
import JobDetailScreen from './src/screens/JobDetailScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import { AppProvider, useApp } from './src/context/AppContext';
import { colors } from './src/theme';

const RootStack = createNativeStackNavigator();
const DiscoverStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    card: colors.card,
    text: colors.text,
    border: colors.border,
    primary: colors.primary,
  },
};

function TabIcon({ label, focused }) {
  return (
    <View style={{ alignItems: 'center', gap: 4, minWidth: 72 }}>
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          backgroundColor: focused ? colors.primary : 'transparent',
        }}
      />
      <Text
        style={{
          fontSize: 12,
          fontWeight: focused ? '700' : '600',
          color: focused ? colors.text : colors.subtleText,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function DiscoverNavigator() {
  return (
    <DiscoverStack.Navigator
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { fontSize: 18, fontWeight: '700', color: colors.text },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <DiscoverStack.Screen
        name="DiscoverHome"
        component={HomeScreen}
        options={{ headerShown: false }}
      />
      <DiscoverStack.Screen
        name="MapBrowse"
        component={MapBrowseScreen}
        options={{ title: 'Nearby on map' }}
      />
      <DiscoverStack.Screen
        name="ListBrowse"
        component={ListBrowseScreen}
        options={{ title: 'Browse jobs' }}
      />
    </DiscoverStack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          height: 76,
          paddingTop: 12,
          paddingBottom: 14,
          backgroundColor: colors.card,
          borderTopColor: colors.border,
        },
        tabBarLabel: () => null,
      }}
    >
      <Tab.Screen
        name="Discover"
        component={DiscoverNavigator}
        options={{ tabBarIcon: ({ focused }) => <TabIcon label="Discover" focused={focused} /> }}
      />
      <Tab.Screen
        name="PostJob"
        component={PostJobScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon label="Post Job" focused={focused} /> }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon label="Profile" focused={focused} /> }}
      />
    </Tab.Navigator>
  );
}

function AppShell() {
  const { isAuthenticated } = useApp();

  return (
    <NavigationContainer theme={navTheme}>
      <RootStack.Navigator
        screenOptions={{
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.background },
          headerTitleStyle: { fontSize: 18, fontWeight: '700', color: colors.text },
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        {!isAuthenticated ? (
          <RootStack.Screen
            name="Auth"
            component={AuthScreen}
            options={{ headerShown: false }}
          />
        ) : (
          <>
            <RootStack.Screen
              name="MainTabs"
              component={MainTabs}
              options={{ headerShown: false }}
            />
            <RootStack.Screen
              name="JobDetail"
              component={JobDetailScreen}
              options={({ navigation }) => ({
                title: 'Job details',
                headerLeft: () => (
                  <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
                    <Text style={{ color: colors.primary, fontSize: 15, fontWeight: '700' }}>
                      Back
                    </Text>
                  </Pressable>
                ),
              })}
            />
          </>
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}
