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

  /** Transactional mutation: queues read-modify-write sequentially to prevent lost updates */
  private async mutateEnvelope(
    mutator: (envelope: StoredDataEnvelope) => void | Promise<void>
  ): Promise<StoredDataEnvelope> {
    return this.enqueueWrite(async () => {
      let data: StoredDataEnvelope;
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) {
        data = this.getInitialData();
      } else {
        try {
          data = JSON.parse(raw);
          if (data.schemaVersion !== 1) {
            data = this.getInitialData();
          }
        } catch {
          data = this.getInitialData();
        }
      }

      await mutator(data);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return data;
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
        return this.getInitialData();
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
    await this.mutateEnvelope((data) => {
      const index = data.categories.findIndex((c) => c.id === category.id);
      if (index >= 0) {
        data.categories[index] = category;
      } else {
        data.categories.push(category);
      }
    });
  }

  async deleteCategory(categoryId: string): Promise<void> {
    await this.mutateEnvelope((data) => {
      data.categories = data.categories.filter((c) => c.id !== categoryId);
    });
  }

  async getTopics(): Promise<Topic[]> {
    const data = await this.loadAll();
    return data.topics;
  }

  async saveTopic(topic: Topic): Promise<void> {
    await this.mutateEnvelope((data) => {
      const index = data.topics.findIndex((t) => t.id === topic.id);
      if (index >= 0) {
        data.topics[index] = topic;
      } else {
        data.topics.push(topic);
      }
    });
  }

  async deleteTopic(topicId: string): Promise<void> {
    await this.mutateEnvelope((data) => {
      data.topics = data.topics.filter((t) => t.id !== topicId);
      data.topicTasks = data.topicTasks.filter((task) => task.topicId !== topicId);
    });
  }

  async getTopicTasks(): Promise<TopicTask[]> {
    const data = await this.loadAll();
    return data.topicTasks;
  }

  async saveTopicTask(task: TopicTask): Promise<void> {
    await this.mutateEnvelope((data) => {
      const index = data.topicTasks.findIndex((t) => t.id === task.id);
      if (index >= 0) {
        data.topicTasks[index] = task;
      } else {
        data.topicTasks.push(task);
      }
    });
  }

  async deleteTopicTask(taskId: string): Promise<void> {
    await this.mutateEnvelope((data) => {
      data.topicTasks = data.topicTasks.filter((t) => t.id !== taskId);
    });
  }

  async getTimetableBlocks(): Promise<TimetableBlock[]> {
    const data = await this.loadAll();
    return data.timetableBlocks;
  }

  async saveTimetableBlock(block: TimetableBlock): Promise<void> {
    await this.mutateEnvelope((data) => {
      const index = data.timetableBlocks.findIndex((b) => b.id === block.id);
      if (index >= 0) {
        data.timetableBlocks[index] = block;
      } else {
        data.timetableBlocks.push(block);
      }
    });
  }

  async deleteTimetableBlock(blockId: string): Promise<void> {
    await this.mutateEnvelope((data) => {
      data.timetableBlocks = data.timetableBlocks.filter((b) => b.id !== blockId);
    });
  }

  async getSettings(): Promise<UserSettings> {
    const data = await this.loadAll();
    return data.settings;
  }

  async saveSettings(settings: UserSettings): Promise<void> {
    await this.mutateEnvelope((data) => {
      data.settings = settings;
    });
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

