import { Category } from '../../types/category';
import { Topic } from '../../types/topic';
import { TopicTask } from '../../types/topicTask';
import { TimetableBlock } from '../../types/timetable';
import { UserSettings } from '../../types/settings';
import { StoredDataEnvelope } from '../../types/storage';

export type StorageMutationEvent =
  | { type: 'block:save'; block: TimetableBlock }
  | { type: 'block:delete'; blockId: string }
  | { type: 'category:save'; category: Category }
  | { type: 'category:delete'; categoryId: string }
  | { type: 'category:reorder'; categories: Category[] }
  | { type: 'topic:save'; topic: Topic }
  | { type: 'topic:delete'; topicId: string; deletedTaskIds?: string[] }
  | { type: 'topic:reorder'; topics: Topic[] }
  | { type: 'task:save'; task: TopicTask }
  | { type: 'task:delete'; taskId: string }
  | {
      type: 'cascade:deleteCategory';
      categoryId: string;
      deletedTopicIds: string[];
      deletedTaskIds: string[];
      deletedBlockIds: string[];
    }
  | {
      type: 'move:deleteCategory';
      fromCategoryId: string;
      toCategoryId: string;
      updatedTopics: Topic[];
      updatedBlocks: TimetableBlock[];
    }
  | { type: 'all:replace'; envelope: StoredDataEnvelope };

export interface IStorageAdapter {
  // Envelope Operations
  loadAll(): Promise<StoredDataEnvelope>;
  saveAll(envelope: StoredDataEnvelope): Promise<void>;

  // Mutation Observers (for real-time two-way cloud synchronisation)
  registerMutationListener(listener: (event: StorageMutationEvent) => void): () => void;

  // Category CRUD
  getCategories(): Promise<Category[]>;
  saveCategory(category: Category): Promise<void>;
  deleteCategory(categoryId: string): Promise<void>;

  // Topic CRUD
  getTopics(): Promise<Topic[]>;
  saveTopic(topic: Topic): Promise<void>;
  deleteTopic(topicId: string): Promise<void>;

  // TopicTask CRUD
  getTopicTasks(): Promise<TopicTask[]>;
  saveTopicTask(task: TopicTask): Promise<void>;
  deleteTopicTask(taskId: string): Promise<void>;

  // TimetableBlock CRUD
  getTimetableBlocks(): Promise<TimetableBlock[]>;
  saveTimetableBlock(block: TimetableBlock): Promise<void>;
  deleteTimetableBlock(blockId: string): Promise<void>;

  // Settings
  getSettings(): Promise<UserSettings>;
  saveSettings(settings: UserSettings): Promise<void>;

  // Export / Import
  exportAllData(): Promise<string>;
  importAllData(jsonString: string): Promise<StoredDataEnvelope>;
  mergeAllData(incomingEnvelope: StoredDataEnvelope): Promise<StoredDataEnvelope>;
  replaceAllData(incomingEnvelope: StoredDataEnvelope): Promise<StoredDataEnvelope>;

  // Resilience & Rollback
  isStorageLocked(): boolean;
  getCorruptionError(): string | null;
  getRawCorruptedPayload(): string | null;
  retryRecovery(): Promise<boolean>;
  createRollbackSnapshot(): Promise<string>;
  migrateVersion(targetVersion: number): Promise<StoredDataEnvelope>;

  // Atomic Multi-Record Mutations (Transactional Queue)
  mutateEnvelope(mutator: (envelope: StoredDataEnvelope) => void | Promise<void>): Promise<StoredDataEnvelope>;
  reorderCategories(orderedIds: string[]): Promise<void>;
  reorderTopics(categoryId: string, orderedIds: string[]): Promise<void>;
  deleteCategoryCascade(categoryId: string): Promise<StoredDataEnvelope>;
  moveCategoryContentsAndDelete(fromCategoryId: string, toCategoryId: string): Promise<StoredDataEnvelope>;
}
