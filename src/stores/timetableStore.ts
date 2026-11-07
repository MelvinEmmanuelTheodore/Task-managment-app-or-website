import { create } from 'zustand';
import { TimetableBlock } from '../types/timetable';
import { storageAdapter } from '../services/storage/AsyncStorageAdapter';
import { dateToAppTimestamp, getCurrentISTDate } from '../utils/dateHelpers';
import { generateId } from '../utils/idGenerator';
import { Priority } from '../types/category';

interface TimetableState {
  blocks: TimetableBlock[];
  selectedDate: string; // "YYYY-MM-DD" in IST
  isLoading: boolean;

  // Actions
  loadInitialBlocks: (force?: boolean) => Promise<void>;
  setSelectedDate: (date: string) => void;
  addBlock: (params: {
    title: string;
    categoryId: string;
    priority: Priority;
    startTime: string;
    durationMin: number;
    isFixed?: boolean;
    date?: string;
    notes?: string;
  }) => Promise<TimetableBlock>;
  updateBlock: (block: TimetableBlock) => Promise<void>;
  deleteBlock: (blockId: string) => Promise<void>;

  // Computed
  getBlocksForDate: (date?: string) => TimetableBlock[];
}

export const useTimetableStore = create<TimetableState>((set, get) => ({
  blocks: [],
  selectedDate: getCurrentISTDate(),
  isLoading: true,

  loadInitialBlocks: async (force = false) => {
    if (!force && get().blocks.length > 0) {
      return;
    }
    set({ isLoading: true });
    const blocks = await storageAdapter.getTimetableBlocks();
    set({ blocks, isLoading: false });
  },

  setSelectedDate: (date) => set({ selectedDate: date }),

  addBlock: async ({ title, categoryId, priority, startTime, durationMin, isFixed = false, date, notes = '' }) => {
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
      createdAt: now,
      updatedAt: now,
      status: 'pending',
      actualStart: null,
      actualEnd: null,
      actualHistory: [],
    };
    const updated = [...get().blocks, newBlock];
    set({ blocks: updated });
    await storageAdapter.saveTimetableBlock(newBlock);
    return newBlock;
  },

  updateBlock: async (block) => {
    const now = dateToAppTimestamp(new Date());
    const updatedBlock: TimetableBlock = { ...block, updatedAt: now };
    const updated = get().blocks.map((b) => (b.id === block.id ? updatedBlock : b));
    set({ blocks: updated });
    await storageAdapter.saveTimetableBlock(updatedBlock);
  },

  deleteBlock: async (blockId) => {
    const updated = get().blocks.filter((b) => b.id !== blockId);
    set({ blocks: updated });
    await storageAdapter.deleteTimetableBlock(blockId);
  },

  getBlocksForDate: (date) => {
    const targetDate = date || get().selectedDate;
    return get()
      .blocks.filter((b) => b.date === targetDate)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  },
}));

