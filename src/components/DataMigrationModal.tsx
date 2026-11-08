import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useAppTheme } from '../stores/themeStore';
import { Colors } from '../constants/colors';
import { migrateAllLocalDataToCloud } from '../services/sync/firestoreSyncService';

interface DataMigrationModalProps {
  visible: boolean;
  uid: string;
  blocksCount: number;
  categoriesCount: number;
  topicsCount: number;
  tasksCount: number;
  onSuccess: (result: { blocksCount: number }) => void;
  onDismiss: () => void;
}

export function DataMigrationModal({
  visible,
  uid,
  blocksCount,
  categoriesCount,
  topicsCount,
  tasksCount,
  onSuccess,
  onDismiss,
}: DataMigrationModalProps) {
  const { theme } = useAppTheme();
  const themeColors = Colors[theme];

  const [isMigrating, setIsMigrating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleMigrate = async () => {
    setIsMigrating(true);
    setError(null);
    try {
      const res = await migrateAllLocalDataToCloud(uid);
      setIsMigrating(false);
      onSuccess(res);
    } catch (err: any) {
      setIsMigrating(false);
      setError(err?.message || 'Migration to Cloud Firestore failed.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <View
          style={[
            styles.card,
            { backgroundColor: themeColors.surface, borderColor: themeColors.border },
          ]}
        >
          <Text style={[styles.title, { color: themeColors.text }]}>
            ☁️ Migrate Local Data to Cloud
          </Text>
          <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>
            You signed in with Google. Would you like to upload your existing local timetable schedule
            and task routine to your Cloud Firestore account?
          </Text>

          <View
            style={[
              styles.summaryBox,
              { backgroundColor: themeColors.surfaceSecondary, borderColor: themeColors.border },
            ]}
          >
            <Text style={[styles.summaryItem, { color: themeColors.text }]}>
              📅 Timetable Blocks: <Text style={{ fontWeight: '700' }}>{blocksCount}</Text>
            </Text>
            <Text style={[styles.summaryItem, { color: themeColors.text }]}>
              🗂️ Categories: <Text style={{ fontWeight: '700' }}>{categoriesCount}</Text>
            </Text>
            <Text style={[styles.summaryItem, { color: themeColors.text }]}>
              📁 Topics: <Text style={{ fontWeight: '700' }}>{topicsCount}</Text>
            </Text>
            <Text style={[styles.summaryItem, { color: themeColors.text }]}>
              ✓ Tasks: <Text style={{ fontWeight: '700' }}>{tasksCount}</Text>
            </Text>
          </View>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.actions}>
            <TouchableOpacity
              onPress={onDismiss}
              disabled={isMigrating}
              style={[styles.btn, styles.cancelBtn, { borderColor: themeColors.border }]}
            >
              <Text style={[styles.btnText, { color: themeColors.textSecondary }]}>Not Now</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleMigrate}
              disabled={isMigrating}
              style={[styles.btn, styles.primaryBtn, { backgroundColor: themeColors.primary }]}
            >
              {isMigrating ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={[styles.btnText, { color: '#FFFFFF', fontWeight: '700' }]}>
                  Upload to Cloud
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...Platform.select({
      web: {
        position: 'fixed' as any,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 99999,
      },
      default: {
        flex: 1,
      },
    }),
    backgroundColor: '#00000088',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    borderRadius: 14,
    borderWidth: 1,
    padding: 20,
    ...Platform.select({
      web: {
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
      },
      default: {
        elevation: 8,
      },
    }),
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  summaryBox: {
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
  },
  summaryItem: {
    fontSize: 13,
    marginBottom: 4,
  },
  errorBox: {
    backgroundColor: '#EF444422',
    borderWidth: 1,
    borderColor: '#EF4444',
    padding: 10,
    borderRadius: 8,
    marginBottom: 14,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  btn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: {
    borderWidth: 1,
  },
  primaryBtn: {
    minWidth: 130,
  },
  btnText: {
    fontSize: 13,
  },
});
