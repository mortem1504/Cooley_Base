import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import useAppState from '../hooks/useAppState';
import MessagesScreen from '../screens/MessagesScreen';
import PostJobScreen from '../screens/PostJobScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { colors } from '../utils/theme';
import DiscoverNavigator from './DiscoverNavigator';
import TabIcon from './TabIcon';
import { TAB_ROUTES } from './routes';

const Tab = createBottomTabNavigator();

export default function MainTabNavigator() {
  const { unreadThreadCount } = useAppState();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarLabel: () => null,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          height: 76,
          paddingBottom: 14,
          paddingTop: 12,
        },
      }}
    >
      <Tab.Screen
        component={DiscoverNavigator}
        name={TAB_ROUTES.DISCOVER}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} label="Discover" />,
        }}
      />
      <Tab.Screen
        component={PostJobScreen}
        name={TAB_ROUTES.POST_JOB}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} label="Post" />,
        }}
      />
      <Tab.Screen
        component={MessagesScreen}
        name={TAB_ROUTES.MESSAGES}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon badgeCount={unreadThreadCount} focused={focused} label="Messages" />
          ),
        }}
      />
      <Tab.Screen
        component={ProfileScreen}
        name={TAB_ROUTES.PROFILE}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} label="Profile" />,
        }}
      />
    </Tab.Navigator>
  );
}
