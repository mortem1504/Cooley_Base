import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SidebarMenuButton from '../components/SidebarMenuButton';
import UserAvatar from '../components/UserAvatar';
import useAppState from '../hooks/useAppState';
import MessagesScreen from '../screens/MessagesScreen';
import PostJobScreen from '../screens/PostJobScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { colors, radius, shadow, spacing } from '../utils/theme';
import DiscoverNavigator from './DiscoverNavigator';
import { MainShellProvider } from './MainShellContext';
import WalletNavigator from './WalletNavigator';
import { DISCOVER_ROUTES, TAB_ROUTES, WALLET_ROUTES } from './routes';

const Tab = createBottomTabNavigator();
const SIDEBAR_WIDTH = 292;
const EDGE_SWIPE_WIDTH = 18;
const EDGE_SWIPE_TRIGGER_DX = 22;

const MAIN_DRAWER_ITEMS = [
  { key: TAB_ROUTES.DISCOVER, label: 'Discover', iconActive: 'compass', iconInactive: 'compass-outline' },
  { key: TAB_ROUTES.POST_JOB, label: 'Post', iconActive: 'add-circle', iconInactive: 'add-circle-outline' },
  { key: TAB_ROUTES.WALLET, label: 'Wallet', iconActive: 'wallet', iconInactive: 'wallet-outline' },
  { key: TAB_ROUTES.MESSAGES, label: 'Messages', iconActive: 'chatbubble-ellipses', iconInactive: 'chatbubble-ellipses-outline' },
  { key: TAB_ROUTES.PROFILE, label: 'Profile', iconActive: 'person-circle', iconInactive: 'person-circle-outline' },
];

function HiddenTabBarBridge({ onUpdate, ...props }) {
  useEffect(() => {
    onUpdate(props);
  }, [onUpdate, props.navigation, props.state]);

  return null;
}

function resolveDeepestRouteName(route) {
  if (!route?.state?.routes?.length) {
    return route?.name || '';
  }

  const nextRoute = route.state.routes[route.state.index || 0];
  return resolveDeepestRouteName(nextRoute);
}

function DrawerItem({ active = false, badgeCount = 0, iconActive, iconInactive, label, onPress }) {
  const badgeLabel = badgeCount > 9 ? '9+' : `${badgeCount}`;
  const iconName = active ? iconActive : iconInactive;

  return (
    <Pressable onPress={onPress} style={[styles.drawerItem, active && styles.drawerItemActive]}>
      <View style={[styles.drawerItemIconWrap, active && styles.drawerItemIconWrapActive]}>
        <Ionicons
          color={active ? colors.card : 'rgba(255, 255, 255, 0.86)'}
          name={iconName}
          size={20}
        />
      </View>
      <Text style={[styles.drawerItemText, active && styles.drawerItemTextActive]}>{label}</Text>
      {badgeCount ? (
        <View style={styles.drawerBadge}>
          <Text style={styles.drawerBadgeText}>{badgeLabel}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export default function MainTabNavigator() {
  const {
    currentUser,
    logout,
    unreadThreadCount,
  } = useAppState();
  const insets = useSafeAreaInsets();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const tabNavigationRef = useRef(null);
  const [activeTabState, setActiveTabState] = useState({
    tabRouteName: TAB_ROUTES.DISCOVER,
    nestedRouteName: DISCOVER_ROUTES.HOME,
  });
  const [activeDiscoverSectionKey, setActiveDiscoverSectionKey] = useState('suggested');
  const [discoverSectionJumpRequest, setDiscoverSectionJumpRequest] = useState({
    key: null,
    nonce: 0,
  });
  const drawerTranslateX = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;

  const activeTabRouteName = activeTabState.tabRouteName;
  const activeNestedRouteName = activeTabState.nestedRouteName;
  const isDiscoverActive = activeTabRouteName === TAB_ROUTES.DISCOVER;
  const discoverDrawerItems = useMemo(() => {
    return [
      { key: 'suggested', label: 'For you' },
      { key: 'closest', label: 'Closest' },
      { key: 'pulse', label: 'New' },
      { key: 'all', label: 'All' },
      { key: 'map', label: 'Map' },
    ];
  }, []);

  useEffect(() => {
    Animated.timing(drawerTranslateX, {
      toValue: isSidebarOpen ? 0 : -SIDEBAR_WIDTH,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [drawerTranslateX, isSidebarOpen]);

  const openSidebar = () => setIsSidebarOpen(true);
  const closeSidebar = () => setIsSidebarOpen(false);
  const toggleSidebar = () => setIsSidebarOpen((prev) => !prev);
  const edgeSwipeResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gestureState) =>
          !isSidebarOpen &&
          gestureState.dx > 12 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.2,
        onPanResponderRelease: (_event, gestureState) => {
          if (gestureState.dx >= EDGE_SWIPE_TRIGGER_DX) {
            openSidebar();
          }
        },
      }),
    [isSidebarOpen]
  );

  const handleTabBarBridgeUpdate = useCallback((nextBridge) => {
    tabNavigationRef.current = nextBridge.navigation;
    const nextActiveRoute = nextBridge.state?.routes?.[nextBridge.state.index || 0] || null;
    const nextTabRouteName = nextActiveRoute?.name || TAB_ROUTES.DISCOVER;
    const resolvedNestedRouteName = resolveDeepestRouteName(nextActiveRoute);
    const nextNestedRouteName =
      nextTabRouteName === TAB_ROUTES.DISCOVER && resolvedNestedRouteName === TAB_ROUTES.DISCOVER
        ? DISCOVER_ROUTES.HOME
        : nextTabRouteName === TAB_ROUTES.WALLET && resolvedNestedRouteName === TAB_ROUTES.WALLET
          ? WALLET_ROUTES.HOME
          : resolvedNestedRouteName || DISCOVER_ROUTES.HOME;

    setActiveTabState((prev) => (
      prev.tabRouteName === nextTabRouteName && prev.nestedRouteName === nextNestedRouteName
        ? prev
        : {
            nestedRouteName: nextNestedRouteName,
            tabRouteName: nextTabRouteName,
          }
    ));
  }, []);

  const handleNavigateMainRoute = (routeName) => {
    if (routeName === TAB_ROUTES.DISCOVER) {
      tabNavigationRef.current?.navigate(TAB_ROUTES.DISCOVER, {
        screen: DISCOVER_ROUTES.HOME,
      });
    } else if (routeName === TAB_ROUTES.WALLET) {
      tabNavigationRef.current?.navigate(TAB_ROUTES.WALLET, {
        screen: WALLET_ROUTES.HOME,
      });
    } else {
      tabNavigationRef.current?.navigate(routeName);
    }

    closeSidebar();
  };

  const handleDiscoverShortcut = (key) => {
    tabNavigationRef.current?.navigate(TAB_ROUTES.DISCOVER, {
      screen: DISCOVER_ROUTES.HOME,
    });
    setDiscoverSectionJumpRequest({
      key,
      nonce: Date.now(),
    });
    closeSidebar();
  };

  const shellValue = useMemo(
    () => ({
      activeDiscoverSectionKey,
      activeNestedRouteName,
      activeTabRouteName,
      closeSidebar,
      discoverSectionJumpRequest,
      isShellAvailable: true,
      openSidebar,
      setActiveDiscoverSectionKey,
      toggleSidebar,
    }),
    [
      activeDiscoverSectionKey,
      activeNestedRouteName,
      activeTabRouteName,
      discoverSectionJumpRequest,
    ]
  );

  return (
    <MainShellProvider value={shellValue}>
      <View style={styles.shell}>
        <Tab.Navigator
          screenOptions={{
            headerShown: false,
            tabBarStyle: {
              display: 'none',
            },
          }}
          tabBar={(props) => <HiddenTabBarBridge {...props} onUpdate={handleTabBarBridgeUpdate} />}
        >
          <Tab.Screen component={DiscoverNavigator} name={TAB_ROUTES.DISCOVER} />
          <Tab.Screen component={PostJobScreen} name={TAB_ROUTES.POST_JOB} />
          <Tab.Screen component={WalletNavigator} name={TAB_ROUTES.WALLET} />
          <Tab.Screen component={MessagesScreen} name={TAB_ROUTES.MESSAGES} />
          <Tab.Screen component={ProfileScreen} name={TAB_ROUTES.PROFILE} />
        </Tab.Navigator>

        {!isSidebarOpen ? (
          <View
            {...edgeSwipeResponder.panHandlers}
            style={styles.edgeSwipeZone}
          />
        ) : null}

        {isSidebarOpen ? (
          <Pressable onPress={closeSidebar} style={styles.scrimPressable}>
            <Animated.View
              style={[
                styles.scrim,
                {
                  opacity: drawerTranslateX.interpolate({
                    inputRange: [-SIDEBAR_WIDTH, 0],
                    outputRange: [0, 1],
                  }),
                },
              ]}
            />
          </Pressable>
        ) : null}

        <Animated.View
          style={[
            styles.drawer,
            {
              paddingBottom: Math.max(insets.bottom, spacing.lg),
              paddingTop: insets.top + spacing.lg,
              transform: [{ translateX: drawerTranslateX }],
            },
          ]}
        >
          <View style={styles.drawerHeader}>
            <UserAvatar
              avatarUrl={currentUser.avatarUrl}
              name={currentUser.name}
              size={52}
            />
            <View style={styles.drawerHeaderCopy}>
              <Text numberOfLines={1} style={styles.drawerHeaderName}>
                {currentUser.name || 'Student User'}
              </Text>
              <Text numberOfLines={1} style={styles.drawerHeaderMeta}>
                {currentUser.schoolName || 'Campus member'}
              </Text>
            </View>
          </View>

          <View style={styles.drawerGroup}>
            <Text style={styles.drawerGroupTitle}>Navigate</Text>
            {MAIN_DRAWER_ITEMS.map((item) => (
              <DrawerItem
                active={activeTabRouteName === item.key}
                badgeCount={item.key === TAB_ROUTES.MESSAGES ? unreadThreadCount : 0}
                iconActive={item.iconActive}
                iconInactive={item.iconInactive}
                key={item.key}
                label={item.label}
                onPress={() => handleNavigateMainRoute(item.key)}
              />
            ))}
          </View>

          <View style={styles.drawerGroup}>
            <Text style={styles.drawerGroupTitle}>Discover shortcuts</Text>
            {discoverDrawerItems.map((item) => (
              <DrawerItem
                active={
                  item.key === 'map'
                    ? isDiscoverActive &&
                      (activeNestedRouteName === DISCOVER_ROUTES.MAP || activeDiscoverSectionKey === 'map')
                    : isDiscoverActive &&
                      activeNestedRouteName === DISCOVER_ROUTES.HOME &&
                      activeDiscoverSectionKey === item.key
                }
                key={item.key}
                label={item.label}
                onPress={() => handleDiscoverShortcut(item.key)}
              />
            ))}
          </View>

          <View style={styles.drawerFooter}>
            <SidebarMenuButton onPress={toggleSidebar} style={styles.drawerFooterButton} />
            <Pressable onPress={logout} style={styles.logoutButton}>
              <Text style={styles.logoutText}>Log Out</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </MainShellProvider>
  );
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: colors.background,
    flex: 1,
  },
  edgeSwipeZone: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    top: 0,
    width: EDGE_SWIPE_WIDTH,
    zIndex: 10,
  },
  scrimPressable: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 18, 36, 0.42)',
  },
  drawer: {
    backgroundColor: '#2440C7',
    borderBottomRightRadius: 30,
    borderTopRightRadius: 30,
    bottom: 0,
    left: 0,
    paddingHorizontal: spacing.lg,
    position: 'absolute',
    top: 0,
    width: SIDEBAR_WIDTH,
    zIndex: 30,
    ...shadow,
  },
  drawerHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  drawerHeaderCopy: {
    flex: 1,
  },
  drawerHeaderName: {
    color: colors.card,
    fontSize: 18,
    fontWeight: '800',
  },
  drawerHeaderMeta: {
    color: 'rgba(255, 255, 255, 0.74)',
    fontSize: 12,
    marginTop: 4,
  },
  drawerGroup: {
    gap: spacing.xs,
    marginBottom: spacing.xl,
  },
  drawerGroupTitle: {
    color: 'rgba(255, 255, 255, 0.72)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  drawerItem: {
    alignItems: 'center',
    borderRadius: radius.md,
    flexDirection: 'row',
    minHeight: 46,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  drawerItemActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  drawerItemIconWrap: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: radius.pill,
    height: 32,
    justifyContent: 'center',
    marginRight: 12,
    width: 32,
  },
  drawerItemIconWrapActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  drawerItemText: {
    color: 'rgba(255, 255, 255, 0.86)',
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  drawerItemTextActive: {
    color: colors.card,
  },
  drawerBadge: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    justifyContent: 'center',
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  drawerBadgeText: {
    color: '#2440C7',
    fontSize: 10,
    fontWeight: '800',
  },
  drawerFooter: {
    borderTopColor: 'rgba(255, 255, 255, 0.18)',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: 'auto',
    paddingTop: spacing.lg,
  },
  drawerFooterButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderColor: 'rgba(255, 255, 255, 0.16)',
    flexShrink: 0,
  },
  logoutButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: radius.md,
    flex: 1,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: spacing.md,
  },
  logoutText: {
    color: colors.card,
    fontSize: 14,
    fontWeight: '800',
  },
});
