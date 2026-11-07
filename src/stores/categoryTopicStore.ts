import { create } from 'zustand';
import { Category, Priority } from '../types/category';
import { Topic } from '../types/topic';
import { TopicTask } from '../types/topicTask';
import { TimetableBlock } from '../types/timetable';
import { storageAdapter } from '../services/storage/AsyncStorageAdapter';
import { dateToAppTimestamp } from '../utils/dateHelpers';
import { generateId } from '../utils/idGenerator';
import { useTimetableStore } from './timetableStore';

interface CategoryTopicState {
  categories: Category[];
  topics: Topic[];
  topicTasks: TopicTask[];
  isLoading: boolean;

  // Actions
  loadInitialData: (force?: boolean) => Promise<void>;
  
  // Category Actions
  addCategory: (name: string, priority: Priority, color: string) => Promise<Category>;
  updateCategory: (category: Category) => Promise<void>;
  reorderCategories: (orderedIds: string[]) => Promise<void>;
  moveCategoryOrder: (categoryId: string, direction: 'up' | 'down') => Promise<void>;
  deleteCategoryCascade: (categoryId: string) => Promise<void>;
  moveCategoryContentsAndDelete: (fromCategoryId: string, toCategoryId: string) => Promise<void>;

  // Topic Actions
  addTopic: (categoryId: string, name: string, priority?: Priority) => Promise<Topic>;
  updateTopic: (topic: Topic) => Promise<void>;
  toggleTopicActive: (topicId: string) => Promise<void>;
  reorderTopics: (categoryId: string, orderedIds: string[]) => Promise<void>;
  moveTopicOrder: (topicId: string, direction: 'up' | 'down') => Promise<void>;
  deleteTopic: (topicId: string) => Promise<void>;

  // TopicTask Actions
  addTask: (topicId: string, title: string, priority?: Priority, dueDate?: string | null, notes?: string) => Promise<TopicTask>;
  updateTask: (task: TopicTask) => Promise<void>;
  toggleTaskComplete: (taskId: string) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;

  // Computed Helpers
  getTopicsByCategory: (categoryId: string, includeInactive?: boolean) => Topic[];
  getTasksByTopic: (topicId: string) => TopicTask[];
  getTopicProgress: (topicId: string) => { total: number; completed: number; percentage: number };
}

const PRIORITY_WEIGHTS: Record<Priority, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

export const useCategoryTopicStore = create<CategoryTopicState>((set, get) => ({
  categories: [],
  topics: [],
  topicTasks: [],
  isLoading: true,

  loadInitialData: async (force = false) => {
    if (!force && get().categories.length > 0) {
      return;
    }
    set({ isLoading: true });
    const envelope = await storageAdapter.loadAll();
    set({
      categories: envelope.categories,
      topics: envelope.topics,
      topicTasks: envelope.topicTasks,
      isLoading: false,
    });
  },

  addCategory: async (name, priority, color) => {
    const now = dateToAppTimestamp(new Date());
    const existing = get().categories;
    const maxSort = existing.reduce((max, c) => Math.max(max, c.sortOrder), 0);
    const newCat: Category = {
      id: generateId('cat'),
      name: name.trim(),
      priority,
      sortOrder: maxSort + 1,
      color,
      createdAt: now,
      updatedAt: now,
    };
    const updated = [...existing, newCat];
    set({ categories: updated });
    await storageAdapter.saveCategory(newCat);
    return newCat;
  },

  updateCategory: async (category) => {
    const now = dateToAppTimestamp(new Date());
    const updatedCategory = { ...category, updatedAt: now };
    const updated = get().categories.map((c) => (c.id === category.id ? updatedCategory : c));
    set({ categories: updated });
    await storageAdapter.saveCategory(updatedCategory);
  },

  reorderCategories: async (orderedIds) => {
    const now = dateToAppTimestamp(new Date());
    const updated = get().categories.map((c) => {
      const newOrder = orderedIds.indexOf(c.id);
      return newOrder >= 0 ? { ...c, sortOrder: newOrder + 1, updatedAt: now } : c;
    });
    set({ categories: updated });
    const envelope = await storageAdapter.loadAll();
    envelope.categories = updated;
    await storageAdapter.saveAll(envelope);
  },

  moveCategoryOrder: async (categoryId, direction) => {
    const categories = [...get().categories].sort((a, b) => a.sortOrder - b.sortOrder);
    const index = categories.findIndex((c) => c.id === categoryId);
    if (index < 0) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= categories.length) return;

    const [moved] = categories.splice(index, 1);
    categories.splice(targetIndex, 0, moved);

    const orderedIds = categories.map((c) => c.id);
    await get().reorderCategories(orderedIds);
  },

  deleteCategoryCascade: async (categoryId) => {
    // Cascades: delete category, all topics under it, and all tasks under those topics
    const { topics, topicTasks, categories } = get();
    const topicIdsToDelete = new Set(topics.filter((t) => t.categoryId === categoryId).map((t) => t.id));

    const updatedCategories = categories.filter((c) => c.id !== categoryId);
    const updatedTopics = topics.filter((t) => t.categoryId !== categoryId);
    const updatedTasks = topicTasks.filter((task) => !topicIdsToDelete.has(task.topicId));

    set({
      categories: updatedCategories,
      topics: updatedTopics,
      topicTasks: updatedTasks,
    });

    // Synchronize in-memory timetable store immediately
    useTimetableStore.setState((s) => ({
      blocks: s.blocks.filter((b) => b.categoryId !== categoryId),
    }));

    const envelope = await storageAdapter.loadAll();
    envelope.categories = updatedCategories;
    envelope.topics = updatedTopics;
    envelope.topicTasks = updatedTasks;
    // Also remove timetable blocks tied to this category
    envelope.timetableBlocks = envelope.timetableBlocks.filter((b: TimetableBlock) => b.categoryId !== categoryId);
    await storageAdapter.saveAll(envelope);
  },

  moveCategoryContentsAndDelete: async (fromCategoryId, toCategoryId) => {
    const now = dateToAppTimestamp(new Date());
    const { categories, topics } = get();
    
    // Reassign all topics from fromCategoryId to toCategoryId
    const updatedTopics = topics.map((t) =>
      t.categoryId === fromCategoryId ? { ...t, categoryId: toCategoryId, updatedAt: now } : t
    );
    const updatedCategories = categories.filter((c) => c.id !== fromCategoryId);

    set({ categories: updatedCategories, topics: updatedTopics });

    // Synchronize in-memory timetable store immediately
    useTimetableStore.setState((s) => ({
      blocks: s.blocks.map((b) =>
        b.categoryId === fromCategoryId ? { ...b, categoryId: toCategoryId, updatedAt: now } : b
      ),
    }));

    const envelope = await storageAdapter.loadAll();
    envelope.categories = updatedCategories;
    envelope.topics = updatedTopics;
    // Also reassign timetable blocks
    envelope.timetableBlocks = envelope.timetableBlocks.map((b: TimetableBlock) =>
      b.categoryId === fromCategoryId ? { ...b, categoryId: toCategoryId, updatedAt: now } : b
    );
    await storageAdapter.saveAll(envelope);
  },

  addTopic: async (categoryId, name, priority = 'medium') => {
    const now = dateToAppTimestamp(new Date());
    const existing = get().topics.filter((t) => t.categoryId === categoryId);
    const maxSort = existing.reduce((max, t) => Math.max(max, t.sortOrder), 0);
    const newTopic: Topic = {
      id: generateId('top'),
      categoryId,
      name: name.trim(),
      priority,
      sortOrder: maxSort + 1,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    const updated = [...get().topics, newTopic];
    set({ topics: updated });
    await storageAdapter.saveTopic(newTopic);
    return newTopic;
  },

  updateTopic: async (topic) => {
    const now = dateToAppTimestamp(new Date());
    const updatedTopic = { ...topic, updatedAt: now };
    const updated = get().topics.map((t) => (t.id === topic.id ? updatedTopic : t));
    set({ topics: updated });
    await storageAdapter.saveTopic(updatedTopic);
  },

  toggleTopicActive: async (topicId) => {
    const now = dateToAppTimestamp(new Date());
    const topic = get().topics.find((t) => t.id === topicId);
    if (!topic) return;
    const updatedTopic = { ...topic, isActive: !topic.isActive, updatedAt: now };
    const updated = get().topics.map((t) => (t.id === topicId ? updatedTopic : t));
    set({ topics: updated });
    await storageAdapter.saveTopic(updatedTopic);
  },

  reorderTopics: async (categoryId, orderedIds) => {
    const now = dateToAppTimestamp(new Date());
    const updated = get().topics.map((t) => {
      if (t.categoryId !== categoryId) return t;
      const order = orderedIds.indexOf(t.id);
      return order >= 0 ? { ...t, sortOrder: order + 1, updatedAt: now } : t;
    });
    set({ topics: updated });
    const envelope = await storageAdapter.loadAll();
    envelope.topics = updated;
    await storageAdapter.saveAll(envelope);
  },

  moveTopicOrder: async (topicId, direction) => {
    const topic = get().topics.find((t) => t.id === topicId);
    if (!topic) return;
    const catTopics = get().topics
      .filter((t) => t.categoryId === topic.categoryId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const index = catTopics.findIndex((t) => t.id === topicId);
    if (index < 0) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= catTopics.length) return;

    const [moved] = catTopics.splice(index, 1);
    catTopics.splice(targetIndex, 0, moved);

    const orderedIds = catTopics.map((t) => t.id);
    await get().reorderTopics(topic.categoryId, orderedIds);
  },

  deleteTopic: async (topicId) => {
    const updatedTopics = get().topics.filter((t) => t.id !== topicId);
    const updatedTasks = get().topicTasks.filter((t) => t.topicId !== topicId);
    set({ topics: updatedTopics, topicTasks: updatedTasks });
    await storageAdapter.deleteTopic(topicId);
  },

  addTask: async (topicId, title, priority = 'medium', dueDate = null, notes = '') => {
    const now = dateToAppTimestamp(new Date());
    const newTask: TopicTask = {
      id: generateId('tsk'),
      topicId,
      title: title.trim(),
      dueDate,
      priority,
      isCompleted: false,
      completedAt: null,
      notes,
      createdAt: now,
      updatedAt: now,
    };
    const updated = [...get().topicTasks, newTask];
    set({ topicTasks: updated });
    await storageAdapter.saveTopicTask(newTask);
    return newTask;
  },

  updateTask: async (task) => {
    const now = dateToAppTimestamp(new Date());
    const updatedTask = { ...task, updatedAt: now };
    const updated = get().topicTasks.map((t) => (t.id === task.id ? updatedTask : t));
    set({ topicTasks: updated });
    await storageAdapter.saveTopicTask(updatedTask);
  },

  toggleTaskComplete: async (taskId) => {
    const now = dateToAppTimestamp(new Date());
    const task = get().topicTasks.find((t) => t.id === taskId);
    if (!task) return;
    const nextCompleted = !task.isCompleted;
    const updatedTask: TopicTask = {
      ...task,
      isCompleted: nextCompleted,
      completedAt: nextCompleted ? now : null,
      updatedAt: now,
    };
    const updated = get().topicTasks.map((t) => (t.id === taskId ? updatedTask : t));
    set({ topicTasks: updated });
    await storageAdapter.saveTopicTask(updatedTask);
  },

  deleteTask: async (taskId) => {
    const updated = get().topicTasks.filter((t) => t.id !== taskId);
    set({ topicTasks: updated });
    await storageAdapter.deleteTopicTask(taskId);
  },

  getTopicsByCategory: (categoryId, includeInactive = false) => {
    return get()
      .topics.filter((t) => t.categoryId === categoryId && (includeInactive || t.isActive))
      .sort((a, b) => {
        const pDiff = PRIORITY_WEIGHTS[b.priority] - PRIORITY_WEIGHTS[a.priority];
        if (pDiff !== 0) return pDiff;
        return a.sortOrder - b.sortOrder;
      });
  },

  getTasksByTopic: (topicId) => {
    return get()
      .topicTasks.filter((t) => t.topicId === topicId)
      .sort((a, b) => {
        if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
        const pDiff = PRIORITY_WEIGHTS[b.priority] - PRIORITY_WEIGHTS[a.priority];
        if (pDiff !== 0) return pDiff;
        return a.createdAt.seconds - b.createdAt.seconds;
      });
  },

  getTopicProgress: (topicId) => {
    const tasks = get().topicTasks.filter((t) => t.topicId === topicId);
    const total = tasks.length;
    if (total === 0) return { total: 0, completed: 0, percentage: 0 };
    const completed = tasks.filter((t) => t.isCompleted).length;
    return {
      total,
      completed,
      percentage: Math.round((completed / total) * 100),
    };
  },
}));
