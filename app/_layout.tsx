import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import Head from 'expo-router/head';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAppTheme, useThemeStore } from '../src/stores/themeStore';
import { Colors } from '../src/constants/colors';
import { isFirebaseConfigured } from '../src/services/firebase/webFirebase';
import { subscribeToAuthState, checkRedirectAuth } from '../src/services/auth/authService';
import { startFirestoreSync, stopFirestoreSync } from '../src/services/sync/firestoreSyncService';

export default function RootLayout() {
  const { isDark, theme } = useAppTheme();
  const themeColors = Colors[theme];

  useEffect(() => {
    useThemeStore.getState().initTheme();

    if (Platform.OS === 'web' && typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/Task-managment-app-or-website/sw.js')
        .then((reg) => {
          console.log('[PWA] ServiceWorker registered with scope:', reg.scope);
        })
        .catch((err) => {
          console.warn('[PWA] ServiceWorker registration warning:', err);
        });
    }

    // Global Firebase Auth state & two-way synchronisation lifecycle
    if (isFirebaseConfigured()) {
      checkRedirectAuth().catch(() => {});
      const unsubAuth = subscribeToAuthState((user) => {
        if (user) {
          startFirestoreSync(user.uid);
        } else {
          stopFirestoreSync();
        }
      });
      return () => {
        unsubAuth();
        stopFirestoreSync();
      };
    }
  }, []);

  return (
    <SafeAreaProvider>
      <Head>
        <title>Time Management App</title>
        <meta name="description" content="Modern daily and weekly routine timetable and task management app" />
        <meta name="theme-color" content="#1F2937" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Timetable" />
        <link rel="manifest" href="/Task-managment-app-or-website/manifest.json" />
        <link rel="icon" type="image/png" href="/Task-managment-app-or-website/favicon.png" />
        <link rel="apple-touch-icon" href="/Task-managment-app-or-website/icons/icon-192.png" />
      </Head>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: themeColors.surface,
          },
          headerTintColor: themeColors.text,
          headerTitleStyle: {
            fontWeight: '600',
          },
          contentStyle: {
            backgroundColor: themeColors.background,
          },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </SafeAreaProvider>
  );
}
