import { Category } from './category';
import { Topic } from './topic';
import { TopicTask } from './topicTask';
import { TimetableBlock } from './timetable';
import { UserSettings } from './settings';

export interface StoredDataEnvelope {
  schemaVersion: 1 | 2;
  categories: Category[];
  topics: Topic[];
  topicTasks: TopicTask[];
  timetableBlocks: TimetableBlock[];
  settings: UserSettings;
}

