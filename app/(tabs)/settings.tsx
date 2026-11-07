import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Platform } from 'react-native';
import { useAppTheme } from '../../src/stores/themeStore';
import { Colors } from '../../src/constants/colors';
import { storageAdapter } from '../../src/services/storage/AsyncStorageAdapter';
import { useCategoryTopicStore } from '../../src/stores/categoryTopicStore';
import { useTimetableStore } from '../../src/stores/timetableStore';

export default function SettingsScreen() {
  const { theme, preference, setThemePreference } = useAppTheme();
  const themeColors = Colors[theme];

  const { loadInitialData } = useCategoryTopicStore();
  const { loadInitialBlocks } = useTimetableStore();
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const handleExport = async () => {
    try {
      const json = await storageAdapter.exportAllData();
      if (Platform.OS === 'web') {
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `time_management_backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
      setExportNotice('Backup successfully exported!');
      setTimeout(() => setExportNotice(null), 4000);
    } catch {
      Alert.alert('Export Failed', 'Could not export local database.');
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: themeColors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: themeColors.text }]}>Settings</Text>
        <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>
          Appearance, local backup & milestone status
        </Text>
      </View>

      {/* Theme Setting */}
      <View style={[styles.section, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
        <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Theme Appearance</Text>
        <Text style={[styles.sectionSubtitle, { color: themeColors.textSecondary }]}>
          Stored locally and persists across app restarts
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

      {/* JSON Backup & Export */}
      <View style={[styles.section, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
        <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Data Backup & Export</Text>
        <Text style={[styles.sectionSubtitle, { color: themeColors.textSecondary }]}>
          Export all categories, topics, tasks, and timetable blocks as a JSON file
        </Text>

        <TouchableOpacity onPress={handleExport} style={[styles.actionButton, { backgroundColor: themeColors.primary }]}>
          <Text style={styles.actionButtonText}>Export JSON Backup</Text>
        </TouchableOpacity>

        {exportNotice && (
          <Text style={[styles.noticeText, { color: themeColors.success }]}>{exportNotice}</Text>
        )}
      </View>

      {/* Milestone A Architecture Info */}
      <View style={[styles.section, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
        <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Milestone A: Interactive Core</Text>
        <Text style={[styles.statusText, { color: themeColors.textSecondary }]}>
          • Entity Separation: Category, Topic, TopicTask, TimetableBlock{'\n'}
          • Storage Adapter: AsyncStorageAdapter with serialised write queue{'\n'}
          • Safety: Cascade category deletion warnings and shift confirmations{'\n'}
          • Platform: Android & Web local interactivity
        </Text>
      </View>

      <View style={{ height: 40 }} />
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
  actionButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  noticeText: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  statusText: {
    fontSize: 13,
    lineHeight: 22,
  },
});
