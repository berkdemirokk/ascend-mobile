import React from 'react';
import { Text, View, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import {
  NavigationContainer,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';

// Top-level navigation ref — used by services (e.g., notifications.js)
// that need to navigate from outside the React tree (background push
// taps, deep links). Exposed via `navigateFromAnywhere` below.
export const navigationRef = createNavigationContainerRef();

/**
 * Navigate from non-React code (e.g., a notification action handler).
 * No-ops if the navigator isn't ready yet (e.g., user tapped the
 * notification before the app finished cold-booting); the caller is
 * responsible for retrying or queueing if that case matters.
 */
export const navigateFromAnywhere = (name, params) => {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name, params);
    return true;
  }
  return false;
};

import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';

import OnboardingScreen from '../screens/OnboardingScreen';
import HomeScreen from '../screens/HomeScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SettingsScreen from '../screens/SettingsScreen';
import PaywallScreen from '../screens/PaywallScreen';
import LessonScreen from '../screens/LessonScreen';
import PathScreen from '../screens/PathScreen';
import ReflectionsScreen from '../screens/ReflectionsScreen';
import InsightsScreen from '../screens/InsightsScreen';
import LessonSearchScreen from '../screens/LessonSearchScreen';
import WelcomeScreen from '../screens/auth/WelcomeScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import SignupScreen from '../screens/auth/SignupScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';

import { LT } from '../config/lightTheme';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Material icon name per tab.
const TAB_ICONS = {
  Home: 'home',
  Paths: 'alt-route',
  Stats: 'bar-chart',
  Profile: 'person',
};

// Filled variants for active state (visual hint).
const TAB_ICONS_FILLED = {
  Home: 'home-filled',
  Paths: 'alt-route',
  Stats: 'bar-chart',
  Profile: 'person',
};

function TabIcon({ name, focused, color }) {
  const iconName = focused
    ? TAB_ICONS_FILLED[name] || TAB_ICONS[name] || 'circle'
    : TAB_ICONS[name] || 'circle';
  return <MaterialIcons name={iconName} size={24} color={color} />;
}

function MainTabs() {
  const { t } = useTranslation();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: LT.surface,
          borderTopWidth: 1,
          borderTopColor: LT.outlineVariant,
          height: 78,
          paddingBottom: 12,
          paddingTop: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.04,
          shadowRadius: 8,
          elevation: 4,
        },
        tabBarActiveTintColor: LT.primaryContainer,
        tabBarInactiveTintColor: LT.onSurfaceVariant,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '900',
          letterSpacing: 1.5,
          textTransform: 'uppercase',
          marginTop: 2,
        },
        tabBarIcon: ({ focused, color }) => (
          <TabIcon name={route.name} focused={focused} color={color} />
        ),
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: t('nav.home', 'Home') }}
      />
      <Tab.Screen
        name="Paths"
        component={PathScreen}
        options={{ title: t('nav.paths', 'Paths') }}
      />
      <Tab.Screen
        name="Stats"
        component={InsightsScreen}
        options={{ title: t('nav.stats', 'Stats') }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: t('nav.profile', 'Profile') }}
      />
    </Tab.Navigator>
  );
}

function AuthLoading() {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: LT.background,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <ActivityIndicator color={LT.primaryContainer} size="large" />
    </View>
  );
}

export default function AppNavigator() {
  const { onboarded } = useApp();
  const { isAuthenticated, guestMode, loading: authLoading } = useAuth();

  if (authLoading) {
    return <AuthLoading />;
  }

  const needsAuth = !isAuthenticated && !guestMode;

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: LT.background },
          animation: 'slide_from_right',
          animationDuration: 250,
        }}
      >
        {needsAuth ? (
          <>
            <Stack.Screen
              name="Welcome"
              component={WelcomeScreen}
              options={{ animation: 'fade' }}
            />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} />
            <Stack.Screen
              name="ForgotPassword"
              component={ForgotPasswordScreen}
            />
          </>
        ) : !onboarded ? (
          <Stack.Screen
            name="Onboarding"
            component={OnboardingScreen}
            options={{ animation: 'fade' }}
          />
        ) : (
          <Stack.Screen
            name="MainTabs"
            component={MainTabs}
            options={{ animation: 'fade' }}
          />
        )}
        <Stack.Screen
          name="Paywall"
          component={PaywallScreen}
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="Lesson"
          component={LessonScreen}
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="Reflections"
          component={ReflectionsScreen}
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="LessonSearch"
          component={LessonSearchScreen}
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
