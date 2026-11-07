import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
} from 'react-native';
import { useTimetableStore } from '../../src/stores/timetableStore';
import { useCategoryTopicStore } from '../../src/stores/categoryTopicStore';
import { useAppTheme } from '../../src/stores/themeStore';
import { Colors } from '../../src/constants/colors';
import { ConfirmModal } from '../../src/components/ConfirmModal';
import { TimetableBlock } from '../../src/types/timetable';
import { Priority } from '../../src/types/category';
import { formatDateIST } from '../../src/utils/dateHelpers';
import { validateStartTime, validateDurationMin, validateDate } from '../../src/utils/timetableValidators';

export default function TimetableScreen() {
  const { theme } = useAppTheme();
  const themeColors = Colors[theme];

  const { blocks, selectedDate, setSelectedDate, loadInitialBlocks, addBlock, updateBlock, deleteBlock, getBlocksForDate } =
    useTimetableStore();
  const { categories, loadInitialData } = useCategoryTopicStore();

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingBlock, setEditingBlock] = useState<TimetableBlock | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [blockDate, setBlockDate] = useState(selectedDate);
  const [startTime, setStartTime] = useState('09:00');
  const [durationMin, setDurationMin] = useState('60');
  const [isFixed, setIsFixed] = useState(false);
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Delete & Confirmation state
  const [blockToDelete, setBlockToDelete] = useState<TimetableBlock | null>(null);
  const [showRescheduleConfirm, setShowRescheduleConfirm] = useState(false);
  const [pendingBlockUpdate, setPendingBlockUpdate] = useState<TimetableBlock | null>(null);

  useEffect(() => {
    loadInitialData();
    loadInitialBlocks();
  }, []);

  const activeBlocks = getBlocksForDate(selectedDate);

  const resetForm = () => {
    setTitle('');
    setCategoryId(categories[0]?.id || '');
    setPriority('medium');
    setBlockDate(selectedDate);
    setStartTime('09:00');
    setDurationMin('60');
    setIsFixed(false);
    setNotes('');
    setEditingBlock(null);
    setFormError(null);
    setShowAddForm(false);
  };

  const handleOpenEdit = (b: TimetableBlock) => {
    setEditingBlock(b);
    setTitle(b.title);
    setCategoryId(b.categoryId);
    setPriority(b.priority);
    setBlockDate(b.date);
    setStartTime(b.startTime);
    setDurationMin(b.durationMin.toString());
    setIsFixed(b.isFixed);
    setNotes(b.notes || '');
    setFormError(null);
    setShowAddForm(true);
  };

  const handleSaveBlock = async () => {
    setFormError(null);
    if (!title.trim()) {
      setFormError('Block title cannot be empty.');
      return;
    }
    if (!categoryId) {
      setFormError('Please select a category.');
      return;
    }
    if (!validateDate(blockDate)) {
      setFormError('Target date must be formatted as YYYY-MM-DD (e.g. 2026-11-20).');
      return;
    }
    if (!validateStartTime(startTime)) {
      setFormError('Start time must be in HH:mm 24-hour format (e.g. 09:30 or 14:00).');
      return;
    }
    const dur = parseInt(durationMin, 10);
    if (!validateDurationMin(dur)) {
      setFormError('Duration must be an integer between 5 and 480 minutes.');
      return;
    }

    if (editingBlock) {
      // Check if date, time or duration was altered
      const isScheduleChanged =
        editingBlock.startTime !== startTime.trim() ||
        editingBlock.durationMin !== dur ||
        editingBlock.date !== blockDate.trim();

      const updated: TimetableBlock = {
        ...editingBlock,
        title: title.trim(),
        categoryId,
        priority,
        date: blockDate.trim(),
        startTime: startTime.trim(),
        durationMin: dur,
        isFixed,
        notes: notes.trim(),
      };

      if (isScheduleChanged) {
        // Enforce Decision 007: NEVER move or reschedule without explicit confirmation
        setPendingBlockUpdate(updated);
        setShowRescheduleConfirm(true);
      } else {
        await updateBlock(updated);
        resetForm();
      }
    } else {
      await addBlock({
        title: title.trim(),
        categoryId,
        priority,
        date: blockDate.trim(),
        startTime: startTime.trim(),
        durationMin: dur,
        isFixed,
        notes: notes.trim(),
      });
      resetForm();
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: themeColors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: themeColors.text }]}>Daily Timetable</Text>
        <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>
          {formatDateIST(selectedDate)} (IST)
        </Text>
      </View>

      {/* Add / Edit Block Button / Form */}
      {!showAddForm ? (
        <TouchableOpacity
          onPress={() => {
            resetForm();
            setCategoryId(categories[0]?.id || '');
            setShowAddForm(true);
          }}
          style={[styles.primaryButton, { backgroundColor: themeColors.primary }]}
        >
          <Text style={styles.primaryButtonText}>+ Add Schedule Block</Text>
        </TouchableOpacity>
      ) : (
        <View style={[styles.card, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
          <Text style={[styles.formHeading, { color: themeColors.text }]}>
            {editingBlock ? 'Edit Timetable Block' : 'New Timetable Block'}
          </Text>

          {formError && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{formError}</Text>
            </View>
          )}

          <TextInput
            style={[styles.input, { backgroundColor: themeColors.surfaceSecondary, color: themeColors.text, borderColor: themeColors.border }]}
            placeholder="Block Title (e.g. Morning SolidWorks Practice)"
            placeholderTextColor={themeColors.textMuted}
            value={title}
            onChangeText={setTitle}
          />

          {/* Date Picker / Input */}
          <Text style={[styles.label, { color: themeColors.textSecondary }]}>Target Date (YYYY-MM-DD):</Text>
          <TextInput
            style={[styles.input, { backgroundColor: themeColors.surfaceSecondary, color: themeColors.text, borderColor: themeColors.border }]}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={themeColors.textMuted}
            value={blockDate}
            onChangeText={setBlockDate}
          />

          {/* Category Picker */}
          <Text style={[styles.label, { color: themeColors.textSecondary }]}>Category:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
            {categories.map((c) => (
              <TouchableOpacity
                key={c.id}
                onPress={() => setCategoryId(c.id)}
                style={[
                  styles.selectorPill,
                  {
                    backgroundColor: categoryId === c.id ? c.color : themeColors.surfaceSecondary,
                    borderColor: categoryId === c.id ? c.color : themeColors.border,
                  },
                ]}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: categoryId === c.id ? '#FFF' : themeColors.text }}>
                  {c.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Time & Duration Row */}
          <View style={styles.timeDurationRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: themeColors.textSecondary }]}>Start Time (HH:mm):</Text>
              <TextInput
                style={[styles.input, { backgroundColor: themeColors.surfaceSecondary, color: themeColors.text, borderColor: themeColors.border }]}
                placeholder="09:00"
                placeholderTextColor={themeColors.textMuted}
                value={startTime}
                onChangeText={setStartTime}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: themeColors.textSecondary }]}>Duration (5-480 Mins):</Text>
              <TextInput
                style={[styles.input, { backgroundColor: themeColors.surfaceSecondary, color: themeColors.text, borderColor: themeColors.border }]}
                placeholder="60"
                placeholderTextColor={themeColors.textMuted}
                keyboardType="numeric"
                value={durationMin}
                onChangeText={setDurationMin}
              />
            </View>
          </View>

          {/* Fixed Commitment Toggle */}
          <View style={styles.switchRow}>
            <View>
              <Text style={[styles.switchLabel, { color: themeColors.text }]}>Fixed Commitment</Text>
              <Text style={{ fontSize: 12, color: themeColors.textMuted }}>Protected from automatic moves</Text>
            </View>
            <Switch value={isFixed} onValueChange={setIsFixed} />
          </View>

          {/* Optional Notes */}
          <Text style={[styles.label, { color: themeColors.textSecondary }]}>Notes (Optional):</Text>
          <TextInput
            style={[styles.input, { backgroundColor: themeColors.surfaceSecondary, color: themeColors.text, borderColor: themeColors.border }]}
            placeholder="Additional context or goals..."
            placeholderTextColor={themeColors.textMuted}
            value={notes}
            onChangeText={setNotes}
          />

          {/* Actions */}
          <View style={styles.formActions}>
            <TouchableOpacity onPress={resetForm} style={styles.cancelBtn}>
              <Text style={{ color: themeColors.textMuted, fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSaveBlock} style={[styles.saveBtn, { backgroundColor: themeColors.primary }]}>
              <Text style={{ color: '#FFF', fontWeight: '700' }}>{editingBlock ? 'Save Changes' : 'Create Block'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Block Timeline List */}
      <View style={styles.blockList}>
        {activeBlocks.map((b) => {
          const cat = categories.find((c) => c.id === b.categoryId);
          const catColor = cat?.color || '#3B82F6';

          return (
            <View
              key={b.id}
              style={[
                styles.blockCard,
                { backgroundColor: themeColors.surface, borderColor: themeColors.border },
              ]}
            >
              <View style={styles.blockHeader}>
                <View style={styles.timeTag}>
                  <Text style={[styles.blockTime, { color: themeColors.primary }]}>{b.startTime}</Text>
                  <Text style={[styles.blockDuration, { color: themeColors.textMuted }]}>
                    ({b.durationMin}m)
                  </Text>
                </View>

                <View style={styles.badgeCluster}>
                  {b.isFixed && (
                    <View style={styles.fixedBadge}>
                      <Text style={styles.fixedText}>🔒 FIXED</Text>
                    </View>
                  )}
                  {cat && (
                    <View style={[styles.catBadge, { backgroundColor: catColor + '22', borderColor: catColor }]}>
                      <Text style={[styles.catBadgeText, { color: catColor }]}>{cat.name}</Text>
                    </View>
                  )}
                </View>
              </View>

              <Text style={[styles.blockTitleText, { color: themeColors.text }]}>{b.title}</Text>
              {b.notes ? (
                <Text style={[styles.blockNotes, { color: themeColors.textSecondary }]}>{b.notes}</Text>
              ) : null}

              <View style={styles.cardActionsRow}>
                <TouchableOpacity onPress={() => handleOpenEdit(b)} style={styles.editAction}>
                  <Text style={{ color: themeColors.primary, fontSize: 13, fontWeight: '600' }}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setBlockToDelete(b)} style={styles.deleteAction}>
                  <Text style={{ color: themeColors.danger, fontSize: 13, fontWeight: '600' }}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        {activeBlocks.length === 0 && (
          <View style={[styles.emptyCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
            <Text style={[styles.emptyTitle, { color: themeColors.text }]}>No scheduled blocks today</Text>
            <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
              Tap the button above to add custom activities or routine commitments.
            </Text>
          </View>
        )}
      </View>

      <View style={{ height: 40 }} />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        visible={blockToDelete !== null}
        title="Delete Schedule Block"
        message={`Are you sure you want to delete "${blockToDelete?.title}"?`}
        confirmText="Delete"
        isDestructive
        onConfirm={async () => {
          if (blockToDelete) {
            await deleteBlock(blockToDelete.id);
            setBlockToDelete(null);
          }
        }}
        onCancel={() => setBlockToDelete(null)}
      />

      {/* Reschedule Confirmation Modal (Enforcing Decision 007) */}
      <ConfirmModal
        visible={showRescheduleConfirm}
        title="Confirm Schedule Shift"
        message={
          pendingBlockUpdate && editingBlock
            ? `Rescheduling "${pendingBlockUpdate.title}":\n\nFrom: ${editingBlock.date} at ${editingBlock.startTime} (${editingBlock.durationMin}m)\nTo: ${pendingBlockUpdate.date} at ${pendingBlockUpdate.startTime} (${pendingBlockUpdate.durationMin}m)\n\nFixed status: ${pendingBlockUpdate.isFixed ? 'Fixed Commitment' : 'Flexible'}\n\nNote: No other timetable blocks will be automatically moved.`
            : ''
        }
        confirmText="Confirm Reschedule"
        onConfirm={async () => {
          if (pendingBlockUpdate) {
            await updateBlock(pendingBlockUpdate);
            setPendingBlockUpdate(null);
            setShowRescheduleConfirm(false);
            resetForm();
          }
        }}
        onCancel={() => {
          setPendingBlockUpdate(null);
          setShowRescheduleConfirm(false);
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  errorBanner: {
    backgroundColor: '#EF444422',
    borderColor: '#EF4444',
    borderWidth: 1,
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  errorBannerText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '700',
  },
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    marginBottom: 16,
    marginTop: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  primaryButton: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 16,
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  card: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  formHeading: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  input: {
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  pillRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  selectorPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 8,
  },
  timeDurationRow: {
    flexDirection: 'row',
    gap: 12,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 14,
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
  },
  cancelBtn: {
    padding: 8,
  },
  saveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  blockList: {
    gap: 12,
  },
  blockCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  blockHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  timeTag: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  blockTime: {
    fontSize: 16,
    fontWeight: '800',
  },
  blockDuration: {
    fontSize: 12,
    fontWeight: '600',
  },
  badgeCluster: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  fixedBadge: {
    backgroundColor: '#312E81',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  fixedText: {
    color: '#C7D2FE',
    fontSize: 10,
    fontWeight: '800',
  },
  catBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  catBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  blockTitleText: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  blockNotes: {
    fontSize: 13,
    marginBottom: 8,
  },
  cardActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
    marginTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#374151',
    paddingTop: 8,
  },
  editAction: {
    paddingVertical: 4,
  },
  deleteAction: {
    paddingVertical: 4,
  },
  emptyCard: {
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});
