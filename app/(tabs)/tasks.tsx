import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Platform,
} from 'react-native';
import { useTimetableStore } from '../../src/stores/timetableStore';
import { useCategoryTopicStore } from '../../src/stores/categoryTopicStore';
import { useAppTheme } from '../../src/stores/themeStore';
import { Colors } from '../../src/constants/colors';
import { ConfirmModal } from '../../src/components/ConfirmModal';
import { TimetableBlock, BlockStatus } from '../../src/types/timetable';
import { Priority } from '../../src/types/category';
import {
  formatDateIST,
  getCurrentISTDate,
  addDays,
  getStartOfWeek,
  getEndOfWeek,
  getWeekDays,
  formatWeekRange,
} from '../../src/utils/dateHelpers';
import {
  validateStartTime,
  validateDurationMin,
  validateDate,
  validateEndTimeFormat,
  validateBlockTiming,
  calculateEndTime,
  calculateDuration,
  timeToMinutes,
  findConflictingBlocks,
} from '../../src/utils/timetableValidators';

export default function TimetableScreen() {
  const { theme } = useAppTheme();
  const themeColors = Colors[theme];

  const {
    blocks,
    selectedDate,
    setSelectedDate,
    viewMode,
    setViewMode,
    loadInitialBlocks,
    addBlock,
    updateBlock,
    deleteBlock,
    setBlockStatus,
    rescheduleBlock,
    getBlocksForDate,
    getBlocksForDateRange,
  } = useTimetableStore();

  const { categories, topics, topicTasks, loadInitialData } = useCategoryTopicStore();

  // View state
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed' | 'skipped'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingBlock, setEditingBlock] = useState<TimetableBlock | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [topicId, setTopicId] = useState<string>('');
  const [taskId, setTaskId] = useState<string>('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [blockDate, setBlockDate] = useState(selectedDate);
  const [startTime, setStartTime] = useState('09:00');
  const [durationMin, setDurationMin] = useState('60');
  const [endTime, setEndTime] = useState('10:00');
  const [isFixed, setIsFixed] = useState(false);
  const [status, setStatus] = useState<BlockStatus>('pending');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Reschedule Quick Modal State
  const [rescheduleTarget, setRescheduleTarget] = useState<TimetableBlock | null>(null);
  const [rescheduleNewDate, setRescheduleNewDate] = useState('');
  const [rescheduleNewTime, setRescheduleNewTime] = useState('');
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);

  // Delete State
  const [blockToDelete, setBlockToDelete] = useState<TimetableBlock | null>(null);

  useEffect(() => {
    loadInitialData();
    loadInitialBlocks();
  }, []);

  // Update form date when selectedDate changes (if adding fresh)
  useEffect(() => {
    if (!editingBlock) {
      setBlockDate(selectedDate);
    }
  }, [selectedDate, editingBlock]);

  // Available topics for selected category
  const availableTopics = useMemo(() => {
    if (!categoryId) return [];
    return topics.filter((t) => t.categoryId === categoryId && t.isActive);
  }, [topics, categoryId]);

  // Available tasks for selected topic
  const availableTasks = useMemo(() => {
    if (!topicId) return [];
    return topicTasks.filter((task) => task.topicId === topicId);
  }, [topicTasks, topicId]);

  // Active blocks for currently selected date
  const dayBlocks = useMemo(() => {
    return getBlocksForDate(selectedDate);
  }, [blocks, selectedDate]);

  // Filtered blocks for daily view
  const filteredDayBlocks = useMemo(() => {
    if (statusFilter === 'all') return dayBlocks;
    return dayBlocks.filter((b) => {
      const bStatus = b.status || 'pending';
      if (statusFilter === 'completed') return bStatus === 'completed' || bStatus === 'done';
      return bStatus === statusFilter;
    });
  }, [dayBlocks, statusFilter]);

  // Days for the week strip
  const currentWeekDays = useMemo(() => {
    return getWeekDays(selectedDate);
  }, [selectedDate]);

  // Week range start & end
  const weekStart = useMemo(() => getStartOfWeek(selectedDate), [selectedDate]);
  const weekEnd = useMemo(() => getEndOfWeek(selectedDate), [selectedDate]);
  const weekRangeLabel = useMemo(() => formatWeekRange(weekStart, weekEnd), [weekStart, weekEnd]);

  // Blocks across entire active week
  const weekBlocks = useMemo(() => {
    return getBlocksForDateRange(weekStart, weekEnd);
  }, [blocks, weekStart, weekEnd]);

  // Live Overlap / Conflict Detection for the Form
  const formConflicts = useMemo(() => {
    if (!validateStartTime(startTime)) return [];
    const dur = parseInt(durationMin, 10);
    if (!validateDurationMin(dur)) return [];
    return findConflictingBlocks(blocks, blockDate, startTime, dur, editingBlock?.id);
  }, [blocks, blockDate, startTime, durationMin, editingBlock]);

  // Live Overlap / Conflict Detection for Reschedule Modal
  const rescheduleConflicts = useMemo(() => {
    if (!rescheduleTarget || !validateStartTime(rescheduleNewTime)) return [];
    return findConflictingBlocks(
      blocks,
      rescheduleNewDate,
      rescheduleNewTime,
      rescheduleTarget.durationMin,
      rescheduleTarget.id
    );
  }, [blocks, rescheduleTarget, rescheduleNewDate, rescheduleNewTime]);

  // Handlers for form duration / end time synchronization
  const handleStartTimeChange = (newStart: string) => {
    setStartTime(newStart);
    setFormError(null);
    if (validateStartTime(newStart)) {
      const dur = parseInt(durationMin, 10);
      if (validateDurationMin(dur)) {
        const startMins = timeToMinutes(newStart);
        if (startMins + dur > 1440) {
          setFormError('Block cannot extend past midnight (24:00). Overnight blocks spanning past midnight are not supported.');
        } else {
          setEndTime(calculateEndTime(newStart, dur));
        }
      }
    }
  };

  const handleDurationChange = (newDurStr: string) => {
    setDurationMin(newDurStr);
    setFormError(null);
    const dur = parseInt(newDurStr, 10);
    if (validateStartTime(startTime) && validateDurationMin(dur)) {
      const startMins = timeToMinutes(startTime);
      if (startMins + dur > 1440) {
        setFormError('Block cannot extend past midnight (24:00). Overnight blocks spanning past midnight are not supported.');
      } else {
        setEndTime(calculateEndTime(startTime, dur));
      }
    }
  };

  const handleEndTimeChange = (newEnd: string) => {
    setEndTime(newEnd);
    setFormError(null);
    if (!validateStartTime(startTime)) {
      return;
    }
    if (validateEndTimeFormat(newEnd)) {
      const startMins = timeToMinutes(startTime);
      const endMins = timeToMinutes(newEnd);
      if (endMins <= startMins) {
        setFormError('End time must be after start time on the same day. Overnight blocks spanning past midnight are not supported.');
        return;
      }
      if (endMins > 1440) {
        setFormError('Block cannot extend past midnight (24:00). Overnight blocks spanning past midnight are not supported.');
        return;
      }
      const calculated = endMins - startMins;
      if (calculated < 5) {
        setFormError('Duration must be at least 5 minutes.');
      } else if (calculated > 480) {
        setFormError('Duration cannot exceed 480 minutes (8 hours).');
      } else {
        setDurationMin(calculated.toString());
      }
    }
  };

  const resetForm = () => {
    setTitle('');
    const defaultCat = categories[0]?.id || '';
    setCategoryId(defaultCat);
    setTopicId('');
    setTaskId('');
    setPriority(categories[0]?.priority || 'medium');
    setBlockDate(selectedDate);
    setStartTime('09:00');
    setDurationMin('60');
    setEndTime('10:00');
    setIsFixed(false);
    setStatus('pending');
    setNotes('');
    setEditingBlock(null);
    setFormError(null);
    setShowAddModal(false);
  };

  const handleOpenAdd = (prefilledDate?: string) => {
    resetForm();
    if (prefilledDate) {
      setBlockDate(prefilledDate);
    }
    setShowAddModal(true);
  };

  const handleOpenEdit = (b: TimetableBlock) => {
    setEditingBlock(b);
    setTitle(b.title);
    setCategoryId(b.categoryId);
    setTopicId(b.topicId || '');
    setTaskId(b.taskId || '');
    setPriority(b.priority);
    setBlockDate(b.date);
    setStartTime(b.startTime);
    setDurationMin(b.durationMin.toString());
    setEndTime(calculateEndTime(b.startTime, b.durationMin));
    setIsFixed(b.isFixed);
    setStatus(b.status || 'pending');
    setNotes(b.notes || '');
    setFormError(null);
    setShowAddModal(true);
  };

  const handleOpenReschedule = (b: TimetableBlock) => {
    setRescheduleTarget(b);
    setRescheduleNewDate(b.date);
    setRescheduleNewTime(b.startTime);
    setRescheduleError(null);
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
      setFormError('Target date must be a valid calendar date in YYYY-MM-DD format.');
      return;
    }

    const dur = parseInt(durationMin, 10);
    const timingValidation = validateBlockTiming(startTime, endTime, dur);
    if (!timingValidation.valid) {
      setFormError(timingValidation.error || 'Invalid time or duration settings.');
      return;
    }

    if (editingBlock) {
      const updated: TimetableBlock = {
        ...editingBlock,
        title: title.trim(),
        categoryId,
        topicId: topicId || undefined,
        taskId: taskId || undefined,
        priority,
        date: blockDate.trim(),
        startTime: startTime.trim(),
        durationMin: dur,
        isFixed,
        status,
        notes: notes.trim(),
      };
      await updateBlock(updated);
      resetForm();
    } else {
      await addBlock({
        title: title.trim(),
        categoryId,
        topicId: topicId || undefined,
        taskId: taskId || undefined,
        priority,
        date: blockDate.trim(),
        startTime: startTime.trim(),
        durationMin: dur,
        isFixed,
        status,
        notes: notes.trim(),
      });
      resetForm();
    }
  };

  const handleApplyReschedule = async () => {
    setRescheduleError(null);
    if (!rescheduleTarget) return;

    if (!validateDate(rescheduleNewDate)) {
      setRescheduleError('Target date must be a valid YYYY-MM-DD date.');
      return;
    }
    if (!validateStartTime(rescheduleNewTime)) {
      setRescheduleError('Start time must be formatted as HH:mm (00:00 to 23:59).');
      return;
    }

    const startMins = timeToMinutes(rescheduleNewTime);
    if (startMins + rescheduleTarget.durationMin > 1440) {
      setRescheduleError('Block cannot extend past midnight (24:00). Overnight blocks spanning past midnight are not supported.');
      return;
    }

    await rescheduleBlock(rescheduleTarget.id, rescheduleNewDate, rescheduleNewTime);
    setRescheduleTarget(null);
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: themeColors.background }]}>
      {/* Top Header & View Mode Switcher */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: themeColors.text }]}>Timetable</Text>
          <View style={[styles.viewToggleContainer, { backgroundColor: themeColors.surfaceSecondary }]}>
            <TouchableOpacity
              onPress={() => setViewMode('daily')}
              style={[
                styles.viewToggleBtn,
                viewMode === 'daily' && { backgroundColor: themeColors.primary },
              ]}
            >
              <Text
                style={[
                  styles.viewToggleText,
                  { color: viewMode === 'daily' ? '#FFF' : themeColors.textSecondary },
                ]}
              >
                Day
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setViewMode('weekly')}
              style={[
                styles.viewToggleBtn,
                viewMode === 'weekly' && { backgroundColor: themeColors.primary },
              ]}
            >
              <Text
                style={[
                  styles.viewToggleText,
                  { color: viewMode === 'weekly' ? '#FFF' : themeColors.textSecondary },
                ]}
              >
                Week
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ========================================================================= */}
      {/* DAILY VIEW                                                                */}
      {/* ========================================================================= */}
      {viewMode === 'daily' && (
        <View>
          {/* Day Navigator */}
          <View style={[styles.navCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
            <View style={styles.navRow}>
              <TouchableOpacity
                onPress={() => setSelectedDate(addDays(selectedDate, -1))}
                style={[styles.arrowBtn, { borderColor: themeColors.border }]}
              >
                <Text style={[styles.arrowText, { color: themeColors.text }]}>◀</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setSelectedDate(getCurrentISTDate())}
                style={[styles.todayBtn, { backgroundColor: themeColors.surfaceSecondary }]}
              >
                <Text style={[styles.todayBtnText, { color: themeColors.primary }]}>Today</Text>
              </TouchableOpacity>

              <View style={styles.dateDisplay}>
                <Text style={[styles.dateTitle, { color: themeColors.text }]}>
                  {formatDateIST(selectedDate)}
                </Text>
                {selectedDate === getCurrentISTDate() && (
                  <Text style={[styles.todayBadge, { color: themeColors.primary }]}>● Today</Text>
                )}
              </View>

              <TouchableOpacity
                onPress={() => setSelectedDate(addDays(selectedDate, 1))}
                style={[styles.arrowBtn, { borderColor: themeColors.border }]}
              >
                <Text style={[styles.arrowText, { color: themeColors.text }]}>▶</Text>
              </TouchableOpacity>
            </View>

            {/* Quick Week Day Strip */}
            <View style={styles.weekStrip}>
              {currentWeekDays.map((d) => {
                const isSelected = d.date === selectedDate;
                const hasBlocks = blocks.some((b) => b.date === d.date);

                return (
                  <TouchableOpacity
                    key={d.date}
                    onPress={() => setSelectedDate(d.date)}
                    style={[
                      styles.dayStripItem,
                      isSelected && { backgroundColor: themeColors.primary },
                      d.isToday && !isSelected && { borderColor: themeColors.primary, borderWidth: 1 },
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayStripName,
                        { color: isSelected ? '#FFF' : themeColors.textMuted },
                      ]}
                    >
                      {d.dayName}
                    </Text>
                    <Text
                      style={[
                        styles.dayStripNumber,
                        { color: isSelected ? '#FFF' : themeColors.text },
                      ]}
                    >
                      {d.dayNumber}
                    </Text>
                    {hasBlocks && (
                      <View
                        style={[
                          styles.dayStripDot,
                          { backgroundColor: isSelected ? '#FFF' : themeColors.primary },
                        ]}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Action Row & Filter Pills */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              onPress={() => handleOpenAdd(selectedDate)}
              style={[styles.primaryButton, { backgroundColor: themeColors.primary }]}
            >
              <Text style={styles.primaryButtonText}>+ Add Schedule Block</Text>
            </TouchableOpacity>

            {/* Filter Pills */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
              <TouchableOpacity
                onPress={() => setStatusFilter('all')}
                style={[
                  styles.filterPill,
                  statusFilter === 'all'
                    ? { backgroundColor: themeColors.primary }
                    : { backgroundColor: themeColors.surfaceSecondary },
                ]}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: statusFilter === 'all' ? '#FFF' : themeColors.textSecondary }}>
                  All ({dayBlocks.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setStatusFilter('pending')}
                style={[
                  styles.filterPill,
                  statusFilter === 'pending'
                    ? { backgroundColor: '#F59E0B' }
                    : { backgroundColor: themeColors.surfaceSecondary },
                ]}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: statusFilter === 'pending' ? '#FFF' : themeColors.textSecondary }}>
                  Pending ({dayBlocks.filter((b) => (b.status || 'pending') === 'pending').length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setStatusFilter('completed')}
                style={[
                  styles.filterPill,
                  statusFilter === 'completed'
                    ? { backgroundColor: '#10B981' }
                    : { backgroundColor: themeColors.surfaceSecondary },
                ]}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: statusFilter === 'completed' ? '#FFF' : themeColors.textSecondary }}>
                  Completed ({dayBlocks.filter((b) => b.status === 'completed' || b.status === 'done').length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setStatusFilter('skipped')}
                style={[
                  styles.filterPill,
                  statusFilter === 'skipped'
                    ? { backgroundColor: '#6B7280' }
                    : { backgroundColor: themeColors.surfaceSecondary },
                ]}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: statusFilter === 'skipped' ? '#FFF' : themeColors.textSecondary }}>
                  Skipped ({dayBlocks.filter((b) => b.status === 'skipped').length})
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* Daily Blocks Timeline */}
          <View style={styles.blockList}>
            {filteredDayBlocks.map((b) => {
              const cat = categories.find((c) => c.id === b.categoryId);
              const top = topics.find((t) => t.id === b.topicId);
              const tTask = topicTasks.find((task) => task.id === b.taskId);
              const catColor = cat?.color || '#3B82F6';
              const blockStatus = b.status || 'pending';

              // Check if this block has conflicts on this day
              const conflicts = findConflictingBlocks(blocks, b.date, b.startTime, b.durationMin, b.id);
              const hasConflict = conflicts.length > 0;

              return (
                <View
                  key={b.id}
                  style={[
                    styles.blockCard,
                    { backgroundColor: themeColors.surface, borderColor: themeColors.border },
                    hasConflict && { borderColor: '#F59E0B', borderWidth: 1.5 },
                  ]}
                >
                  {/* Top Bar: Time Range, Duration, Badges */}
                  <View style={styles.blockHeader}>
                    <View style={styles.timeTag}>
                      <Text style={[styles.blockTime, { color: themeColors.primary }]}>
                        {b.startTime} – {calculateEndTime(b.startTime, b.durationMin)}
                      </Text>
                      <Text style={[styles.blockDuration, { color: themeColors.textMuted }]}>
                        ({b.durationMin}m)
                      </Text>
                    </View>

                    <View style={styles.badgeCluster}>
                      {hasConflict && (
                        <View style={styles.conflictBadge}>
                          <Text style={styles.conflictBadgeText}>⚠️ Overlap</Text>
                        </View>
                      )}

                      {/* Status Badge */}
                      <View
                        style={[
                          styles.statusBadge,
                          blockStatus === 'completed' || blockStatus === 'done'
                            ? styles.statusCompleted
                            : blockStatus === 'skipped'
                            ? styles.statusSkipped
                            : styles.statusPending,
                        ]}
                      >
                        <Text style={styles.statusBadgeText}>
                          {blockStatus === 'completed' || blockStatus === 'done'
                            ? '✓ Done'
                            : blockStatus === 'skipped'
                            ? '⊘ Skipped'
                            : '● Pending'}
                        </Text>
                      </View>

                      {b.isFixed && (
                        <View style={styles.fixedBadge}>
                          <Text style={styles.fixedText}>🔒 FIXED</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Title */}
                  <Text
                    style={[
                      styles.blockTitleText,
                      { color: themeColors.text },
                      (blockStatus === 'completed' || blockStatus === 'done') && styles.strikeText,
                    ]}
                  >
                    {b.title}
                  </Text>

                  {/* Category, Topic & Task Entity Links */}
                  <View style={styles.entityLinksRow}>
                    {cat && (
                      <View style={[styles.catBadge, { backgroundColor: catColor + '22', borderColor: catColor }]}>
                        <Text style={[styles.catBadgeText, { color: catColor }]}>{cat.name}</Text>
                      </View>
                    )}
                    {top && (
                      <View style={[styles.topicBadge, { backgroundColor: themeColors.surfaceSecondary }]}>
                        <Text style={[styles.topicBadgeText, { color: themeColors.textSecondary }]}>
                          📁 {top.name}
                        </Text>
                      </View>
                    )}
                    {tTask && (
                      <View style={[styles.taskBadge, { backgroundColor: themeColors.surfaceSecondary }]}>
                        <Text style={[styles.taskBadgeText, { color: themeColors.textSecondary }]}>
                          ✓ Task: {tTask.title}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Notes */}
                  {b.notes ? (
                    <Text style={[styles.blockNotes, { color: themeColors.textSecondary }]}>{b.notes}</Text>
                  ) : null}

                  {/* Conflict Explanation if overlapping */}
                  {hasConflict && (
                    <View style={styles.conflictCallout}>
                      <Text style={styles.conflictCalloutText}>
                        Conflicts with {conflicts.map((c) => `"${c.title}" (${c.startTime})`).join(', ')}
                      </Text>
                    </View>
                  )}

                  {/* Action Bar */}
                  <View style={styles.cardActionsRow}>
                    {/* Completion Status Toggles */}
                    <View style={styles.statusActionGroup}>
                      {blockStatus !== 'completed' && blockStatus !== 'done' && (
                        <TouchableOpacity
                          onPress={() => setBlockStatus(b.id, 'completed')}
                          style={[styles.statusToggleBtn, { backgroundColor: '#10B98122' }]}
                        >
                          <Text style={{ color: '#10B981', fontSize: 12, fontWeight: '700' }}>✓ Done</Text>
                        </TouchableOpacity>
                      )}
                      {blockStatus !== 'skipped' && (
                        <TouchableOpacity
                          onPress={() => setBlockStatus(b.id, 'skipped')}
                          style={[styles.statusToggleBtn, { backgroundColor: '#6B728022' }]}
                        >
                          <Text style={{ color: '#6B7280', fontSize: 12, fontWeight: '700' }}>⊘ Skip</Text>
                        </TouchableOpacity>
                      )}
                      {blockStatus !== 'pending' && (
                        <TouchableOpacity
                          onPress={() => setBlockStatus(b.id, 'pending')}
                          style={[styles.statusToggleBtn, { backgroundColor: '#F59E0B22' }]}
                        >
                          <Text style={{ color: '#F59E0B', fontSize: 12, fontWeight: '700' }}>↺ Reset</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Reschedule, Edit, Delete */}
                    <View style={styles.managementActionGroup}>
                      <TouchableOpacity onPress={() => handleOpenReschedule(b)} style={styles.actionBtn}>
                        <Text style={{ color: themeColors.primary, fontSize: 12, fontWeight: '600' }}>Move</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleOpenEdit(b)} style={styles.actionBtn}>
                        <Text style={{ color: themeColors.primary, fontSize: 12, fontWeight: '600' }}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setBlockToDelete(b)} style={styles.actionBtn}>
                        <Text style={{ color: themeColors.danger, fontSize: 12, fontWeight: '600' }}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })}

            {filteredDayBlocks.length === 0 && (
              <View style={[styles.emptyCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
                <Text style={[styles.emptyTitle, { color: themeColors.text }]}>No scheduled blocks</Text>
                <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
                  {statusFilter === 'all'
                    ? 'No blocks scheduled for this date. Tap above to plan your day.'
                    : `No ${statusFilter} blocks found on this date.`}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* ========================================================================= */}
      {/* WEEKLY VIEW                                                               */}
      {/* ========================================================================= */}
      {viewMode === 'weekly' && (
        <View>
          {/* Week Navigator Card */}
          <View style={[styles.navCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
            <View style={styles.navRow}>
              <TouchableOpacity
                onPress={() => setSelectedDate(addDays(selectedDate, -7))}
                style={[styles.arrowBtn, { borderColor: themeColors.border }]}
              >
                <Text style={[styles.arrowText, { color: themeColors.text }]}>◀</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setSelectedDate(getCurrentISTDate())}
                style={[styles.todayBtn, { backgroundColor: themeColors.surfaceSecondary }]}
              >
                <Text style={[styles.todayBtnText, { color: themeColors.primary }]}>Current Week</Text>
              </TouchableOpacity>

              <View style={styles.dateDisplay}>
                <Text style={[styles.dateTitle, { color: themeColors.text }]}>{weekRangeLabel}</Text>
              </View>

              <TouchableOpacity
                onPress={() => setSelectedDate(addDays(selectedDate, 7))}
                style={[styles.arrowBtn, { borderColor: themeColors.border }]}
              >
                <Text style={[styles.arrowText, { color: themeColors.text }]}>▶</Text>
              </TouchableOpacity>
            </View>

            {/* Week Summary Stats */}
            <View style={[styles.weekMetricsRow, { backgroundColor: themeColors.surfaceSecondary }]}>
              <View style={styles.metricItem}>
                <Text style={[styles.metricNumber, { color: themeColors.text }]}>{weekBlocks.length}</Text>
                <Text style={[styles.metricLabel, { color: themeColors.textMuted }]}>Blocks</Text>
              </View>
              <View style={styles.metricDivider} />
              <View style={styles.metricItem}>
                <Text style={[styles.metricNumber, { color: themeColors.primary }]}>
                  {(weekBlocks.reduce((acc, b) => acc + b.durationMin, 0) / 60).toFixed(1)}h
                </Text>
                <Text style={[styles.metricLabel, { color: themeColors.textMuted }]}>Planned Time</Text>
              </View>
              <View style={styles.metricDivider} />
              <View style={styles.metricItem}>
                <Text style={[styles.metricNumber, { color: '#10B981' }]}>
                  {weekBlocks.filter((b) => b.status === 'completed' || b.status === 'done').length}
                </Text>
                <Text style={[styles.metricLabel, { color: themeColors.textMuted }]}>Completed</Text>
              </View>
            </View>
          </View>

          {/* 7 Days of the Week */}
          {currentWeekDays.map((d) => {
            const dayBlocksForDate = blocks
              .filter((b) => b.date === d.date)
              .sort((a, b) => a.startTime.localeCompare(b.startTime));
            const dayMinutes = dayBlocksForDate.reduce((sum, b) => sum + b.durationMin, 0);

            return (
              <View
                key={d.date}
                style={[
                  styles.weekDayCard,
                  { backgroundColor: themeColors.surface, borderColor: themeColors.border },
                  d.isToday && { borderColor: themeColors.primary, borderWidth: 1.5 },
                ]}
              >
                {/* Day Header Row */}
                <View style={styles.weekDayHeader}>
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedDate(d.date);
                      setViewMode('daily');
                    }}
                    style={styles.weekDayTitleGroup}
                  >
                    <Text style={[styles.weekDayName, { color: themeColors.text }]}>
                      {d.dayName}, {formatDateIST(d.date)}
                    </Text>
                    {d.isToday && <Text style={[styles.todayBadge, { color: themeColors.primary }]}>● Today</Text>}
                    <Text style={[styles.weekDayMeta, { color: themeColors.textMuted }]}>
                      {dayBlocksForDate.length} blocks · {(dayMinutes / 60).toFixed(1)}h
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleOpenAdd(d.date)}
                    style={[styles.smallAddBtn, { backgroundColor: themeColors.surfaceSecondary }]}
                  >
                    <Text style={{ color: themeColors.primary, fontSize: 12, fontWeight: '700' }}>+ Add</Text>
                  </TouchableOpacity>
                </View>

                {/* Day's Blocks list */}
                {dayBlocksForDate.length > 0 ? (
                  <View style={styles.weekDayBlocksContainer}>
                    {dayBlocksForDate.map((b) => {
                      const cat = categories.find((c) => c.id === b.categoryId);
                      const catColor = cat?.color || '#3B82F6';
                      const isDone = b.status === 'completed' || b.status === 'done';

                      return (
                        <TouchableOpacity
                          key={b.id}
                          onPress={() => handleOpenEdit(b)}
                          style={[
                            styles.weekMiniBlock,
                            { backgroundColor: themeColors.surfaceSecondary },
                            isDone && { opacity: 0.7 },
                          ]}
                        >
                          <View style={styles.weekMiniLeft}>
                            <View style={[styles.colorIndicator, { backgroundColor: catColor }]} />
                            <Text style={[styles.weekMiniTime, { color: themeColors.primary }]}>
                              {b.startTime} - {calculateEndTime(b.startTime, b.durationMin)}
                            </Text>
                            <Text
                              style={[
                                styles.weekMiniTitle,
                                { color: themeColors.text },
                                isDone && styles.strikeText,
                              ]}
                              numberOfLines={1}
                            >
                              {b.title}
                            </Text>
                          </View>

                          <View style={styles.weekMiniRight}>
                            {b.isFixed && <Text style={{ fontSize: 10 }}>🔒</Text>}
                            {isDone ? (
                              <Text style={{ color: '#10B981', fontSize: 11, fontWeight: '700' }}>✓</Text>
                            ) : b.status === 'skipped' ? (
                              <Text style={{ color: '#6B7280', fontSize: 11, fontWeight: '700' }}>⊘</Text>
                            ) : null}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : (
                  <Text style={[styles.noBlocksText, { color: themeColors.textMuted }]}>
                    No blocks scheduled for this day.
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      )}

      <View style={{ height: 40 }} />

      {/* ========================================================================= */}
      {/* ADD / EDIT BLOCK MODAL                                                    */}
      {/* ========================================================================= */}
      {showAddModal && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.formHeading, { color: themeColors.text }]}>
                {editingBlock ? 'Edit Timetable Block' : 'New Timetable Block'}
              </Text>

              {formError && (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorBannerText}>{formError}</Text>
                </View>
              )}

              {/* Real-time Overlap Conflict Banner */}
              {formConflicts.length > 0 && (
                <View style={styles.conflictBanner}>
                  <Text style={styles.conflictBannerTitle}>⚠️ Time Conflict Detected</Text>
                  <Text style={styles.conflictBannerText}>
                    This block overlaps with {formConflicts.map((c) => `"${c.title}" (${c.startTime})`).join(', ')}.
                    Both blocks will occupy this time.
                  </Text>
                </View>
              )}

              {/* Title Input */}
              <Text style={[styles.label, { color: themeColors.textSecondary }]}>Block Title:</Text>
              <TextInput
                style={[styles.input, { backgroundColor: themeColors.surfaceSecondary, color: themeColors.text, borderColor: themeColors.border }]}
                placeholder="e.g. Morning SolidWorks Practice"
                placeholderTextColor={themeColors.textMuted}
                value={title}
                onChangeText={setTitle}
              />

              {/* Date Input with quick shift */}
              <View style={styles.fieldHeaderRow}>
                <Text style={[styles.label, { color: themeColors.textSecondary }]}>Date (YYYY-MM-DD):</Text>
                <View style={styles.quickDateGroup}>
                  <TouchableOpacity
                    onPress={() => setBlockDate(getCurrentISTDate())}
                    style={[styles.quickDateBtn, { backgroundColor: themeColors.surfaceSecondary }]}
                  >
                    <Text style={{ fontSize: 11, color: themeColors.primary, fontWeight: '700' }}>Today</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setBlockDate(addDays(getCurrentISTDate(), 1))}
                    style={[styles.quickDateBtn, { backgroundColor: themeColors.surfaceSecondary }]}
                  >
                    <Text style={{ fontSize: 11, color: themeColors.primary, fontWeight: '700' }}>Tomorrow</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <TextInput
                style={[styles.input, { backgroundColor: themeColors.surfaceSecondary, color: themeColors.text, borderColor: themeColors.border }]}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={themeColors.textMuted}
                value={blockDate}
                onChangeText={setBlockDate}
              />

              {/* Category Selector */}
              <Text style={[styles.label, { color: themeColors.textSecondary }]}>Category (Required):</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
                {categories.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    onPress={() => {
                      setCategoryId(c.id);
                      setTopicId('');
                      setTaskId('');
                    }}
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

              {/* Topic Selector (Filtered to Category) */}
              {availableTopics.length > 0 && (
                <View>
                  <Text style={[styles.label, { color: themeColors.textSecondary, marginTop: 8 }]}>
                    Link to Topic (Optional):
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
                    <TouchableOpacity
                      onPress={() => {
                        setTopicId('');
                        setTaskId('');
                      }}
                      style={[
                        styles.selectorPill,
                        {
                          backgroundColor: !topicId ? themeColors.primary : themeColors.surfaceSecondary,
                          borderColor: !topicId ? themeColors.primary : themeColors.border,
                        },
                      ]}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '700', color: !topicId ? '#FFF' : themeColors.textSecondary }}>
                        None
                      </Text>
                    </TouchableOpacity>

                    {availableTopics.map((t) => (
                      <TouchableOpacity
                        key={t.id}
                        onPress={() => {
                          setTopicId(t.id);
                          setTaskId('');
                        }}
                        style={[
                          styles.selectorPill,
                          {
                            backgroundColor: topicId === t.id ? themeColors.primary : themeColors.surfaceSecondary,
                            borderColor: topicId === t.id ? themeColors.primary : themeColors.border,
                          },
                        ]}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '700', color: topicId === t.id ? '#FFF' : themeColors.text }}>
                          {t.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Task Selector (Filtered to Topic) */}
              {availableTasks.length > 0 && (
                <View>
                  <Text style={[styles.label, { color: themeColors.textSecondary, marginTop: 8 }]}>
                    Link to Specific Task (Optional):
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
                    <TouchableOpacity
                      onPress={() => setTaskId('')}
                      style={[
                        styles.selectorPill,
                        {
                          backgroundColor: !taskId ? themeColors.primary : themeColors.surfaceSecondary,
                          borderColor: !taskId ? themeColors.primary : themeColors.border,
                        },
                      ]}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '700', color: !taskId ? '#FFF' : themeColors.textSecondary }}>
                        None
                      </Text>
                    </TouchableOpacity>

                    {availableTasks.map((task) => (
                      <TouchableOpacity
                        key={task.id}
                        onPress={() => {
                          setTaskId(task.id);
                          if (!title.trim()) {
                            setTitle(task.title);
                          }
                        }}
                        style={[
                          styles.selectorPill,
                          {
                            backgroundColor: taskId === task.id ? themeColors.primary : themeColors.surfaceSecondary,
                            borderColor: taskId === task.id ? themeColors.primary : themeColors.border,
                          },
                        ]}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '700', color: taskId === task.id ? '#FFF' : themeColors.text }}>
                          {task.title}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Time & Duration Controls */}
              <View style={styles.timeInputsRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={[styles.label, { color: themeColors.textSecondary }]}>Start Time:</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: themeColors.surfaceSecondary, color: themeColors.text, borderColor: themeColors.border }]}
                    placeholder="09:00"
                    placeholderTextColor={themeColors.textMuted}
                    value={startTime}
                    onChangeText={handleStartTimeChange}
                  />
                </View>

                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={[styles.label, { color: themeColors.textSecondary }]}>End Time:</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: themeColors.surfaceSecondary, color: themeColors.text, borderColor: themeColors.border }]}
                    placeholder="10:00"
                    placeholderTextColor={themeColors.textMuted}
                    value={endTime}
                    onChangeText={handleEndTimeChange}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: themeColors.textSecondary }]}>Duration (min):</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: themeColors.surfaceSecondary, color: themeColors.text, borderColor: themeColors.border }]}
                    placeholder="60"
                    keyboardType="numeric"
                    placeholderTextColor={themeColors.textMuted}
                    value={durationMin}
                    onChangeText={handleDurationChange}
                  />
                </View>
              </View>

              {/* Priority & Status Row */}
              <View style={styles.timeInputsRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={[styles.label, { color: themeColors.textSecondary }]}>Priority:</Text>
                  <View style={styles.segmentedRow}>
                    {(['high', 'medium', 'low'] as Priority[]).map((p) => (
                      <TouchableOpacity
                        key={p}
                        onPress={() => setPriority(p)}
                        style={[
                          styles.segmentedBtn,
                          priority === p && { backgroundColor: themeColors.primary },
                        ]}
                      >
                        <Text style={{ fontSize: 11, fontWeight: '700', color: priority === p ? '#FFF' : themeColors.textSecondary }}>
                          {p.toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: themeColors.textSecondary }]}>Status:</Text>
                  <View style={styles.segmentedRow}>
                    {(['pending', 'completed', 'skipped'] as BlockStatus[]).map((s) => (
                      <TouchableOpacity
                        key={s}
                        onPress={() => setStatus(s)}
                        style={[
                          styles.segmentedBtn,
                          status === s && { backgroundColor: themeColors.primary },
                        ]}
                      >
                        <Text style={{ fontSize: 11, fontWeight: '700', color: status === s ? '#FFF' : themeColors.textSecondary }}>
                          {s}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              {/* Fixed Commitment Toggle */}
              <View style={styles.switchRow}>
                <View>
                  <Text style={[styles.switchLabel, { color: themeColors.text }]}>Fixed Commitment</Text>
                  <Text style={{ fontSize: 12, color: themeColors.textMuted }}>Protected commitment flag</Text>
                </View>
                <Switch value={isFixed} onValueChange={setIsFixed} />
              </View>

              {/* Optional Notes */}
              <Text style={[styles.label, { color: themeColors.textSecondary }]}>Notes (Optional):</Text>
              <TextInput
                style={[styles.input, { backgroundColor: themeColors.surfaceSecondary, color: themeColors.text, borderColor: themeColors.border }]}
                placeholder="Goals, preparation or details..."
                placeholderTextColor={themeColors.textMuted}
                value={notes}
                onChangeText={setNotes}
              />

              {/* Form Buttons */}
              <View style={styles.formActions}>
                <TouchableOpacity onPress={resetForm} style={styles.cancelBtn}>
                  <Text style={{ color: themeColors.textMuted, fontWeight: '600' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSaveBlock}
                  style={[styles.saveBtn, { backgroundColor: themeColors.primary }]}
                >
                  <Text style={{ color: '#FFF', fontWeight: '700' }}>
                    {editingBlock ? 'Save Changes' : 'Create Block'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      )}

      {/* ========================================================================= */}
      {/* QUICK RESCHEDULE MODAL                                                    */}
      {/* ========================================================================= */}
      {rescheduleTarget && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
            <Text style={[styles.formHeading, { color: themeColors.text }]}>
              Reschedule "{rescheduleTarget.title}"
            </Text>

            {rescheduleError && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{rescheduleError}</Text>
              </View>
            )}

            {rescheduleConflicts.length > 0 && (
              <View style={styles.conflictBanner}>
                <Text style={styles.conflictBannerTitle}>⚠️ Conflict Warning</Text>
                <Text style={styles.conflictBannerText}>
                  Conflicts with {rescheduleConflicts.map((c) => `"${c.title}" (${c.startTime})`).join(', ')}.
                </Text>
              </View>
            )}

            <Text style={[styles.label, { color: themeColors.textSecondary }]}>New Date (YYYY-MM-DD):</Text>
            <View style={styles.quickDateGroup}>
              <TouchableOpacity
                onPress={() => setRescheduleNewDate(getCurrentISTDate())}
                style={[styles.quickDateBtn, { backgroundColor: themeColors.surfaceSecondary }]}
              >
                <Text style={{ fontSize: 11, color: themeColors.primary, fontWeight: '700' }}>Today</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setRescheduleNewDate(addDays(getCurrentISTDate(), 1))}
                style={[styles.quickDateBtn, { backgroundColor: themeColors.surfaceSecondary }]}
              >
                <Text style={{ fontSize: 11, color: themeColors.primary, fontWeight: '700' }}>Tomorrow</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setRescheduleNewDate(addDays(rescheduleTarget.date, 7))}
                style={[styles.quickDateBtn, { backgroundColor: themeColors.surfaceSecondary }]}
              >
                <Text style={{ fontSize: 11, color: themeColors.primary, fontWeight: '700' }}>+1 Week</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.input, { backgroundColor: themeColors.surfaceSecondary, color: themeColors.text, borderColor: themeColors.border }]}
              value={rescheduleNewDate}
              onChangeText={setRescheduleNewDate}
            />

            <Text style={[styles.label, { color: themeColors.textSecondary }]}>New Start Time (HH:mm):</Text>
            <TextInput
              style={[styles.input, { backgroundColor: themeColors.surfaceSecondary, color: themeColors.text, borderColor: themeColors.border }]}
              value={rescheduleNewTime}
              onChangeText={setRescheduleNewTime}
            />

            <View style={styles.formActions}>
              <TouchableOpacity onPress={() => setRescheduleTarget(null)} style={styles.cancelBtn}>
                <Text style={{ color: themeColors.textMuted, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleApplyReschedule}
                style={[styles.saveBtn, { backgroundColor: themeColors.primary }]}
              >
                <Text style={{ color: '#FFF', fontWeight: '700' }}>Confirm Move</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
  },
  viewToggleContainer: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 3,
  },
  viewToggleBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
  },
  viewToggleText: {
    fontSize: 13,
    fontWeight: '700',
  },
  navCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 14,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  arrowBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowText: {
    fontSize: 14,
    fontWeight: '700',
  },
  todayBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  todayBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  dateDisplay: {
    alignItems: 'center',
  },
  dateTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  todayBadge: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  weekStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#37415122',
  },
  dayStripItem: {
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    minWidth: 40,
  },
  dayStripName: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
  },
  dayStripNumber: {
    fontSize: 14,
    fontWeight: '700',
  },
  dayStripDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 3,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginRight: 10,
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  filterScroll: {
    flex: 1,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
  },
  blockList: {
    marginBottom: 20,
  },
  blockCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  blockHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  timeTag: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  blockTime: {
    fontSize: 14,
    fontWeight: '800',
  },
  blockDuration: {
    fontSize: 12,
    marginLeft: 6,
  },
  badgeCluster: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  conflictBadge: {
    backgroundColor: '#F59E0B22',
    borderColor: '#F59E0B',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 6,
  },
  conflictBadgeText: {
    color: '#F59E0B',
    fontSize: 10,
    fontWeight: '700',
  },
  statusBadge: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 6,
  },
  statusPending: {
    backgroundColor: '#F59E0B22',
  },
  statusCompleted: {
    backgroundColor: '#10B98122',
  },
  statusSkipped: {
    backgroundColor: '#6B728022',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  fixedBadge: {
    backgroundColor: '#37415122',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  fixedText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  blockTitleText: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  strikeText: {
    textDecorationLine: 'line-through',
    opacity: 0.7,
  },
  entityLinksRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  catBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    marginRight: 6,
    marginBottom: 4,
  },
  catBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  topicBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginRight: 6,
    marginBottom: 4,
  },
  topicBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  taskBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginRight: 6,
    marginBottom: 4,
  },
  taskBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  blockNotes: {
    fontSize: 13,
    marginBottom: 8,
    fontStyle: 'italic',
  },
  conflictCallout: {
    backgroundColor: '#F59E0B15',
    padding: 8,
    borderRadius: 6,
    marginBottom: 8,
  },
  conflictCalloutText: {
    color: '#D97706',
    fontSize: 12,
    fontWeight: '600',
  },
  cardActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#37415122',
  },
  statusActionGroup: {
    flexDirection: 'row',
  },
  statusToggleBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 6,
  },
  managementActionGroup: {
    flexDirection: 'row',
  },
  actionBtn: {
    marginLeft: 12,
  },
  weekMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 12,
  },
  metricItem: {
    alignItems: 'center',
  },
  metricNumber: {
    fontSize: 16,
    fontWeight: '800',
  },
  metricLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#37415133',
  },
  weekDayCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  weekDayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  weekDayTitleGroup: {
    flex: 1,
  },
  weekDayName: {
    fontSize: 15,
    fontWeight: '700',
  },
  weekDayMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  smallAddBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  weekDayBlocksContainer: {
    marginTop: 4,
  },
  weekMiniBlock: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 8,
    borderRadius: 6,
    marginBottom: 6,
  },
  weekMiniLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  colorIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  weekMiniTime: {
    fontSize: 12,
    fontWeight: '700',
    marginRight: 8,
  },
  weekMiniTitle: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  weekMiniRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  noBlocksText: {
    fontSize: 12,
    fontStyle: 'italic',
    paddingVertical: 6,
  },
  emptyCard: {
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#00000077',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    zIndex: 999,
  },
  modalCard: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '90%',
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
  formHeading: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 14,
  },
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
  conflictBanner: {
    backgroundColor: '#F59E0B22',
    borderColor: '#F59E0B',
    borderWidth: 1,
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  conflictBannerTitle: {
    color: '#D97706',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 2,
  },
  conflictBannerText: {
    color: '#D97706',
    fontSize: 11,
    fontWeight: '600',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  fieldHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quickDateGroup: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  quickDateBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginLeft: 6,
  },
  input: {
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
    marginBottom: 12,
  },
  pillRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  selectorPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 8,
  },
  timeInputsRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  segmentedRow: {
    flexDirection: 'row',
    backgroundColor: '#37415122',
    borderRadius: 6,
    padding: 2,
    marginBottom: 12,
  },
  segmentedBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 4,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    marginBottom: 10,
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#37415122',
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 12,
  },
  saveBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
});
