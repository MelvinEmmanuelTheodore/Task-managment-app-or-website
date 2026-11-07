import AsyncStorage from '@react-native-async-storage/async-storage';
import { IStorageAdapter } from './IStorageAdapter';
import { StoredDataEnvelope } from '../../types/storage';
import { Category } from '../../types/category';
import { Topic } from '../../types/topic';
import { TopicTask } from '../../types/topicTask';
import { TimetableBlock } from '../../types/timetable';
import { UserSettings } from '../../types/settings';
import { DEFAULT_CATEGORIES, DEFAULT_TOPICS } from '../../constants/defaultData';
import { dateToAppTimestamp } from '../../utils/dateHelpers';

const STORAGE_KEY = '@time_mgmt_app_data_v1';

export class AsyncStorageAdapter implements IStorageAdapter {
  private writeQueue: Promise<void> = Promise.resolve();

  private getInitialData(): StoredDataEnvelope {
    const now = dateToAppTimestamp(new Date());
    return {
      schemaVersion: 1,
      categories: DEFAULT_CATEGORIES,
      topics: DEFAULT_TOPICS,
      topicTasks: [],
      timetableBlocks: [],
      settings: {
        defaultReminderMinutesBefore: 5,
        theme: 'dark',
        categories: DEFAULT_CATEGORIES.map((c) => c.name),
        wakeUpTime: '08:00',
        windDownTime: '22:45',
        batteryOptimizationDismissed: false,
        createdAt: now,
        updatedAt: now,
      },
    };
  }

  /** Serialized write queue to eliminate write collisions */
  private enqueueWrite<T>(op: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.writeQueue = this.writeQueue
        .then(() => op())
        .then(resolve)
        .catch(reject);
    });
  }

  async loadAll(): Promise<StoredDataEnvelope> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const initial = this.getInitialData();
        await this.saveAll(initial);
        return initial;
      }
      const parsed: StoredDataEnvelope = JSON.parse(raw);
      if (parsed.schemaVersion !== 1) {
        // Future migrations can be handled here
        return parsed;
      }
      return parsed;
    } catch {
      return this.getInitialData();
    }
  }

  async saveAll(envelope: StoredDataEnvelope): Promise<void> {
    return this.enqueueWrite(async () => {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
    });
  }

  async getCategories(): Promise<Category[]> {
    const data = await this.loadAll();
    return data.categories;
  }

  async saveCategory(category: Category): Promise<void> {
    const data = await this.loadAll();
    const index = data.categories.findIndex((c) => c.id === category.id);
    if (index >= 0) {
      data.categories[index] = category;
    } else {
      data.categories.push(category);
    }
    await this.saveAll(data);
  }

  async deleteCategory(categoryId: string): Promise<void> {
    const data = await this.loadAll();
    data.categories = data.categories.filter((c) => c.id !== categoryId);
    await this.saveAll(data);
  }

  async getTopics(): Promise<Topic[]> {
    const data = await this.loadAll();
    return data.topics;
  }

  async saveTopic(topic: Topic): Promise<void> {
    const data = await this.loadAll();
    const index = data.topics.findIndex((t) => t.id === topic.id);
    if (index >= 0) {
      data.topics[index] = topic;
    } else {
      data.topics.push(topic);
    }
    await this.saveAll(data);
  }

  async deleteTopic(topicId: string): Promise<void> {
    const data = await this.loadAll();
    data.topics = data.topics.filter((t) => t.id !== topicId);
    data.topicTasks = data.topicTasks.filter((task) => task.topicId !== topicId);
    await this.saveAll(data);
  }

  async getTopicTasks(): Promise<TopicTask[]> {
    const data = await this.loadAll();
    return data.topicTasks;
  }

  async saveTopicTask(task: TopicTask): Promise<void> {
    const data = await this.loadAll();
    const index = data.topicTasks.findIndex((t) => t.id === task.id);
    if (index >= 0) {
      data.topicTasks[index] = task;
    } else {
      data.topicTasks.push(task);
    }
    await this.saveAll(data);
  }

  async deleteTopicTask(taskId: string): Promise<void> {
    const data = await this.loadAll();
    data.topicTasks = data.topicTasks.filter((t) => t.id !== taskId);
    await this.saveAll(data);
  }

  async getTimetableBlocks(): Promise<TimetableBlock[]> {
    const data = await this.loadAll();
    return data.timetableBlocks;
  }

  async saveTimetableBlock(block: TimetableBlock): Promise<void> {
    const data = await this.loadAll();
    const index = data.timetableBlocks.findIndex((b) => b.id === block.id);
    if (index >= 0) {
      data.timetableBlocks[index] = block;
    } else {
      data.timetableBlocks.push(block);
    }
    await this.saveAll(data);
  }

  async deleteTimetableBlock(blockId: string): Promise<void> {
    const data = await this.loadAll();
    data.timetableBlocks = data.timetableBlocks.filter((b) => b.id !== blockId);
    await this.saveAll(data);
  }

  async getSettings(): Promise<UserSettings> {
    const data = await this.loadAll();
    return data.settings;
  }

  async saveSettings(settings: UserSettings): Promise<void> {
    const data = await this.loadAll();
    data.settings = settings;
    await this.saveAll(data);
  }

  async exportAllData(): Promise<string> {
    const data = await this.loadAll();
    return JSON.stringify(data, null, 2);
  }

  async importAllData(jsonString: string): Promise<StoredDataEnvelope> {
    const parsed = JSON.parse(jsonString);
    if (!parsed || parsed.schemaVersion !== 1) {
      throw new Error('Invalid backup schema version.');
    }
    if (!Array.isArray(parsed.categories) || !Array.isArray(parsed.topics)) {
      throw new Error('Malformed backup payload.');
    }
    await this.saveAll(parsed);
    return parsed;
  }
}

export const storageAdapter: IStorageAdapter = new AsyncStorageAdapter();
