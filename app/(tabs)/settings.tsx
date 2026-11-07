import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useAppTheme } from '../../src/stores/themeStore';
import { Colors } from '../../src/constants/colors';

export default function SettingsScreen() {
  const { theme, preference, setThemePreference } = useAppTheme();
  const themeColors = Colors[theme];

  return (
    <ScrollView style={[styles.container, { backgroundColor: themeColors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: themeColors.text }]}>Settings</Text>
        <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>
          App configuration and preferences
        </Text>
      </View>

      <View style={[styles.section, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
        <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Theme Appearance</Text>
        <Text style={[styles.sectionSubtitle, { color: themeColors.textSecondary }]}>
          Choose how the interface renders across devices
        </Text>

        <View style={styles.buttonRow}>
          {(['dark', 'light', 'system'] as const).map((mode) => {
            const isSelected = preference === mode;
            return (
              <TouchableOpacity
                key={mode}
                onPress={() => setThemePreference(mode)}
                style={[
                  styles.themeButton,
                  {
                    backgroundColor: isSelected ? themeColors.primary : themeColors.surfaceSecondary,
                    borderColor: isSelected ? themeColors.primary : themeColors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.themeButtonText,
                    { color: isSelected ? '#FFFFFF' : themeColors.text },
                  ]}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
        <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Project Architecture Status</Text>
        <Text style={[styles.statusText, { color: themeColors.textSecondary }]}>
          • Framework: Expo SDK 58 + React Native 0.88 + TypeScript{'\n'}
          • Navigation: Expo Router file-based tabs{'\n'}
          • Targets: Android App & Web Browser from single codebase{'\n'}
          • State: Zustand lightweight stores{'\n'}
          • Step 1: Complete and testable
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    marginBottom: 20,
    marginTop: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  section: {
    padding: 18,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    marginBottom: 14,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  themeButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  statusText: {
    fontSize: 13,
    lineHeight: 22,
    marginTop: 6,
  },
});
