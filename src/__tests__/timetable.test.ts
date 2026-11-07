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
  getNextPendingBlock,
  findRecoverySlot,
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

      // Use 2026-11-16 (unpopulated subsequent week) for clean isolated CRUD assertions
      const block = await timeStore.addBlock({
        title: 'Morning DP Study',
        categoryId: category.id,
        topicId: topic.id,
        taskId: task.id,
        priority: 'high',
        date: '2026-11-16',
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
      const dayBlocks = timeStore.getBlocksForDate('2026-11-16');
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
        date: '2026-11-16',
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
        date: '2026-11-16',
        startTime: '21:00',
        durationMin: 30,
      });

      // Reschedule to tomorrow at 20:00
      await timeStore.rescheduleBlock(block.id, '2026-11-17', '20:00', 45);

      const updated = useTimetableStore.getState().blocks.find((b) => b.id === block.id);
      expect(updated?.date).toBe('2026-11-17');
      expect(updated?.startTime).toBe('20:00');
      expect(updated?.durationMin).toBe(45);

      // Verify queries for old and new dates
      expect(timeStore.getBlocksForDate('2026-11-16').length).toBe(0);
      expect(timeStore.getBlocksForDate('2026-11-17').length).toBe(1);
    });

    it('queries blocks across a weekly date range sorted by date and startTime', async () => {
      const catStore = useCategoryTopicStore.getState();
      const timeStore = useTimetableStore.getState();

      const cat = await catStore.addCategory('Work', 'high', '#EF4444');

      await timeStore.addBlock({
        title: 'Wednesday Work',
        categoryId: cat.id,
        priority: 'high',
        date: '2026-11-18',
        startTime: '10:00',
        durationMin: 60,
      });

      await timeStore.addBlock({
        title: 'Monday Morning',
        categoryId: cat.id,
        priority: 'high',
        date: '2026-11-16',
        startTime: '08:00',
        durationMin: 60,
      });

      await timeStore.addBlock({
        title: 'Monday Afternoon',
        categoryId: cat.id,
        priority: 'medium',
        date: '2026-11-16',
        startTime: '14:00',
        durationMin: 60,
      });

      const rangeBlocks = timeStore.getBlocksForDateRange('2026-11-16', '2026-11-22');
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
        date: '2026-11-16',
        startTime: '12:00',
        durationMin: 30,
      });

      expect(timeStore.getBlocksForDate('2026-11-16').length).toBe(1);

      await timeStore.deleteBlock(block.id);
      expect(timeStore.getBlocksForDate('2026-11-16').length).toBe(0);
    });

    it('persists timetable blocks to storage and survives store reload', async () => {
      const catStore = useCategoryTopicStore.getState();
      const timeStore = useTimetableStore.getState();

      const cat = await catStore.addCategory('Persistent Cat', 'high', '#3B82F6');
      const block = await timeStore.addBlock({
        title: 'Persistent Block',
        categoryId: cat.id,
        priority: 'high',
        date: '2026-11-16',
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

  // 5. Week 1 - Initial Productivity Routine Verification
  describe('5. Week 1 - Initial Productivity Routine Verification', () => {
    it('populates initial Week 1 schedule with 85 blocks across Monday 9 Nov to Friday 13 Nov', () => {
      const timeStore = useTimetableStore.getState();
      const weekDates = ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13'];

      // 17 blocks per day across 5 days = 85 blocks
      for (const d of weekDates) {
        const dayBlocks = timeStore.getBlocksForDate(d);
        expect(dayBlocks.length).toBe(17);

        // Daily total planned time: 885 minutes (14 hours 45 minutes)
        const totalMinutes = dayBlocks.reduce((sum, b) => sum + b.durationMin, 0);
        expect(totalMinutes).toBe(885);

        // Earliest start: 08:00 (Wake time)
        expect(dayBlocks[0].startTime).toBe('08:00');
        expect(dayBlocks[0].title).toBe('Wake up, breakfast and preparation');
        expect(dayBlocks[0].isFixed).toBe(true);

        // Latest activity end: 22:45 (Sleep time)
        const lastBlock = dayBlocks[dayBlocks.length - 1];
        expect(lastBlock.startTime).toBe('22:30');
        expect(lastBlock.durationMin).toBe(15);
        expect(calculateEndTime(lastBlock.startTime, lastBlock.durationMin)).toBe('22:45');
        expect(lastBlock.title).toBe('Prepare for tomorrow');
      }

      // Check weekly query across Nov 9 to Nov 15
      const weekBlocks = timeStore.getBlocksForDateRange('2026-11-09', '2026-11-15');
      expect(weekBlocks.length).toBe(85);
    });

    it('verifies weekday-specific activities across Monday to Friday', () => {
      const timeStore = useTimetableStore.getState();

      // Monday, 9 November: Target countries, SolidWorks practice, Candidex records
      const monBlocks = timeStore.getBlocksForDate('2026-11-09');
      const monOverseas = monBlocks.find((b) => b.startTime === '12:15');
      expect(monOverseas?.notes).toContain('Identify one or two target countries');
      const monTech = monBlocks.find((b) => b.startTime === '14:00');
      expect(monTech?.title).toContain('SolidWorks practice');
      expect(monTech?.notes).toContain('SolidWorks practice');
      const monLater = monBlocks.find((b) => b.startTime === '16:00');
      expect(monLater?.notes).toContain('Update application records in Candidex');

      // Tuesday, 10 November: Automotive employers, ANSYS intro & FEA, German practice & communication
      const tueBlocks = timeStore.getBlocksForDate('2026-11-10');
      const tueOverseas = tueBlocks.find((b) => b.startTime === '12:15');
      expect(tueOverseas?.notes).toContain('Research automotive employers');
      const tueTech = tueBlocks.find((b) => b.startTime === '14:00');
      expect(tueTech?.title).toContain('ANSYS intro');
      expect(tueTech?.notes).toContain('ANSYS introduction and FEA');
      const tueNight = tueBlocks.find((b) => b.startTime === '21:00');
      expect(tueNight?.title).toContain('German practice and communication');
      expect(tueNight?.notes).toContain('German practice and communication');

      // Wednesday, 11 November: Suitable overseas applications, SolidWorks modelling, Explaining automotive project aloud
      const wedBlocks = timeStore.getBlocksForDate('2026-11-11');
      const wedOverseas = wedBlocks.find((b) => b.startTime === '12:15');
      expect(wedOverseas?.notes).toContain('Suitable overseas applications');
      const wedTech = wedBlocks.find((b) => b.startTime === '14:00');
      expect(wedTech?.title).toContain('SolidWorks modelling');
      const wedLater = wedBlocks.find((b) => b.startTime === '16:00');
      expect(wedLater?.notes).toContain('Practise explaining an automotive project aloud');

      // Thursday, 12 November: Visa & eligibility, ANSYS practice, Portfolio improvement
      const thuBlocks = timeStore.getBlocksForDate('2026-11-12');
      const thuOverseas = thuBlocks.find((b) => b.startTime === '12:15');
      expect(thuOverseas?.notes).toContain('Visa and job eligibility requirements');
      const thuTech = thuBlocks.find((b) => b.startTime === '14:00');
      expect(thuTech?.title).toContain('ANSYS practice');
      const thuLater = thuBlocks.find((b) => b.startTime === '16:00');
      expect(thuLater?.title).toContain('Portfolio improvement');

      // Friday, 13 November: Applications and follow-ups, SolidWorks project, Weekly progress review
      const friBlocks = timeStore.getBlocksForDate('2026-11-13');
      const friOverseas = friBlocks.find((b) => b.startTime === '12:15');
      expect(friOverseas?.notes).toContain('Applications and follow-ups');
      const friTech = friBlocks.find((b) => b.startTime === '14:00');
      expect(friTech?.title).toContain('SolidWorks project');
      const friLater = friBlocks.find((b) => b.startTime === '16:00');
      expect(friLater?.title).toContain('Weekly progress review');

      // Daily constant: 20:00–21:00 LEGO block remains identical across all 5 weekdays
      for (const d of ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13']) {
        const lego = timeStore.getBlocksForDate(d).find((b) => b.startTime === '20:00');
        expect(lego?.title).toBe('LEGO McLaren P1');
        expect(lego?.durationMin).toBe(60);
      }
    });

    it('allows editing individual blocks without affecting other days', async () => {
      const timeStore = useTimetableStore.getState();

      const monTech = timeStore.getBlocksForDate('2026-11-09').find((b) => b.startTime === '14:00')!;
      expect(monTech.title).toContain('SolidWorks practice');

      // Edit Monday technical block
      await timeStore.updateBlock({
        ...monTech,
        title: 'SolidWorks Advanced Surfacing',
        notes: 'Deep dive into complex curves',
      });

      // Verify Monday changed
      const updatedMonTech = timeStore.getBlocksForDate('2026-11-09').find((b) => b.startTime === '14:00');
      expect(updatedMonTech?.title).toBe('SolidWorks Advanced Surfacing');
      expect(updatedMonTech?.notes).toBe('Deep dive into complex curves');

      // Verify Tuesday technical block is completely unchanged
      const tueTech = timeStore.getBlocksForDate('2026-11-10').find((b) => b.startTime === '14:00');
      expect(tueTech?.title).toContain('ANSYS intro');
      expect(tueTech?.notes).toBe('ANSYS introduction and FEA.');

      // Verify Wednesday technical block is completely unchanged
      const wedTech = timeStore.getBlocksForDate('2026-11-11').find((b) => b.startTime === '14:00');
      expect(wedTech?.title).toContain('SolidWorks modelling');
    });

    it('preserves completed/skipped status without cascading incomplete blocks', async () => {
      const timeStore = useTimetableStore.getState();

      const monMorning = timeStore.getBlocksForDate('2026-11-09').find((b) => b.startTime === '08:00')!;
      const monJobApps = timeStore.getBlocksForDate('2026-11-09').find((b) => b.startTime === '09:00')!;

      // Complete morning prep, skip job apps
      await timeStore.setBlockStatus(monMorning.id, 'completed');
      await timeStore.setBlockStatus(monJobApps.id, 'skipped');

      // Verify Monday updated
      expect(useTimetableStore.getState().blocks.find((b) => b.id === monMorning.id)?.status).toBe('completed');
      expect(useTimetableStore.getState().blocks.find((b) => b.id === monJobApps.id)?.status).toBe('skipped');

      // Tuesday blocks must remain pending (no cascading of skipped/incomplete activities)
      const tueBlocks = useTimetableStore.getState().getBlocksForDate('2026-11-10');
      for (const b of tueBlocks) {
        expect(b.status).toBe('pending');
      }
    });

    it('allows manual rescheduling of individual blocks without affecting other blocks', async () => {
      const timeStore = useTimetableStore.getState();

      const friLego = timeStore.getBlocksForDate('2026-11-13').find((b) => b.startTime === '20:00')!;
      expect(friLego).toBeDefined();

      // Reschedule Friday LEGO block to Saturday 2026-11-14 at 15:00
      await timeStore.rescheduleBlock(friLego.id, '2026-11-14', '15:00', 90);

      // Verify Friday 20:00 block no longer exists
      expect(timeStore.getBlocksForDate('2026-11-13').find((b) => b.startTime === '20:00')).toBeUndefined();

      // Verify Saturday 15:00 block exists with new duration
      const satBlock = timeStore.getBlocksForDate('2026-11-14').find((b) => b.id === friLego.id);
      expect(satBlock).toBeDefined();
      expect(satBlock?.date).toBe('2026-11-14');
      expect(satBlock?.startTime).toBe('15:00');
      expect(satBlock?.durationMin).toBe(90);

      // Verify Thursday LEGO block is completely untouched
      const thuLego = timeStore.getBlocksForDate('2026-11-12').find((b) => b.startTime === '20:00');
      expect(thuLego?.date).toBe('2026-11-12');
      expect(thuLego?.startTime).toBe('20:00');
    });

    it('detects real-time conflicts against the populated routine and respects priorities', () => {
      const timeStore = useTimetableStore.getState();
      const allBlocks = timeStore.blocks;

      // Propose an interview on Monday 2026-11-09 at 09:30 (during 09:00 - 10:30 Indian job applications)
      const conflicts = findConflictingBlocks(allBlocks, '2026-11-09', '09:30', 45);
      expect(conflicts.length).toBe(1);
      expect(conflicts[0].title).toBe('Indian job applications');

      // Propose an urgent commitment during evening LEGO time (20:15 - 20:45)
      const legoConflicts = findConflictingBlocks(allBlocks, '2026-11-09', '20:15', 30);
      expect(legoConflicts.length).toBe(1);
      expect(legoConflicts[0].title).toBe('LEGO McLaren P1');
      expect(legoConflicts[0].priority).toBe('low'); // User can choose to override lower-priority activity
    });
  });

  // 6. Next Activity Suggestions & Recovery Slot Calculations
  describe('6. Next Activity Suggestions & Recovery Slot Calculations', () => {
    it('identifies the next chronological pending block after skipping', async () => {
      const timeStore = useTimetableStore.getState();
      const monBlocks = timeStore.getBlocksForDate('2026-11-09');

      const jobApps = monBlocks.find((b) => b.startTime === '09:00')!;
      expect(jobApps).toBeDefined();

      // Skip the 09:00 block
      await timeStore.setBlockStatus(jobApps.id, 'skipped');

      // Next pending block should be the 10:30 Break
      const nextBlock1 = getNextPendingBlock(
        useTimetableStore.getState().blocks,
        '2026-11-09',
        jobApps.startTime,
        jobApps.id
      );
      expect(nextBlock1).toBeDefined();
      expect(nextBlock1?.startTime).toBe('10:30');
      expect(nextBlock1?.title).toBe('Break');

      // If 10:30 Break is already completed, next pending block should be 10:45 Overseas job search
      await timeStore.setBlockStatus(nextBlock1!.id, 'completed');
      const nextBlock2 = getNextPendingBlock(
        useTimetableStore.getState().blocks,
        '2026-11-09',
        jobApps.startTime,
        jobApps.id
      );
      expect(nextBlock2).toBeDefined();
      expect(nextBlock2?.startTime).toBe('10:45');
      expect(nextBlock2?.title).toBe('Overseas job search and applications');
    });

    it('finds a conflict-free recovery slot later in the day when available', () => {
      const timeStore = useTimetableStore.getState();
      const allBlocks = timeStore.blocks;

      // Suppose a 30-minute block is skipped at 17:00 (Buffer)
      // Densely scheduled until 22:45, open between 22:45 and 24:00 (75 min free)
      const slot = findRecoverySlot(
        allBlocks,
        '2026-11-09',
        30,
        '17:30',
        'blk_w1_2026-11-09_1700'
      );

      expect(slot).not.toBeNull();
      expect(slot?.startTime).toBe('22:45');
      expect(slot?.endTime).toBe('23:15');
      expect(slot?.durationMin).toBe(30);

      // Verify slot has 0 conflicts
      const conflicts = findConflictingBlocks(allBlocks, '2026-11-09', slot!.startTime, slot!.durationMin);
      expect(conflicts.length).toBe(0);
    });

    it('clearly returns null when no conflict-free recovery slot fits a large duration', () => {
      const timeStore = useTimetableStore.getState();
      const allBlocks = timeStore.blocks;

      // In Week 1 routine, all slots between 10:45 and 22:45 are filled
      // Only 75 min (22:45 to 24:00) is free
      // A 90-minute block skipped at 10:45 cannot fit into remaining 75 min
      const slot = findRecoverySlot(
        allBlocks,
        '2026-11-09',
        90,
        '12:15',
        'blk_w1_2026-11-09_1045'
      );

      expect(slot).toBeNull();
    });

    it('handles end of day with no remaining activities', () => {
      const timeStore = useTimetableStore.getState();
      const allBlocks = timeStore.blocks;

      // Final activity of the day is 22:30 Prepare for tomorrow
      const lastBlock = allBlocks.find(
        (b) => b.date === '2026-11-09' && b.startTime === '22:30'
      )!;
      expect(lastBlock).toBeDefined();

      const nextBlock = getNextPendingBlock(
        allBlocks,
        '2026-11-09',
        lastBlock.startTime,
        lastBlock.id
      );

      // No more upcoming activities on this date
      expect(nextBlock).toBeNull();
    });

    it('dismissing a suggestion preserves skipped status without changing any timetable blocks', async () => {
      const timeStore = useTimetableStore.getState();
      const monLego = timeStore.getBlocksForDate('2026-11-09').find((b) => b.startTime === '20:00')!;

      // Mark skipped
      await timeStore.setBlockStatus(monLego.id, 'skipped');

      // Dismiss suggestion (no reschedule action executed)
      const afterDismiss = useTimetableStore.getState().blocks.find((b) => b.id === monLego.id);
      expect(afterDismiss?.status).toBe('skipped');
      expect(afterDismiss?.startTime).toBe('20:00');
      expect(afterDismiss?.durationMin).toBe(60);

      // Verify no other blocks were altered or shifted
      const otherBlocks = useTimetableStore.getState().getBlocksForDate('2026-11-09').filter((b) => b.id !== monLego.id);
      expect(otherBlocks.length).toBe(16);
      for (const b of otherBlocks) {
        expect(b.status).not.toBe('skipped');
      }
    });

    it('accepting a suggestion reschedules the block, resets status to pending, and persists to storage', async () => {
      const timeStore = useTimetableStore.getState();
      const monGerman = timeStore.getBlocksForDate('2026-11-09').find((b) => b.startTime === '21:00')!;
      expect(monGerman).toBeDefined();

      // 1. Skip
      await timeStore.setBlockStatus(monGerman.id, 'skipped');

      // 2. Find recovery slot (30 min fits at 22:45)
      const slot = findRecoverySlot(
        useTimetableStore.getState().blocks,
        '2026-11-09',
        monGerman.durationMin,
        '21:30',
        monGerman.id
      );
      expect(slot).not.toBeNull();
      expect(slot?.startTime).toBe('22:45');

      // 3. User accepts suggestion: reschedule to slot and reset status to pending
      await timeStore.rescheduleBlock(monGerman.id, '2026-11-09', slot!.startTime, slot!.durationMin);
      await timeStore.setBlockStatus(monGerman.id, 'pending');

      // Verify store updated
      const updated = useTimetableStore.getState().blocks.find((b) => b.id === monGerman.id);
      expect(updated?.startTime).toBe('22:45');
      expect(updated?.durationMin).toBe(30);
      expect(updated?.status).toBe('pending');

      // Verify persisted in storage
      const storageData = await getStorage().loadAll();
      const persisted = storageData.timetableBlocks.find((b) => b.id === monGerman.id);
      expect(persisted?.startTime).toBe('22:45');
      expect(persisted?.status).toBe('pending');
    });

    it('ensures completed and skipped blocks remain unchanged when suggestions are processed', async () => {
      const timeStore = useTimetableStore.getState();

      const b1 = timeStore.getBlocksForDate('2026-11-09').find((b) => b.startTime === '08:00')!;
      const b2 = timeStore.getBlocksForDate('2026-11-09').find((b) => b.startTime === '09:00')!;
      const b3 = timeStore.getBlocksForDate('2026-11-09').find((b) => b.startTime === '10:30')!;

      // b1 is completed, b2 is skipped
      await timeStore.setBlockStatus(b1.id, 'completed');
      await timeStore.setBlockStatus(b2.id, 'skipped');

      // Now skip b3 and identify next / recovery
      await timeStore.setBlockStatus(b3.id, 'skipped');
      const next = getNextPendingBlock(useTimetableStore.getState().blocks, '2026-11-09', b3.startTime, b3.id);
      expect(next?.startTime).toBe('10:45');

      // Assert b1 remains completed, b2 remains skipped, b3 is skipped
      const currentBlocks = useTimetableStore.getState().blocks;
      expect(currentBlocks.find((b) => b.id === b1.id)?.status).toBe('completed');
      expect(currentBlocks.find((b) => b.id === b2.id)?.status).toBe('skipped');
      expect(currentBlocks.find((b) => b.id === b3.id)?.status).toBe('skipped');
    });
  });
});

