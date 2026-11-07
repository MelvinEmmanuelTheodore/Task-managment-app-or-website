import { create } from 'zustand';
import { Category, Priority } from '../types/category';
import { Topic } from '../types/topic';
import { TopicTask } from '../types/topicTask';
import { TimetableBlock } from '../types/timetable';
import { getStorage } from '../services/storage';
import { dateToAppTimestamp } from '../utils/dateHelpers';
import { generateId } from '../utils/idGenerator';
import { useTimetableStore } from './timetableStore';
import { moveItemOrder, SORT_ORDER_STEP } from '../utils/sortOrder';

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
    const envelope = await getStorage().loadAll();
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
      sortOrder: maxSort + SORT_ORDER_STEP,
      color,
      createdAt: now,
      updatedAt: now,
    };
    const updated = [...existing, newCat];
    set({ categories: updated });
    await getStorage().saveCategory(newCat);
    return newCat;
  },

  updateCategory: async (category) => {
    const now = dateToAppTimestamp(new Date());
    const updatedCategory = { ...category, updatedAt: now };
    const updated = get().categories.map((c) => (c.id === category.id ? updatedCategory : c));
    set({ categories: updated });
    await getStorage().saveCategory(updatedCategory);
  },

  reorderCategories: async (orderedIds) => {
    const now = dateToAppTimestamp(new Date());
    const updated = get().categories.map((c) => {
      const newOrder = orderedIds.indexOf(c.id);
      return newOrder >= 0 ? { ...c, sortOrder: (newOrder + 1) * SORT_ORDER_STEP, updatedAt: now } : c;
    });
    set({ categories: updated });
    await getStorage().reorderCategories(orderedIds);
  },

  moveCategoryOrder: async (categoryId, direction) => {
    const result = moveItemOrder(get().categories, categoryId, direction);
    const now = dateToAppTimestamp(new Date());
    const movedWithTs = { ...result.movedItem, updatedAt: now };

    if (!result.reorderedAll) {
      // O(1) single-item update
      const updated = get().categories.map((c) => (c.id === categoryId ? movedWithTs : c));
      set({ categories: updated });
      await getStorage().saveCategory(movedWithTs);
    } else {
      // Gap collapsed: list re-normalized
      const orderedIds = result.updatedItems.map((c) => c.id);
      set({ categories: result.updatedItems });
      await getStorage().reorderCategories(orderedIds);
    }
  },

  deleteCategoryCascade: async (categoryId) => {
    const updatedEnvelope = await getStorage().deleteCategoryCascade(categoryId);
    set({
      categories: updatedEnvelope.categories,
      topics: updatedEnvelope.topics,
      topicTasks: updatedEnvelope.topicTasks,
    });
    useTimetableStore.getState().setBlocksFromEnvelope(updatedEnvelope.timetableBlocks);
  },

  moveCategoryContentsAndDelete: async (fromCategoryId, toCategoryId) => {
    const updatedEnvelope = await getStorage().moveCategoryContentsAndDelete(fromCategoryId, toCategoryId);
    set({
      categories: updatedEnvelope.categories,
      topics: updatedEnvelope.topics,
      topicTasks: updatedEnvelope.topicTasks,
    });
    useTimetableStore.getState().setBlocksFromEnvelope(updatedEnvelope.timetableBlocks);
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
      sortOrder: maxSort + SORT_ORDER_STEP,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    const updated = [...get().topics, newTopic];
    set({ topics: updated });
    await getStorage().saveTopic(newTopic);
    return newTopic;
  },

  updateTopic: async (topic) => {
    const now = dateToAppTimestamp(new Date());
    const updatedTopic = { ...topic, updatedAt: now };
    const updated = get().topics.map((t) => (t.id === topic.id ? updatedTopic : t));
    set({ topics: updated });
    await getStorage().saveTopic(updatedTopic);
  },

  toggleTopicActive: async (topicId) => {
    const now = dateToAppTimestamp(new Date());
    const topic = get().topics.find((t) => t.id === topicId);
    if (!topic) return;
    const updatedTopic = { ...topic, isActive: !topic.isActive, updatedAt: now };
    const updated = get().topics.map((t) => (t.id === topicId ? updatedTopic : t));
    set({ topics: updated });
    await getStorage().saveTopic(updatedTopic);
  },

  reorderTopics: async (categoryId, orderedIds) => {
    const now = dateToAppTimestamp(new Date());
    const updated = get().topics.map((t) => {
      if (t.categoryId !== categoryId) return t;
      const order = orderedIds.indexOf(t.id);
      return order >= 0 ? { ...t, sortOrder: (order + 1) * SORT_ORDER_STEP, updatedAt: now } : t;
    });
    set({ topics: updated });
    await getStorage().reorderTopics(categoryId, orderedIds);
  },

  moveTopicOrder: async (topicId, direction) => {
    const topic = get().topics.find((t) => t.id === topicId);
    if (!topic) return;
    const catTopics = get().topics.filter((t) => t.categoryId === topic.categoryId);
    const result = moveItemOrder(catTopics, topicId, direction);
    const now = dateToAppTimestamp(new Date());
    const movedWithTs = { ...result.movedItem, updatedAt: now };

    if (!result.reorderedAll) {
      // O(1) single-item update
      const updated = get().topics.map((t) => (t.id === topicId ? movedWithTs : t));
      set({ topics: updated });
      await getStorage().saveTopic(movedWithTs);
    } else {
      // Gap collapsed: list re-normalized
      const orderedIds = result.updatedItems.map((t) => t.id);
      const remainingTopics = get().topics.filter((t) => t.categoryId !== topic.categoryId);
      set({ topics: [...remainingTopics, ...result.updatedItems] });
      await getStorage().reorderTopics(topic.categoryId, orderedIds);
    }
  },

  deleteTopic: async (topicId) => {
    const updatedTopics = get().topics.filter((t) => t.id !== topicId);
    const updatedTasks = get().topicTasks.filter((t) => t.topicId !== topicId);
    set({ topics: updatedTopics, topicTasks: updatedTasks });
    await getStorage().deleteTopic(topicId);
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
    await getStorage().saveTopicTask(newTask);
    return newTask;
  },

  updateTask: async (task) => {
    const now = dateToAppTimestamp(new Date());
    const updatedTask = { ...task, updatedAt: now };
    const updated = get().topicTasks.map((t) => (t.id === task.id ? updatedTask : t));
    set({ topicTasks: updated });
    await getStorage().saveTopicTask(updatedTask);
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
    await getStorage().saveTopicTask(updatedTask);
  },

  deleteTask: async (taskId) => {
    const updated = get().topicTasks.filter((t) => t.id !== taskId);
    set({ topicTasks: updated });
    await getStorage().deleteTopicTask(taskId);
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
