import { Tabs } from 'expo-router';
import { useAppTheme } from '../../src/stores/themeStore';
import { Colors } from '../../src/constants/colors';
import { Platform } from 'react-native';

export default function TabLayout() {
  const { theme } = useAppTheme();
  const themeColors = Colors[theme];

  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: themeColors.surface,
          borderBottomColor: themeColors.border,
        },
        headerTintColor: themeColors.text,
        tabBarStyle: {
          backgroundColor: themeColors.surface,
          borderTopColor: themeColors.border,
          height: Platform.OS === 'web' ? 60 : 64,
          paddingBottom: Platform.OS === 'web' ? 8 : 10,
          paddingTop: 8,
        },
        tabBarActiveTintColor: themeColors.primary,
        tabBarInactiveTintColor: themeColors.textMuted,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarLabel: 'Dashboard',
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Timetable',
          tabBarLabel: 'Timetable',
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarLabel: 'Settings',
        }}
      />
    </Tabs>
  );
}
