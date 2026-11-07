import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { useAppTheme } from '../../src/stores/themeStore';
import { Colors } from '../../src/constants/colors';
import { getStorage } from '../../src/services/storage';
import { useCategoryTopicStore } from '../../src/stores/categoryTopicStore';
import { useTimetableStore } from '../../src/stores/timetableStore';
import { validateBackupPayload } from '../../src/utils/backupValidator';
import { StoredDataEnvelope } from '../../src/types/storage';

export default function SettingsScreen() {
  const { theme, preference, setThemePreference } = useAppTheme();
  const themeColors = Colors[theme];

  const { loadInitialData } = useCategoryTopicStore();
  const { loadInitialBlocks } = useTimetableStore();

  const [notice, setNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Storage Lock State
  const [isLocked, setIsLocked] = useState(false);
  const [lockReason, setLockReason] = useState<string | null>(null);

  // Import Preview State
  const [previewEnvelope, setPreviewEnvelope] = useState<StoredDataEnvelope | null>(null);
  const [showReplaceConfirm, setShowReplaceConfirm] = useState(false);
  const [hasAcknowledgedExternalBackup, setHasAcknowledgedExternalBackup] = useState(false);
  const [typedReplaceText, setTypedReplaceText] = useState('');

  useEffect(() => {
    const storage = getStorage();
    setIsLocked(storage.isStorageLocked());
    setLockReason(storage.getCorruptionError());
  }, []);

  const showStatusNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 4500);
  };

  /**
   * Verified File Export:
   * Native: writes to File(Paths.cache), asserts exists, non-zero size, re-parses, shares via expo-sharing.
   * Web: downloads as a JSON Blob.
   */
  const handleExport = async (): Promise<boolean> => {
    setIsExporting(true);
    setErrorMessage(null);
    try {
      const json = await getStorage().exportAllData();
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `time_management_backup_${dateStr}.json`;

      if (Platform.OS === 'web') {
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        // Modern File API for native platforms
        const cacheFile = new File(Paths.cache, filename);
        await cacheFile.write(json);

        // Verification: exists, size > 0, parseable
        if (!cacheFile.exists || cacheFile.size === 0) {
          throw new Error('Export file verification failed: written file is missing or empty');
        }
        const verifyContent = await cacheFile.text();
        JSON.parse(verifyContent);

        const isShareAvailable = await Sharing.isAvailableAsync();
        if (isShareAvailable) {
          await Sharing.shareAsync(cacheFile.uri, {
            mimeType: 'application/json',
            dialogTitle: 'Export Time Management App Backup',
            UTI: 'public.json',
          });
        }
      }

      showStatusNotice('Backup file ready: choose where to save it.');
      setIsExporting(false);
      return true;
    } catch (err: any) {
      setIsExporting(false);
      const msg = err?.message || 'Could not export local database.';
      Alert.alert('Backup Export Failed', msg);
      setErrorMessage(msg);
      return false;
    }
  };

  /**
   * Import Workflow:
   * Uses expo-document-picker to select JSON, reads contents, validates completely.
   * If canceled or invalid, leaves data completely untouched.
   */
  const handleSelectImportFile = async () => {
    setErrorMessage(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        // Clean exit: zero modifications, no error banners
        return;
      }

      const asset = result.assets && result.assets[0];
      if (!asset) return;

      setIsImporting(true);
      let jsonText = '';

      if (Platform.OS === 'web') {
        if (asset.file) {
          jsonText = await asset.file.text();
        } else {
          const res = await fetch(asset.uri);
          jsonText = await res.text();
        }
      } else {
        const importFile = new File(asset.uri);
        jsonText = await importFile.text();
      }

      let parsed: any;
      try {
        parsed = JSON.parse(jsonText);
      } catch {
        setIsImporting(false);
        Alert.alert('Import Failed', 'The selected file is not valid JSON.');
        return;
      }

      const validation = validateBackupPayload(parsed);
      setIsImporting(false);

      if (!validation.isValid || !validation.envelope) {
        const details = validation.errors.slice(0, 5).join('\n• ');
        Alert.alert(
          'Invalid Backup File',
          `The file failed schema validation and cannot be imported:\n\n• ${details}`
        );
        return;
      }

      // Valid: open preview modal
      setPreviewEnvelope(validation.envelope);
    } catch (err: any) {
      setIsImporting(false);
      Alert.alert('Import Error', err?.message || 'Failed to read selected file.');
    }
  };

  /** Apply Import: Merge */
  const handleApplyMerge = async () => {
    if (!previewEnvelope) return;
    try {
      await getStorage().mergeAllData(previewEnvelope);
      await loadInitialData(true);
      await loadInitialBlocks(true);
      setPreviewEnvelope(null);
      showStatusNotice('Data successfully merged!');
    } catch (err: any) {
      Alert.alert('Merge Failed', err?.message || 'Failed to merge backup data.');
    }
  };

  /** Apply Import: Replace All */
  const handleApplyReplaceAll = async () => {
    if (!previewEnvelope) return;
    if (!hasAcknowledgedExternalBackup) {
      Alert.alert('Action Required', 'Please confirm that you have saved an external backup somewhere safe.');
      return;
    }
    if (typedReplaceText.trim() !== 'REPLACE') {
      Alert.alert('Confirmation Required', 'Please type REPLACE in all caps to confirm.');
      return;
    }

    try {
      await getStorage().replaceAllData(previewEnvelope);
      await loadInitialData(true);
      await loadInitialBlocks(true);

      setPreviewEnvelope(null);
      setShowReplaceConfirm(false);
      setHasAcknowledgedExternalBackup(false);
      setTypedReplaceText('');

      showStatusNotice('All data successfully replaced!');
    } catch (err: any) {
      Alert.alert('Replace-All Aborted', `Operation aborted: ${err?.message || 'Verification failed.'}`);
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

      {/* Storage Lock Alert Banner */}
      {isLocked && (
        <View style={[styles.lockBanner, { backgroundColor: '#EF444422', borderColor: '#EF4444' }]}>
          <Text style={[styles.lockTitle, { color: '#EF4444' }]}>⚠️ Storage Locked</Text>
          <Text style={[styles.lockSubtitle, { color: themeColors.text }]}>
            {lockReason || 'Storage is locked due to corruption. Writes are blocked to prevent data loss.'}
          </Text>
        </View>
      )}

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

        <TouchableOpacity
          onPress={handleExport}
          disabled={isExporting}
          style={[styles.actionButton, { backgroundColor: themeColors.primary }]}
        >
          {isExporting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.actionButtonText}>Export JSON Backup</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleSelectImportFile}
          disabled={isImporting || isLocked}
          style={[
            styles.actionButton,
            {
              backgroundColor: isLocked ? themeColors.border : themeColors.surfaceSecondary,
              marginTop: 10,
              borderWidth: 1,
              borderColor: themeColors.border,
            },
          ]}
        >
          {isImporting ? (
            <ActivityIndicator color={themeColors.text} size="small" />
          ) : (
            <Text style={[styles.actionButtonText, { color: themeColors.text }]}>Import JSON Backup</Text>
          )}
        </TouchableOpacity>

        {notice && (
          <Text style={[styles.noticeText, { color: themeColors.success }]}>{notice}</Text>
        )}
        {errorMessage && (
          <Text style={[styles.noticeText, { color: '#EF4444' }]}>{errorMessage}</Text>
        )}
      </View>

      {/* Import Preview Modal */}
      {previewEnvelope && (
        <Modal visible transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
              <Text style={[styles.modalTitle, { color: themeColors.text }]}>Import Backup Preview</Text>
              <Text style={[styles.modalSubtitle, { color: themeColors.textSecondary }]}>
                The backup file is valid. Review the contents below:
              </Text>

              <View style={[styles.previewBox, { backgroundColor: themeColors.surfaceSecondary, borderColor: themeColors.border }]}>
                <Text style={[styles.previewLine, { color: themeColors.text }]}>
                  • Categories: {previewEnvelope.categories.length}
                </Text>
                <Text style={[styles.previewLine, { color: themeColors.text }]}>
                  • Topics: {previewEnvelope.topics.length}
                </Text>
                <Text style={[styles.previewLine, { color: themeColors.text }]}>
                  • Topic Tasks: {previewEnvelope.topicTasks.length}
                </Text>
                <Text style={[styles.previewLine, { color: themeColors.text }]}>
                  • Timetable Blocks: {previewEnvelope.timetableBlocks.length}
                </Text>
              </View>

              {!showReplaceConfirm ? (
                <>
                  <Text style={[styles.optionPrompt, { color: themeColors.text }]}>
                    Choose how to apply this backup:
                  </Text>

                  <TouchableOpacity
                    onPress={handleApplyMerge}
                    style={[styles.modalButton, { backgroundColor: themeColors.primary }]}
                  >
                    <Text style={styles.modalButtonText}>Merge with Existing Data</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setShowReplaceConfirm(true)}
                    style={[styles.modalButton, { backgroundColor: '#EF4444', marginTop: 10 }]}
                  >
                    <Text style={styles.modalButtonText}>Replace All Data</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setPreviewEnvelope(null)}
                    style={[styles.cancelButton, { borderColor: themeColors.border, marginTop: 10 }]}
                  >
                    <Text style={[styles.cancelButtonText, { color: themeColors.textSecondary }]}>Cancel</Text>
                  </TouchableOpacity>
                </>
              ) : (
                /* Replace-All Mandatory Safety Confirmation */
                <View style={styles.replaceContainer}>
                  <Text style={[styles.dangerWarning, { color: '#EF4444' }]}>
                    ⚠️ DANGER: Replace-All will erase current data!
                  </Text>
                  <Text style={[styles.safetyText, { color: themeColors.textSecondary }]}>
                    Before replacing, please export an external backup to a safe place.
                  </Text>

                  <TouchableOpacity
                    onPress={handleExport}
                    style={[styles.subActionButton, { backgroundColor: themeColors.surfaceSecondary, borderColor: themeColors.border }]}
                  >
                    <Text style={[styles.subActionText, { color: themeColors.text }]}>Download External Backup Now</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setHasAcknowledgedExternalBackup(!hasAcknowledgedExternalBackup)}
                    style={styles.checkboxRow}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        { borderColor: themeColors.primary, backgroundColor: hasAcknowledgedExternalBackup ? themeColors.primary : 'transparent' },
                      ]}
                    >
                      {hasAcknowledgedExternalBackup && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <Text style={[styles.checkboxLabel, { color: themeColors.text }]}>
                      I have exported and saved a backup file to a safe external location.
                    </Text>
                  </TouchableOpacity>

                  <Text style={[styles.inputLabel, { color: themeColors.text }]}>
                    Type REPLACE in uppercase to confirm:
                  </Text>
                  <TextInput
                    value={typedReplaceText}
                    onChangeText={setTypedReplaceText}
                    placeholder="REPLACE"
                    placeholderTextColor={themeColors.textMuted}
                    autoCapitalize="characters"
                    style={[styles.textInput, { color: themeColors.text, borderColor: themeColors.border, backgroundColor: themeColors.surfaceSecondary }]}
                  />

                  <TouchableOpacity
                    onPress={handleApplyReplaceAll}
                    style={[
                      styles.modalButton,
                      {
                        backgroundColor:
                          hasAcknowledgedExternalBackup && typedReplaceText.trim() === 'REPLACE'
                            ? '#EF4444'
                            : themeColors.border,
                        marginTop: 12,
                      },
                    ]}
                    disabled={!hasAcknowledgedExternalBackup || typedReplaceText.trim() !== 'REPLACE'}
                  >
                    <Text style={styles.modalButtonText}>Confirm & Replace All Data</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      setShowReplaceConfirm(false);
                      setHasAcknowledgedExternalBackup(false);
                      setTypedReplaceText('');
                    }}
                    style={[styles.cancelButton, { borderColor: themeColors.border, marginTop: 10 }]}
                  >
                    <Text style={[styles.cancelButtonText, { color: themeColors.textSecondary }]}>Back to Options</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </Modal>
      )}

      {/* Milestone A Architecture Info */}
      <View style={[styles.section, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
        <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Milestone A: Interactive Core</Text>
        <Text style={[styles.statusText, { color: themeColors.textSecondary }]}>
          ✓ 6 Standard Categories & Official Topics configured
        </Text>
        <Text style={[styles.statusText, { color: themeColors.textSecondary }]}>
          ✓ Full Category & Topic Editing, Priority & Gapped Sort Ordering (1024)
        </Text>
        <Text style={[styles.statusText, { color: themeColors.textSecondary }]}>
          ✓ Dependency-Aware Category Deletion (Cascade or Content Move)
        </Text>
        <Text style={[styles.statusText, { color: themeColors.textSecondary }]}>
          ✓ Topic Tasks CRUD with Completion Tracking & Progress Bars
        </Text>
        <Text style={[styles.statusText, { color: themeColors.textSecondary }]}>
          ✓ Interactive Daily Timetable with Exact Date & Duration Validation
        </Text>
        <Text style={[styles.statusText, { color: themeColors.textSecondary }]}>
          ✓ Step B0 Resilience: Write-lock on Corruption, Verified Export & Schema-Validated Import
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
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
  },
  lockBanner: {
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
  },
  lockTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  lockSubtitle: {
    fontSize: 13,
  },
  section: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  themeButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  actionButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  noticeText: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  statusText: {
    fontSize: 13,
    lineHeight: 20,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 480,
    borderRadius: 12,
    borderWidth: 1,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    marginBottom: 16,
  },
  previewBox: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
  },
  previewLine: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '500',
  },
  optionPrompt: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  modalButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  cancelButton: {
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  replaceContainer: {
    marginTop: 4,
  },
  dangerWarning: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  safetyText: {
    fontSize: 12,
    marginBottom: 10,
  },
  subActionButton: {
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 12,
  },
  subActionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  textInput: {
    height: 40,
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 10,
    fontSize: 14,
    fontWeight: '600',
  },
});
