export type TaskPriority = 'high' | 'medium' | 'low';

export type TaskStatus = 'pending' | 'in_progress' | 'done' | 'skipped' | 'cancelled';

/** Platform-independent, JSON-serialisable Timestamp interface */
export interface AppTimestamp {
  seconds: number;
  nanoseconds: number;
  toDate(): Date;
  toMillis(): number;
  toISOString(): string;
}

export interface ActualTimeEntry {
  actualStart: AppTimestamp;
  actualEnd: AppTimestamp;
  reopenedAt: AppTimestamp;
}

export interface RecurrenceRule {
  type: 'daily' | 'weekdays' | 'weekly' | 'custom';
  daysOfWeek?: number[]; // 0 = Sun, 1 = Mon, ..., 6 = Sat
  endDate?: string;      // Optional "YYYY-MM-DD"
}

export interface Task {
  id: string;                           // Deterministic: `${templateId}_${date}_${blockId}`
  title: string;                        // Required, 1-200 characters
  category: string;                     // Required (e.g. "Career", "Learning", "Health")
  priority: TaskPriority;               // Required: 'high' | 'medium' | 'low'
  date: string;                         // Required: "YYYY-MM-DD" in IST
  plannedStart: AppTimestamp;           // Required: UTC Timestamp
  plannedEnd: AppTimestamp;             // Required: UTC Timestamp, must be > plannedStart
  durationMin: number;                  // Required: 5 to 480 minutes
  actualStart: AppTimestamp | null;     // Write-once on start, nullable
  actualEnd: AppTimestamp | null;       // Write-once on finish, nullable
  actualHistory: ActualTimeEntry[];     // Archived execution runs from reopened sessions
  status: TaskStatus;                   // Required: pending | in_progress | done | skipped | cancelled
  isFixed: boolean;                     // Flag for fixed commitments (Phase 3 protection)
  recurrenceRule: RecurrenceRule | null;// Recurrence definition or null
  parentRecurringTaskId: string | null; // Pointer to parent if generated from recurring task
  isFromTemplate: boolean;              // True if generated from routine template
  sourceTemplateId: string | null;      // Template ID used to generate this task
  reminderMinutesBefore: number | null; // e.g., 0, 5, 10, 30, or null
  notificationIds: string[];            // expo-notifications scheduled IDs
  notes: string;                        // Optional text notes
  links: string[];                      // Optional web URLs
  cancelledAt: AppTimestamp | null;     // UTC Timestamp when cancelled
  createdAt: AppTimestamp;              // UTC Timestamp
  updatedAt: AppTimestamp;              // UTC Timestamp
}
