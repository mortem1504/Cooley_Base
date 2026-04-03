import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import DiscoverScreen from '../screens/DiscoverScreen';
import ListBrowseScreen from '../screens/ListBrowseScreen';
import MapBrowseScreen from '../screens/MapBrowseScreen';
import { colors } from '../utils/theme';
import { DISCOVER_ROUTES } from './routes';

const Stack = createNativeStackNavigator();

const screenOptions = {
  contentStyle: { backgroundColor: colors.background },
  headerShadowVisible: false,
  headerStyle: { backgroundColor: colors.background },
  headerTitleStyle: { color: colors.text, fontSize: 18, fontWeight: '700' },
};

export default function DiscoverNavigator() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        component={DiscoverScreen}
        name={DISCOVER_ROUTES.HOME}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        component={MapBrowseScreen}
        name={DISCOVER_ROUTES.MAP}
        options={{ title: 'Nearby on map' }}
      />
      <Stack.Screen
        component={ListBrowseScreen}
        name={DISCOVER_ROUTES.LIST}
        options={{ title: 'Browse jobs' }}
      />
    </Stack.Navigator>
  );
}
