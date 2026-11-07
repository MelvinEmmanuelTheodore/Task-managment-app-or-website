import AsyncStorage from '@react-native-async-storage/async-storage';
import { AsyncStorageAdapter } from '../services/storage/AsyncStorageAdapter';
import { useCategoryTopicStore } from '../stores/categoryTopicStore';
import { useTimetableStore } from '../stores/timetableStore';
import { useThemeStore } from '../stores/themeStore';
import {
  dateToAppTimestamp,
  appTimestampToDate,
  appTimestampToMillis,
  appTimestampToISOString,
  formatTimeIST,
} from '../utils/dateHelpers';
import {
  validateStartTime,
  validateDurationMin,
  validateDate,
} from '../utils/timetableValidators';
import { Category } from '../types/category';
import { Topic } from '../types/topic';
import { TopicTask } from '../types/topicTask';
import { TimetableBlock } from '../types/timetable';

describe('Milestone A Audit Verification Suite', () => {
  let adapter: AsyncStorageAdapter;

  beforeEach(async () => {
    await AsyncStorage.clear();
    adapter = new AsyncStorageAdapter();
    // Fresh store initializations
    await useCategoryTopicStore.getState().loadInitialData(true);
    await useTimetableStore.getState().loadInitialBlocks(true);
  });

  // 1. AppTimestamp Pure Serialisation & Round-trip
  describe('1. AppTimestamp Serialisation', () => {
    it('should survive JSON.stringify and JSON.parse without losing data or throwing', () => {
      const originalDate = new Date('2026-11-07T12:00:00.000Z');
      const timestamp = dateToAppTimestamp(originalDate);

      // Verify no functions attached
      expect(typeof (timestamp as any).toDate).toBe('undefined');
      expect(typeof timestamp.seconds).toBe('number');
      expect(typeof timestamp.nanoseconds).toBe('number');

      // JSON round-trip
      const serialized = JSON.stringify(timestamp);
      const parsed = JSON.parse(serialized);

      // Utility conversions on deserialized plain object
      const convertedDate = appTimestampToDate(parsed);
      expect(convertedDate.getTime()).toBe(originalDate.getTime());
      expect(appTimestampToMillis(parsed)).toBe(originalDate.getTime());
      expect(appTimestampToISOString(parsed)).toBe(originalDate.toISOString());
      expect(formatTimeIST(parsed)).toContain('5:30'); // +05:30 IST
    });
  });

  // 2. Storage Concurrency & Write Queue
  describe('2. Storage Concurrency', () => {
    it('should handle rapid concurrent mutations without overwriting or losing records', async () => {
      const now = dateToAppTimestamp(new Date());

      // Launch 8 concurrent category creation writes
      const concurrentWrites = Array.from({ length: 8 }).map((_, i) => {
        const cat: Category = {
          id: `cat_concurrent_${i}`,
          name: `Concurrent Category ${i}`,
          priority: 'medium',
          sortOrder: 10 + i,
          color: '#2563EB',
          createdAt: now,
          updatedAt: now,
        };
        return adapter.saveCategory(cat);
      });

      await Promise.all(concurrentWrites);

      const allCategories = await adapter.getCategories();
      for (let i = 0; i < 8; i++) {
        expect(allCategories.find((c) => c.id === `cat_concurrent_${i}`)).toBeDefined();
      }
    });

    it('should safely serialize multi-record operations (reorder, cascade, and task adds) concurrently', async () => {
      const catStore = useCategoryTopicStore.getState();
      const initialCatIds = catStore.categories.map((c) => c.id);
      const reversedCatIds = [...initialCatIds].reverse();

      // Launch concurrent operations: reorder categories, create a new task, create a new category
      await Promise.all([
        catStore.reorderCategories(reversedCatIds),
        catStore.addTask('top_career_1', 'Concurrent Task 1'),
        catStore.addTask('top_career_1', 'Concurrent Task 2'),
        catStore.addCategory('Concurrent New Cat', 'high', '#059669'),
      ]);

      const storageData = await adapter.loadAll();

      // 1. Verify category reorder was saved
      const careerCat = storageData.categories.find((c) => c.id === initialCatIds[0]);
      expect(careerCat?.sortOrder).toBe(initialCatIds.length);

      // 2. Verify both concurrent tasks were saved without loss
      expect(storageData.topicTasks.some((t) => t.title === 'Concurrent Task 1')).toBe(true);
      expect(storageData.topicTasks.some((t) => t.title === 'Concurrent Task 2')).toBe(true);

      // 3. Verify the new category was saved without loss
      expect(storageData.categories.some((c) => c.name === 'Concurrent New Cat')).toBe(true);
    });
  });

  // 3. Theme Persistence
  describe('3. Theme Persistence', () => {
    it('should persist theme selection to storage and restore it across re-initialization', async () => {
      // 1. Set theme to 'light'
      await useThemeStore.getState().setThemePreference('light');
      expect(useThemeStore.getState().themePreference).toBe('light');

      // 2. Verify settings stored in AsyncStorage
      const settings = await adapter.getSettings();
      expect(settings.theme).toBe('light');

      // 3. Reset in-memory Zustand store to 'dark'
      useThemeStore.setState({ themePreference: 'dark', isInitialized: false });
      expect(useThemeStore.getState().themePreference).toBe('dark');

      // 4. Call initTheme and verify it reloads 'light' from storage
      await useThemeStore.getState().initTheme();
      expect(useThemeStore.getState().themePreference).toBe('light');
    });
  });

  // 4. Category and Topic Editing & Reordering
  describe('4. Category & Topic Editing and Reordering', () => {
    it('should allow renaming category, changing priority and color, and reordering categories', async () => {
      const catStore = useCategoryTopicStore.getState();
      const cat = catStore.categories[0];

      // Edit category
      await catStore.updateCategory({
        ...cat,
        name: 'Advanced Career Coaching',
        priority: 'low',
        color: '#DC2626',
      });

      const updated = useCategoryTopicStore.getState().categories.find((c) => c.id === cat.id);
      expect(updated?.name).toBe('Advanced Career Coaching');
      expect(updated?.priority).toBe('low');
      expect(updated?.color).toBe('#DC2626');

      // Reorder category downwards
      const initialSortOrder = updated?.sortOrder || 0;
      await catStore.moveCategoryOrder(cat.id, 'down');
      const reordered = useCategoryTopicStore.getState().categories.find((c) => c.id === cat.id);
      expect(reordered?.sortOrder).toBeGreaterThan(initialSortOrder);
    });

    it('should allow renaming topic, changing priority, and reordering topics within category', async () => {
      const catStore = useCategoryTopicStore.getState();
      const topic = catStore.topics[0];

      // Edit topic
      await catStore.updateTopic({
        ...topic,
        name: 'Targeting Global EV Automakers',
        priority: 'high',
      });

      const updatedTopic = useCategoryTopicStore.getState().topics.find((t) => t.id === topic.id);
      expect(updatedTopic?.name).toBe('Targeting Global EV Automakers');
      expect(updatedTopic?.priority).toBe('high');

      // Reorder topic downwards
      const initialSort = updatedTopic?.sortOrder || 0;
      await catStore.moveTopicOrder(topic.id, 'down');
      const reorderedTopic = useCategoryTopicStore.getState().topics.find((t) => t.id === topic.id);
      expect(reorderedTopic?.sortOrder).toBeGreaterThan(initialSort);
    });
  });

  // 5. Category Deletion & Dependency Moving
  describe('5. Category Deletion & Moving All Dependencies', () => {
    it('should cascade delete category, topics, topic tasks AND timetable blocks in storage & memory', async () => {
      const catStore = useCategoryTopicStore.getState();
      const timeStore = useTimetableStore.getState();

      const newCat = await catStore.addCategory('Testing Category', 'high', '#059669');
      const newTopic = await catStore.addTopic(newCat.id, 'Testing Topic');
      const newTask = await catStore.addTask(newTopic.id, 'Testing Task');
      const newBlock = await timeStore.addBlock({
        title: 'Testing Block',
        categoryId: newCat.id,
        priority: 'high',
        startTime: '10:00',
        durationMin: 60,
      });

      // Confirm in-memory
      expect(useCategoryTopicStore.getState().categories.some((c) => c.id === newCat.id)).toBe(true);
      expect(useTimetableStore.getState().blocks.some((b) => b.id === newBlock.id)).toBe(true);

      // Perform cascade delete
      await useCategoryTopicStore.getState().deleteCategoryCascade(newCat.id);

      // Verify category, topic, task, and timetable block removed in both stores
      const stateCat = useCategoryTopicStore.getState();
      const stateTime = useTimetableStore.getState();

      expect(stateCat.categories.some((c) => c.id === newCat.id)).toBe(false);
      expect(stateCat.topics.some((t) => t.id === newTopic.id)).toBe(false);
      expect(stateCat.topicTasks.some((t) => t.id === newTask.id)).toBe(false);
      expect(stateTime.blocks.some((b) => b.id === newBlock.id)).toBe(false);

      // Verify also cleaned in persistent storage
      const storageData = await adapter.loadAll();
      expect(storageData.categories.some((c) => c.id === newCat.id)).toBe(false);
      expect(storageData.topics.some((t) => t.id === newTopic.id)).toBe(false);
      expect(storageData.timetableBlocks.some((b) => b.id === newBlock.id)).toBe(false);
    });

    it('should move all topics, tasks, and timetable blocks to another category when moving contents', async () => {
      const catStore = useCategoryTopicStore.getState();
      const timeStore = useTimetableStore.getState();

      const fromCat = await catStore.addCategory('Old Category', 'medium', '#059669');
      const toCat = await catStore.addCategory('Target Category', 'high', '#2563EB');
      const topic = await catStore.addTopic(fromCat.id, 'Movable Topic');
      const task = await catStore.addTask(topic.id, 'Movable Task');
      const block = await timeStore.addBlock({
        title: 'Movable Block',
        categoryId: fromCat.id,
        priority: 'medium',
        startTime: '11:00',
        durationMin: 45,
      });

      // Move contents from fromCat to toCat
      await useCategoryTopicStore.getState().moveCategoryContentsAndDelete(fromCat.id, toCat.id);

      const stateCat = useCategoryTopicStore.getState();
      const stateTime = useTimetableStore.getState();

      // fromCat removed
      expect(stateCat.categories.some((c) => c.id === fromCat.id)).toBe(false);
      // toCat remains
      expect(stateCat.categories.some((c) => c.id === toCat.id)).toBe(true);

      // Topic reassigned to toCat
      const movedTopic = stateCat.topics.find((t) => t.id === topic.id);
      expect(movedTopic?.categoryId).toBe(toCat.id);

      // Timetable block reassigned to toCat in both memory and storage
      const movedBlock = stateTime.blocks.find((b) => b.id === block.id);
      expect(movedBlock?.categoryId).toBe(toCat.id);

      const storageData = await adapter.loadAll();
      const storageBlock = storageData.timetableBlocks.find((b) => b.id === block.id);
      expect(storageBlock?.categoryId).toBe(toCat.id);
    });
  });

  // 6. Task Editing
  describe('6. Task Editing', () => {
    it('should update title, priority, dueDate, and notes on an existing task', async () => {
      const catStore = useCategoryTopicStore.getState();
      const task = await catStore.addTask('top_career_1', 'Initial Task Title', 'low');

      await catStore.updateTask({
        ...task,
        title: 'Updated Polish Portfolio',
        priority: 'high',
        dueDate: '2026-11-25',
        notes: 'Include ANSYS structural simulation renders',
      });

      const updated = useCategoryTopicStore.getState().topicTasks.find((t) => t.id === task.id);
      expect(updated?.title).toBe('Updated Polish Portfolio');
      expect(updated?.priority).toBe('high');
      expect(updated?.dueDate).toBe('2026-11-25');
      expect(updated?.notes).toBe('Include ANSYS structural simulation renders');

      // Verify persistent storage
      const storedTasks = await adapter.getTopicTasks();
      const storedTask = storedTasks.find((t) => t.id === task.id);
      expect(storedTask?.title).toBe('Updated Polish Portfolio');
      expect(storedTask?.priority).toBe('high');
    });
  });

  // 7. Timetable Validation
  describe('7. Timetable Validation', () => {
    it('should validate start time using HH:mm 24-hour format', () => {
      expect(validateStartTime('09:00')).toBe(true);
      expect(validateStartTime('00:00')).toBe(true);
      expect(validateStartTime('23:59')).toBe(true);
      expect(validateStartTime('14:30')).toBe(true);

      expect(validateStartTime('24:00')).toBe(false);
      expect(validateStartTime('9:00')).toBe(false);
      expect(validateStartTime('12:60')).toBe(false);
      expect(validateStartTime('random text')).toBe(false);
      expect(validateStartTime('')).toBe(false);
    });

    it('should validate duration between 5 and 480 minutes', () => {
      expect(validateDurationMin(5)).toBe(true);
      expect(validateDurationMin(60)).toBe(true);
      expect(validateDurationMin(480)).toBe(true);

      expect(validateDurationMin(4)).toBe(false);
      expect(validateDurationMin(481)).toBe(false);
      expect(validateDurationMin(-10)).toBe(false);
      expect(validateDurationMin(NaN)).toBe(false);
    });

    it('should validate actual calendar dates and reject impossible dates and invalid leap years', () => {
      // Valid non-leap February
      expect(validateDate('2026-02-28')).toBe(true);

      // Invalid non-leap year Feb 29
      expect(validateDate('2026-02-29')).toBe(false);

      // Impossible calendar dates
      expect(validateDate('2026-02-31')).toBe(false);
      expect(validateDate('2026-04-31')).toBe(false);

      // Valid leap-year dates
      expect(validateDate('2024-02-29')).toBe(true);
      expect(validateDate('2028-02-29')).toBe(true);

      // General valid dates
      expect(validateDate('2026-11-08')).toBe(true);
      expect(validateDate('2026-01-01')).toBe(true);

      // Malformed / out of range
      expect(validateDate('2026-13-01')).toBe(false);
      expect(validateDate('2026-05-35')).toBe(false);
      expect(validateDate('invalid-date')).toBe(false);
      expect(validateDate('')).toBe(false);
    });
  });
});

