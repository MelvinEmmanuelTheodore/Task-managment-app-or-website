import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useAppTheme } from '../../src/stores/themeStore';
import { Colors } from '../../src/constants/colors';
import { formatDateIST, getCurrentISTDate } from '../../src/utils/dateHelpers';

export default function DashboardScreen() {
  const { theme } = useAppTheme();
  const themeColors = Colors[theme];
  const todayStr = getCurrentISTDate();

  return (
    <ScrollView style={[styles.container, { backgroundColor: themeColors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.dateText, { color: themeColors.primary }]}>
          {formatDateIST(todayStr)} (IST)
        </Text>
        <Text style={[styles.title, { color: themeColors.text }]}>Personal Dashboard</Text>
        <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>
          Daily timetable, task execution, and progress tracking
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
        <Text style={[styles.cardTitle, { color: themeColors.text }]}>🚀 Step 1 Scaffolding Complete</Text>
        <Text style={[styles.cardBody, { color: themeColors.textSecondary }]}>
          Expo Router, React Native Safe Area, TypeScript, and Zustand state are properly configured for cross-platform Android and Web execution.
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
        <Text style={[styles.cardTitle, { color: themeColors.text }]}>📅 Today's Routine Preview</Text>
        <Text style={[styles.cardBody, { color: themeColors.textSecondary }]}>
          • 08:00 AM — Wake up & morning routine (Fixed){'\n'}
          • 09:00 AM — Career work begins{'\n'}
          • 10:00 AM — Indian job applications & Overseas research{'\n'}
          • 02:00 PM — Technical learning, portfolio & interview prep{'\n'}
          • 05:30 PM — Exercise & workout{'\n'}
          • 07:00 PM — Family time, LEGO project & leisure{'\n'}
          • 10:45 PM — Wind down for sleep (Fixed)
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
  dateText: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  card: {
    padding: 18,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  cardBody: {
    fontSize: 14,
    lineHeight: 22,
  },
});
