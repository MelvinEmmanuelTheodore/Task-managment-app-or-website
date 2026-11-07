import { create } from 'zustand';
import { TimetableBlock, BlockStatus } from '../types/timetable';
import { getStorage } from '../services/storage';
import { dateToAppTimestamp, getCurrentISTDate } from '../utils/dateHelpers';
import { generateId } from '../utils/idGenerator';
import { Priority } from '../types/category';
import { findConflictingBlocks } from '../utils/timetableValidators';

export interface AddBlockParams {
  title: string;
  categoryId: string;
  priority: Priority;
  startTime: string;
  durationMin: number;
  isFixed?: boolean;
  date?: string;
  notes?: string;
  topicId?: string;
  taskId?: string;
  status?: BlockStatus;
}

interface TimetableState {
  blocks: TimetableBlock[];
  selectedDate: string; // "YYYY-MM-DD" in IST
  viewMode: 'daily' | 'weekly';
  isLoading: boolean;

  // Actions
  loadInitialBlocks: (force?: boolean) => Promise<void>;
  setSelectedDate: (date: string) => void;
  setViewMode: (mode: 'daily' | 'weekly') => void;
  setBlocksFromEnvelope: (blocks: TimetableBlock[]) => void;
  addBlock: (params: AddBlockParams) => Promise<TimetableBlock>;
  updateBlock: (block: TimetableBlock) => Promise<void>;
  setBlockStatus: (blockId: string, status: BlockStatus) => Promise<void>;
  rescheduleBlock: (
    blockId: string,
    newDate: string,
    newStartTime: string,
    newDurationMin?: number
  ) => Promise<void>;
  deleteBlock: (blockId: string) => Promise<void>;

  // Queries
  getBlocksForDate: (date?: string) => TimetableBlock[];
  getBlocksForDateRange: (startDate: string, endDate: string) => TimetableBlock[];
  getConflictingBlocks: (
    targetDate: string,
    startTime: string,
    durationMin: number,
    excludeBlockId?: string
  ) => TimetableBlock[];
}

export const useTimetableStore = create<TimetableState>((set, get) => ({
  blocks: [],
  selectedDate: getCurrentISTDate(),
  viewMode: 'daily',
  isLoading: true,

  setBlocksFromEnvelope: (blocks) => set({ blocks }),

  loadInitialBlocks: async (force = false) => {
    if (!force && get().blocks.length > 0) {
      return;
    }
    set({ isLoading: true });
    const blocks = await getStorage().getTimetableBlocks();
    set({ blocks, isLoading: false });
  },

  setSelectedDate: (date) => set({ selectedDate: date }),

  setViewMode: (mode) => set({ viewMode: mode }),

  addBlock: async ({
    title,
    categoryId,
    priority,
    startTime,
    durationMin,
    isFixed = false,
    date,
    notes = '',
    topicId,
    taskId,
    status = 'pending',
  }) => {
    const now = dateToAppTimestamp(new Date());
    const targetDate = date || get().selectedDate;
    const newBlock: TimetableBlock = {
      id: generateId('blk'),
      title: title.trim(),
      categoryId,
      priority,
      date: targetDate,
      startTime,
      durationMin,
      isFixed,
      notes,
      topicId: topicId || undefined,
      taskId: taskId || undefined,
      status,
      createdAt: now,
      updatedAt: now,
      actualStart: null,
      actualEnd: null,
      actualHistory: [],
    };
    const updated = [...get().blocks, newBlock];
    set({ blocks: updated });
    await getStorage().saveTimetableBlock(newBlock);
    return newBlock;
  },

  updateBlock: async (block) => {
    const now = dateToAppTimestamp(new Date());
    const updatedBlock: TimetableBlock = { ...block, updatedAt: now };
    const updated = get().blocks.map((b) => (b.id === block.id ? updatedBlock : b));
    set({ blocks: updated });
    await getStorage().saveTimetableBlock(updatedBlock);
  },

  setBlockStatus: async (blockId, status) => {
    const target = get().blocks.find((b) => b.id === blockId);
    if (!target) return;
    const now = dateToAppTimestamp(new Date());
    const updatedBlock: TimetableBlock = {
      ...target,
      status,
      updatedAt: now,
    };
    const updated = get().blocks.map((b) => (b.id === blockId ? updatedBlock : b));
    set({ blocks: updated });
    await getStorage().saveTimetableBlock(updatedBlock);
  },

  rescheduleBlock: async (blockId, newDate, newStartTime, newDurationMin) => {
    const target = get().blocks.find((b) => b.id === blockId);
    if (!target) return;
    const now = dateToAppTimestamp(new Date());
    const updatedBlock: TimetableBlock = {
      ...target,
      date: newDate.trim(),
      startTime: newStartTime.trim(),
      durationMin: newDurationMin !== undefined ? newDurationMin : target.durationMin,
      updatedAt: now,
    };
    const updated = get().blocks.map((b) => (b.id === blockId ? updatedBlock : b));
    set({ blocks: updated });
    await getStorage().saveTimetableBlock(updatedBlock);
  },

  deleteBlock: async (blockId) => {
    const updated = get().blocks.filter((b) => b.id !== blockId);
    set({ blocks: updated });
    await getStorage().deleteTimetableBlock(blockId);
  },

  getBlocksForDate: (date) => {
    const targetDate = date || get().selectedDate;
    return get()
      .blocks.filter((b) => b.date === targetDate)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  },

  getBlocksForDateRange: (startDate, endDate) => {
    return get()
      .blocks.filter((b) => b.date >= startDate && b.date <= endDate)
      .sort((a, b) => {
        const dateDiff = a.date.localeCompare(b.date);
        if (dateDiff !== 0) return dateDiff;
        return a.startTime.localeCompare(b.startTime);
      });
  },

  getConflictingBlocks: (targetDate, startTime, durationMin, excludeBlockId) => {
    return findConflictingBlocks(get().blocks, targetDate, startTime, durationMin, excludeBlockId);
  },
}));
