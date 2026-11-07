import { AsyncStorageAdapter } from '../services/storage/AsyncStorageAdapter';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Category } from '../types/category';
import { Topic } from '../types/topic';
import { TopicTask } from '../types/topicTask';
import { TimetableBlock } from '../types/timetable';
import { dateToAppTimestamp } from '../utils/dateHelpers';

describe('AsyncStorageAdapter Unit Tests', () => {
  let adapter: AsyncStorageAdapter;

  beforeEach(async () => {
    await AsyncStorage.clear();
    adapter = new AsyncStorageAdapter();
  });

  it('should initialize default categories and topics on first load', async () => {
    const data = await adapter.loadAll();
    expect(data.schemaVersion).toBe(2);
    expect(data.categories.length).toBe(6);
    expect(data.topics.length).toBeGreaterThan(15);
    expect(data.categories[0].name).toBe('Career');
  });

  it('should save and retrieve a new Category', async () => {
    const now = dateToAppTimestamp(new Date());
    const newCat: Category = {
      id: 'cat_test_cad',
      name: 'Mechanical CAD',
      priority: 'high',
      sortOrder: 7,
      color: '#2563EB',
      createdAt: now,
      updatedAt: now,
    };

    await adapter.saveCategory(newCat);
    const categories = await adapter.getCategories();
    expect(categories.find((c) => c.id === 'cat_test_cad')).toBeDefined();
    expect(categories.find((c) => c.id === 'cat_test_cad')?.name).toBe('Mechanical CAD');
  });

  it('should save, update and delete a TopicTask', async () => {
    const now = dateToAppTimestamp(new Date());
    const task: TopicTask = {
      id: 'tsk_101',
      topicId: 'top_career_1',
      title: 'Apply to 3 automotive firms',
      dueDate: '2026-11-10',
      priority: 'high',
      isCompleted: false,
      completedAt: null,
      notes: 'Send SolidWorks portfolio',
      createdAt: now,
      updatedAt: now,
    };

    await adapter.saveTopicTask(task);
    let tasks = await adapter.getTopicTasks();
    expect(tasks.length).toBe(1);
    expect(tasks[0].title).toBe('Apply to 3 automotive firms');

    // Toggle complete
    task.isCompleted = true;
    task.completedAt = now;
    await adapter.saveTopicTask(task);
    tasks = await adapter.getTopicTasks();
    expect(tasks[0].isCompleted).toBe(true);

    // Delete
    await adapter.deleteTopicTask('tsk_101');
    tasks = await adapter.getTopicTasks();
    expect(tasks.length).toBe(0);
  });

  it('should save and retrieve TimetableBlock with forward-compatible subset fields', async () => {
    const now = dateToAppTimestamp(new Date());
    const block: TimetableBlock = {
      id: 'blk_1',
      title: 'Morning CAD Practice',
      categoryId: 'cat_prof_dev',
      priority: 'high',
      date: '2026-11-08',
      startTime: '09:00',
      durationMin: 120,
      isFixed: true,
      notes: 'FSAE chassis modeling',
      createdAt: now,
      updatedAt: now,
      status: 'pending',
      actualStart: null,
      actualEnd: null,
      actualHistory: [],
    };

    await adapter.saveTimetableBlock(block);
    const blocks = await adapter.getTimetableBlocks();
    expect(blocks.length).toBe(1);
    expect(blocks[0].isFixed).toBe(true);
    expect(blocks[0].durationMin).toBe(120);
  });

  it('should export all data to valid JSON string and import it back cleanly', async () => {
    const exportedJson = await adapter.exportAllData();
    expect(typeof exportedJson).toBe('string');
    const parsed = JSON.parse(exportedJson);
    expect(parsed.schemaVersion).toBe(2);

    // Clean and import
    await AsyncStorage.clear();
    const imported = await adapter.importAllData(exportedJson);
    expect(imported.categories.length).toBe(parsed.categories.length);
  });
});
