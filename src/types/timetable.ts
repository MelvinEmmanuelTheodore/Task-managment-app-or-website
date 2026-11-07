import { AppTimestamp } from './task';
import { Priority } from './category';

/**
 * TimetableBlock is a documented subset of the approved Task schema.
 * Active in Milestone A: id, title, categoryId, priority, date, startTime, durationMin, isFixed, notes, timestamps.
 * Deferred to Step 3/4 and Step 10: status, actualStart, actualEnd, actualHistory, isFromTemplate, recurrenceRule, reminderMinutesBefore.
 * Stored JSON includes optional nullable placeholders for deferred fields to guarantee non-breaking forward compatibility.
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

  // Forward-compatible deferred placeholders
  status?: 'pending' | 'in_progress' | 'done' | 'skipped' | 'cancelled';
  actualStart?: AppTimestamp | null;
  actualEnd?: AppTimestamp | null;
  actualHistory?: unknown[];
}

