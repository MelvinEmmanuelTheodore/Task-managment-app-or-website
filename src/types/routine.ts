import { AppTimestamp, TaskPriority } from './task';

export interface RoutineBlock {
  blockId: string;                      // Stable identifier (e.g. "career_am", "exercise_pm")
  title: string;                        // e.g. "Morning Career Work"
  category: string;                     // e.g. "Career"
  priority: TaskPriority;
  startTime: string;                    // "HH:mm" 24h format in IST (e.g. "09:00")
  durationMin: number;                  // Minutes
  isFixed: boolean;                     // Protected flag
  reminderMinutesBefore: number | null;
}

export interface RoutineTemplate {
  id: string;                           // e.g. "default_weekday"
  name: string;                         // e.g. "Default Weekday Routine"
  blocks: RoutineBlock[];               // Ordered schedule blocks with stable blockIds
  daysOfWeek: number[];                 // [1, 2, 3, 4, 5] for Mon-Fri
  isActive: boolean;                    // Active toggle
  createdAt: AppTimestamp;
  updatedAt: AppTimestamp;
}
