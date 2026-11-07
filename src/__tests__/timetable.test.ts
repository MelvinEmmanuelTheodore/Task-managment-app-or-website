import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTimetableStore } from '../stores/timetableStore';
import { useCategoryTopicStore } from '../stores/categoryTopicStore';
import { getStorage } from '../services/storage';
import {
  timeToMinutes,
  minutesToTime,
  calculateEndTime,
  calculateDuration,
  hasOverlap,
  findConflictingBlocks,
  validateStartTime,
  validateEndTimeFormat,
  validateDurationMin,
  validateDate,
  validateBlockTiming,
} from '../utils/timetableValidators';
import {
  addDays,
  getStartOfWeek,
  getEndOfWeek,
  getWeekDays,
  formatWeekRange,
  getCurrentISTDate,
} from '../utils/dateHelpers';
import { TimetableBlock } from '../types/timetable';

describe('Timetable Core Functionality Suite', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    await useCategoryTopicStore.getState().loadInitialData(true);
    await useTimetableStore.getState().loadInitialBlocks(true);
  });

  // 1. Time Calculations & Validators
  describe('1. Time Calculations & Validators', () => {
    it('converts HH:mm to minutes from midnight and back', () => {
      expect(timeToMinutes('00:00')).toBe(0);
      expect(timeToMinutes('09:30')).toBe(570);
      expect(timeToMinutes('14:45')).toBe(885);
      expect(timeToMinutes('23:59')).toBe(1439);

      expect(minutesToTime(0)).toBe('00:00');
      expect(minutesToTime(570)).toBe('09:30');
      expect(minutesToTime(885)).toBe('14:45');
      expect(minutesToTime(1439)).toBe('23:59');
    });

    it('calculates end time from start time and duration (including 24:00 midnight)', () => {
      expect(calculateEndTime('09:00', 60)).toBe('10:00');
      expect(calculateEndTime('09:30', 45)).toBe('10:15');
      expect(calculateEndTime('23:00', 60)).toBe('24:00'); // same-day midnight end
    });

    it('calculates duration in minutes between start and end times', () => {
      expect(calculateDuration('09:00', '10:00')).toBe(60);
      expect(calculateDuration('09:30', '11:15')).toBe(105);
      expect(calculateDuration('23:00', '24:00')).toBe(60);
      // Inverted or overnight times return 0 (not supported)
      expect(calculateDuration('23:00', '00:30')).toBe(0);
      expect(calculateDuration('10:00', '09:00')).toBe(0);
    });

    it('validates start time format', () => {
      expect(validateStartTime('09:00')).toBe(true);
      expect(validateStartTime('18:45')).toBe(true);
      expect(validateStartTime('24:00')).toBe(false); // start time cannot be 24:00
      expect(validateStartTime('9:00')).toBe(false);
      expect(validateStartTime('invalid')).toBe(false);
    });

    it('validates end time format (accepts 00:00-23:59 and 24:00)', () => {
      expect(validateEndTimeFormat('10:00')).toBe(true);
      expect(validateEndTimeFormat('24:00')).toBe(true);
      expect(validateEndTimeFormat('24:30')).toBe(false);
      expect(validateEndTimeFormat('10:99')).toBe(false);
      expect(validateEndTimeFormat('')).toBe(false);
    });

    it('validates duration bounds (5 to 480 minutes)', () => {
      expect(validateDurationMin(5)).toBe(true);
      expect(validateDurationMin(60)).toBe(true);
      expect(validateDurationMin(480)).toBe(true);
      expect(validateDurationMin(4)).toBe(false);
      expect(validateDurationMin(481)).toBe(false);
      expect(validateDurationMin(60.5)).toBe(false);
    });

    it('validates calendar dates with leap-year handling', () => {
      expect(validateDate('2026-11-09')).toBe(true);
      expect(validateDate('2024-02-29')).toBe(true); // 2024 was leap year
      expect(validateDate('2026-02-29')).toBe(false); // 2026 not leap year
      expect(validateDate('2026-04-31')).toBe(false); // April has 30 days
      expect(validateDate('2026-13-01')).toBe(false); // Invalid month
    });
  });

  // 1b. End-Time, Duration Consistency & Overnight Prevention
  describe('1b. End-Time, Duration Consistency & Overnight Prevention', () => {
    it('accepts valid same-day block timing with matching values', () => {
      const res1 = validateBlockTiming('09:00', '10:00', 60);
      expect(res1.valid).toBe(true);
      expect(res1.startMinutes).toBe(540);
      expect(res1.endMinutes).toBe(600);
      expect(res1.durationMin).toBe(60);

      const res2 = validateBlockTiming('23:00', '24:00', 60);
      expect(res2.valid).toBe(true);
      expect(res2.startMinutes).toBe(1380);
      expect(res2.endMinutes).toBe(1440);
    });

    it('rejects end time that occurs before or at start time (preventing reverse/overnight)', () => {
      const res = validateBlockTiming('09:00', '08:00', 60);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('End time must be after start time on the same day');
      expect(res.error).toContain('Overnight blocks spanning past midnight are not supported');

      const equalRes = validateBlockTiming('09:00', '09:00', 60);
      expect(equalRes.valid).toBe(false);
      expect(equalRes.error).toContain('End time must be after start time on the same day');
    });

    it('rejects blocks that extend past midnight (24:00)', () => {
      // 23:00 with 90 min duration attempts to end at 00:30 next day
      const res = validateBlockTiming('23:00', '00:30', 90);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('Overnight blocks spanning past midnight are not supported');

      // 23:30 with 60 min duration attempts to end at 00:30 next day
      const res2 = validateBlockTiming('23:30', '00:30', 60);
      expect(res2.valid).toBe(false);
      expect(res2.error).toContain('Overnight blocks spanning past midnight are not supported');
    });

    it('rejects and displays clear message when end-time and duration disagree', () => {
      // User entered 09:00 start, 11:00 end, but duration was left at 60m
      const res = validateBlockTiming('09:00', '11:00', 60);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('disagree');
      expect(res.error).toContain('09:00');
      expect(res.error).toContain('11:00');
      expect(res.error).toContain('60m');
      expect(res.error).toContain('expected end time is 10:00');
    });

    it('rejects malformed end time formats', () => {
      const res1 = validateBlockTiming('09:00', '10:99', 60);
      expect(res1.valid).toBe(false);
      expect(res1.error).toContain('End time must be in HH:mm 24-hour format');

      const res2 = validateBlockTiming('09:00', '25:00', 60);
      expect(res2.valid).toBe(false);
      expect(res2.error).toContain('End time must be in HH:mm 24-hour format');
    });

    it('ensures consecutive blocks on midnight boundary do not collide', () => {
      // Block on Nov 9: 23:00 to 24:00 (duration 60)
      const nov9Blocks: TimetableBlock[] = [
        {
          id: 'blk_nov9',
          title: 'Night Review',
          categoryId: 'cat_work',
          priority: 'medium',
          date: '2026-11-09',
          startTime: '23:00',
          durationMin: 60,
          isFixed: false,
          notes: '',
          status: 'pending',
          createdAt: { seconds: 1, nanoseconds: 0 },
          updatedAt: { seconds: 1, nanoseconds: 0 },
        },
      ];

      // Propose block on Nov 10: 00:00 to 01:00
      // Same time window on Nov 10 should find 0 conflicts with Nov 9
      const conflictsNov10 = findConflictingBlocks(nov9Blocks, '2026-11-10', '00:00', 60);
      expect(conflictsNov10.length).toBe(0);

      // Same time window on Nov 9 should find 1 conflict
      const conflictsNov9 = findConflictingBlocks(nov9Blocks, '2026-11-09', '23:30', 30);
      expect(conflictsNov9.length).toBe(1);
    });
  });

  // 2. Overlap & Conflict Detection
  describe('2. Overlap & Conflict Detection', () => {
    it('detects overlapping time blocks accurately', () => {
      // Partially overlapping
      expect(hasOverlap('09:00', 60, '09:30', 60)).toBe(true);
      expect(hasOverlap('09:30', 60, '09:00', 60)).toBe(true);

      // Fully enclosed
      expect(hasOverlap('09:00', 120, '09:30', 30)).toBe(true);
      expect(hasOverlap('09:30', 30, '09:00', 120)).toBe(true);

      // Identical
      expect(hasOverlap('09:00', 60, '09:00', 60)).toBe(true);
    });

    it('considers adjacent blocks as non-overlapping', () => {
      // Block A ends at 10:00, Block B starts at 10:00
      expect(hasOverlap('09:00', 60, '10:00', 60)).toBe(false);
      // Block B ends at 09:00, Block A starts at 09:00
      expect(hasOverlap('10:00', 60, '09:00', 60)).toBe(false);
    });

    it('considers separated blocks as non-overlapping', () => {
      expect(hasOverlap('09:00', 60, '11:00', 60)).toBe(false);
    });

    it('finds conflicting blocks on the target date only', () => {
      const sampleBlocks: TimetableBlock[] = [
        {
          id: 'blk_1',
          title: 'Morning Meeting',
          categoryId: 'cat_work',
          priority: 'high',
          date: '2026-11-09',
          startTime: '09:00',
          durationMin: 60, // 09:00 - 10:00
          isFixed: true,
          notes: '',
          status: 'pending',
          createdAt: { seconds: 1, nanoseconds: 0 },
          updatedAt: { seconds: 1, nanoseconds: 0 },
        },
        {
          id: 'blk_2',
          title: 'Afternoon Focus',
          categoryId: 'cat_work',
          priority: 'medium',
          date: '2026-11-09',
          startTime: '14:00',
          durationMin: 120, // 14:00 - 16:00
          isFixed: false,
          notes: '',
          status: 'pending',
          createdAt: { seconds: 1, nanoseconds: 0 },
          updatedAt: { seconds: 1, nanoseconds: 0 },
        },
        {
          id: 'blk_3',
          title: 'Tomorrow Morning Meeting',
          categoryId: 'cat_work',
          priority: 'high',
          date: '2026-11-10',
          startTime: '09:00',
          durationMin: 60,
          isFixed: false,
          notes: '',
          status: 'pending',
          createdAt: { seconds: 1, nanoseconds: 0 },
          updatedAt: { seconds: 1, nanoseconds: 0 },
        },
        {
          id: 'blk_4',
          title: 'Skipped Task',
          categoryId: 'cat_work',
          priority: 'low',
          date: '2026-11-09',
          startTime: '09:30',
          durationMin: 30,
          isFixed: false,
          notes: '',
          status: 'skipped', // Skipped tasks should not conflict
          createdAt: { seconds: 1, nanoseconds: 0 },
          updatedAt: { seconds: 1, nanoseconds: 0 },
        },
      ];

      // Propose new block: 09:30 - 10:30 on 2026-11-09
      const conflicts = findConflictingBlocks(sampleBlocks, '2026-11-09', '09:30', 60);
      expect(conflicts.length).toBe(1);
      expect(conflicts[0].id).toBe('blk_1');

      // Check self-exclusion when editing blk_1
      const selfConflicts = findConflictingBlocks(sampleBlocks, '2026-11-09', '09:00', 60, 'blk_1');
      expect(selfConflicts.length).toBe(0);

      // Check date filtering: 09:00 on 2026-11-10 should only conflict with blk_3
      const tomorrowConflicts = findConflictingBlocks(sampleBlocks, '2026-11-10', '09:00', 60);
      expect(tomorrowConflicts.length).toBe(1);
      expect(tomorrowConflicts[0].id).toBe('blk_3');
    });
  });

  // 3. Date Navigation & Weekly Calculations
  describe('3. Date Navigation & Weekly Calculations', () => {
    it('adds and subtracts days correctly across month boundaries', () => {
      expect(addDays('2026-11-09', 1)).toBe('2026-11-10');
      expect(addDays('2026-11-09', -1)).toBe('2026-11-08');
      expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
      expect(addDays('2026-11-01', -1)).toBe('2026-10-31');
      expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    });

    it('calculates start and end of week (Monday to Sunday)', () => {
      // 2026-11-09 is a Monday
      expect(getStartOfWeek('2026-11-09')).toBe('2026-11-09');
      expect(getEndOfWeek('2026-11-09')).toBe('2026-11-15');

      // 2026-11-11 is a Wednesday
      expect(getStartOfWeek('2026-11-11')).toBe('2026-11-09');
      expect(getEndOfWeek('2026-11-11')).toBe('2026-11-15');

      // 2026-11-15 is a Sunday
      expect(getStartOfWeek('2026-11-15')).toBe('2026-11-09');
      expect(getEndOfWeek('2026-11-15')).toBe('2026-11-15');
    });

    it('generates 7 week days with names and dates', () => {
      const days = getWeekDays('2026-11-11');
      expect(days.length).toBe(7);
      expect(days[0].dayName).toBe('Mon');
      expect(days[0].date).toBe('2026-11-09');
      expect(days[6].dayName).toBe('Sun');
      expect(days[6].date).toBe('2026-11-15');
    });

    it('formats week ranges for display', () => {
      const range = formatWeekRange('2026-11-09', '2026-11-15');
      expect(range).toContain('Nov');
      expect(range).toContain('9');
      expect(range).toContain('15');
    });
  });

  // 4. Store Operations, Linkages & State Transitions
  describe('4. Store Operations & Linkages', () => {
    it('creates a block linked to category, topic, and task', async () => {
      const catStore = useCategoryTopicStore.getState();
      const timeStore = useTimetableStore.getState();

      const category = await catStore.addCategory('Career Development', 'high', '#2563EB');
      const topic = await catStore.addTopic(category.id, 'Algorithms');
      const task = await catStore.addTask(topic.id, 'Dynamic Programming practice');

      const block = await timeStore.addBlock({
        title: 'Morning DP Study',
        categoryId: category.id,
        topicId: topic.id,
        taskId: task.id,
        priority: 'high',
        date: '2026-11-09',
        startTime: '09:00',
        durationMin: 90,
        isFixed: true,
        notes: 'Solve LeetCode #70 and #198',
        status: 'pending',
      });

      expect(block.id).toBeDefined();
      expect(block.title).toBe('Morning DP Study');
      expect(block.categoryId).toBe(category.id);
      expect(block.topicId).toBe(topic.id);
      expect(block.taskId).toBe(task.id);
      expect(block.isFixed).toBe(true);
      expect(block.status).toBe('pending');

      // Verify in-memory query
      const dayBlocks = timeStore.getBlocksForDate('2026-11-09');
      expect(dayBlocks.length).toBe(1);
      expect(dayBlocks[0].id).toBe(block.id);
    });

    it('updates block status: pending -> completed -> skipped -> pending', async () => {
      const catStore = useCategoryTopicStore.getState();
      const timeStore = useTimetableStore.getState();

      const category = await catStore.addCategory('Health', 'medium', '#10B981');
      const block = await timeStore.addBlock({
        title: 'Workout',
        categoryId: category.id,
        priority: 'medium',
        date: '2026-11-09',
        startTime: '07:00',
        durationMin: 45,
      });

      expect(useTimetableStore.getState().blocks.find((b) => b.id === block.id)?.status).toBe('pending');

      // Mark completed
      await timeStore.setBlockStatus(block.id, 'completed');
      expect(useTimetableStore.getState().blocks.find((b) => b.id === block.id)?.status).toBe('completed');

      // Mark skipped
      await timeStore.setBlockStatus(block.id, 'skipped');
      expect(useTimetableStore.getState().blocks.find((b) => b.id === block.id)?.status).toBe('skipped');

      // Reset to pending
      await timeStore.setBlockStatus(block.id, 'pending');
      expect(useTimetableStore.getState().blocks.find((b) => b.id === block.id)?.status).toBe('pending');
    });

    it('reschedules a block to a new date and time', async () => {
      const catStore = useCategoryTopicStore.getState();
      const timeStore = useTimetableStore.getState();

      const category = await catStore.addCategory('Reading', 'low', '#8B5CF6');
      const block = await timeStore.addBlock({
        title: 'Read Book Chapter',
        categoryId: category.id,
        priority: 'low',
        date: '2026-11-09',
        startTime: '21:00',
        durationMin: 30,
      });

      // Reschedule to tomorrow at 20:00
      await timeStore.rescheduleBlock(block.id, '2026-11-10', '20:00', 45);

      const updated = useTimetableStore.getState().blocks.find((b) => b.id === block.id);
      expect(updated?.date).toBe('2026-11-10');
      expect(updated?.startTime).toBe('20:00');
      expect(updated?.durationMin).toBe(45);

      // Verify queries for old and new dates
      expect(timeStore.getBlocksForDate('2026-11-09').length).toBe(0);
      expect(timeStore.getBlocksForDate('2026-11-10').length).toBe(1);
    });

    it('queries blocks across a weekly date range sorted by date and startTime', async () => {
      const catStore = useCategoryTopicStore.getState();
      const timeStore = useTimetableStore.getState();

      const cat = await catStore.addCategory('Work', 'high', '#EF4444');

      await timeStore.addBlock({
        title: 'Wednesday Work',
        categoryId: cat.id,
        priority: 'high',
        date: '2026-11-11',
        startTime: '10:00',
        durationMin: 60,
      });

      await timeStore.addBlock({
        title: 'Monday Morning',
        categoryId: cat.id,
        priority: 'high',
        date: '2026-11-09',
        startTime: '08:00',
        durationMin: 60,
      });

      await timeStore.addBlock({
        title: 'Monday Afternoon',
        categoryId: cat.id,
        priority: 'medium',
        date: '2026-11-09',
        startTime: '14:00',
        durationMin: 60,
      });

      const rangeBlocks = timeStore.getBlocksForDateRange('2026-11-09', '2026-11-15');
      expect(rangeBlocks.length).toBe(3);
      // Sorted chronologically: Monday 08:00, Monday 14:00, Wednesday 10:00
      expect(rangeBlocks[0].title).toBe('Monday Morning');
      expect(rangeBlocks[1].title).toBe('Monday Afternoon');
      expect(rangeBlocks[2].title).toBe('Wednesday Work');
    });

    it('deletes a timetable block', async () => {
      const catStore = useCategoryTopicStore.getState();
      const timeStore = useTimetableStore.getState();

      const cat = await catStore.addCategory('Misc', 'low', '#6B7280');
      const block = await timeStore.addBlock({
        title: 'Temp Event',
        categoryId: cat.id,
        priority: 'low',
        date: '2026-11-09',
        startTime: '12:00',
        durationMin: 30,
      });

      expect(timeStore.getBlocksForDate('2026-11-09').length).toBe(1);

      await timeStore.deleteBlock(block.id);
      expect(timeStore.getBlocksForDate('2026-11-09').length).toBe(0);
    });

    it('persists timetable blocks to storage and survives store reload', async () => {
      const catStore = useCategoryTopicStore.getState();
      const timeStore = useTimetableStore.getState();

      const cat = await catStore.addCategory('Persistent Cat', 'high', '#3B82F6');
      const block = await timeStore.addBlock({
        title: 'Persistent Block',
        categoryId: cat.id,
        priority: 'high',
        date: '2026-11-09',
        startTime: '11:00',
        durationMin: 60,
        notes: 'Must survive restart',
        status: 'completed',
      });

      // Directly verify storage adapter content
      const storageData = await getStorage().loadAll();
      const storedBlock = storageData.timetableBlocks.find((b) => b.id === block.id);
      expect(storedBlock).toBeDefined();
      expect(storedBlock?.title).toBe('Persistent Block');
      expect(storedBlock?.status).toBe('completed');
      expect(storedBlock?.notes).toBe('Must survive restart');

      // Clear in-memory store state and re-load from storage
      useTimetableStore.setState({ blocks: [] });
      expect(useTimetableStore.getState().blocks.length).toBe(0);

      await useTimetableStore.getState().loadInitialBlocks(true);
      const reloaded = useTimetableStore.getState().blocks.find((b) => b.id === block.id);
      expect(reloaded).toBeDefined();
      expect(reloaded?.title).toBe('Persistent Block');
      expect(reloaded?.status).toBe('completed');
    });
  });
});

