import { create } from 'zustand';
import { useColorScheme } from 'react-native';

export type ThemePreference = 'light' | 'dark' | 'system';

interface ThemeState {
  themePreference: ThemePreference;
  setThemePreference: (pref: ThemePreference) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  themePreference: 'dark', // Default modern dark theme
  setThemePreference: (pref) => set({ themePreference: pref }),
}));

export function useAppTheme() {
  const systemScheme = useColorScheme();
  const preference = useThemeStore((s) => s.themePreference);

  const activeTheme = preference === 'system' ? (systemScheme === 'light' ? 'light' : 'dark') : preference;

  return {
    isDark: activeTheme === 'dark',
    theme: activeTheme,
    preference,
    setThemePreference: useThemeStore.getState().setThemePreference,
  };
}
