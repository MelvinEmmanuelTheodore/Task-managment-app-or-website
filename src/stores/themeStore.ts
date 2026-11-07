import { create } from 'zustand';
import { useColorScheme } from 'react-native';
import { getStorage } from '../services/storage';
import { dateToAppTimestamp } from '../utils/dateHelpers';

export type ThemePreference = 'light' | 'dark' | 'system';

interface ThemeState {
  themePreference: ThemePreference;
  isInitialized: boolean;
  initTheme: () => Promise<void>;
  setThemePreference: (pref: ThemePreference) => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set) => ({
  themePreference: 'dark', // Default modern dark theme
  isInitialized: false,

  initTheme: async () => {
    try {
      const settings = await getStorage().getSettings();
      if (settings && settings.theme) {
        set({ themePreference: settings.theme, isInitialized: true });
      } else {
        set({ isInitialized: true });
      }
    } catch {
      set({ isInitialized: true });
    }
  },

  setThemePreference: async (pref: ThemePreference) => {
    set({ themePreference: pref });
    try {
      const settings = await getStorage().getSettings();
      const updated = {
        ...settings,
        theme: pref,
        updatedAt: dateToAppTimestamp(new Date()),
      };
      await getStorage().saveSettings(updated);
    } catch {
      // Keep optimistic memory update
    }
  },
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
