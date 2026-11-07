import { AppTimestamp } from './task';
import { Priority } from './category';

export interface TopicTask {
  id: string;               // e.g. "tsk_1"
  topicId: string;          // Foreign key -> Topic.id (Category is derived via Topic)
  title: string;            // 1-200 characters
  dueDate: string | null;   // "YYYY-MM-DD" in IST or null
  priority: Priority;       // high | medium | low
  isCompleted: boolean;     // Toggle state
  completedAt: AppTimestamp | null;
  notes: string;
  createdAt: AppTimestamp;
  updatedAt: AppTimestamp;
}
