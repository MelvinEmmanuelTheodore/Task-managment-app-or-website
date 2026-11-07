import { AppTimestamp } from './task';
import { Priority } from './category';

export type BlockStatus = 'pending' | 'in_progress' | 'completed' | 'done' | 'skipped' | 'cancelled';

/**
 * TimetableBlock represents a scheduled time block in the daily/weekly schedule.
 * It links to categories, topics, and tasks.
 */
export interface TimetableBlock {
  id: string;               // e.g. "blk_1"
  title: string;            // Block name (e.g. "Morning Career Work")
  categoryId: string;       // Foreign key -> Category.id (safe across renames)
  priority: Priority;       // high | medium | low
  date: string;             // "YYYY-MM-DD" in IST
  startTime: string;        // "HH:mm" in 24h IST format
  durationMin: number;      // 5-480 minutes
  isFixed: boolean;         // Flag indicating protected commitment
  notes: string;            // User notes
  createdAt: AppTimestamp;
  updatedAt: AppTimestamp;

  // Linkages to domain entities
  topicId?: string;         // Foreign key -> Topic.id (optional)
  taskId?: string;          // Foreign key -> TopicTask.id (optional)

  // Completion status
  status?: BlockStatus;

  // Forward-compatible execution timing placeholders
  actualStart?: AppTimestamp | null;
  actualEnd?: AppTimestamp | null;
  actualHistory?: unknown[];
}
