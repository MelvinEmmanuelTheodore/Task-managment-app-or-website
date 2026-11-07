import { Category } from '../../types/category';
import { Topic } from '../../types/topic';
import { TopicTask } from '../../types/topicTask';
import { TimetableBlock } from '../../types/timetable';
import { UserSettings } from '../../types/settings';
import { StoredDataEnvelope } from '../../types/storage';

export interface IStorageAdapter {
  // Envelope Operations
  loadAll(): Promise<StoredDataEnvelope>;
  saveAll(envelope: StoredDataEnvelope): Promise<void>;

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
}
