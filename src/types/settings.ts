import { AppTimestamp } from './task';

export interface UserSettings {
  defaultReminderMinutesBefore: number; // Default: 5
  theme: 'light' | 'dark' | 'system';
  categories: string[];                 // User-editable category list
  wakeUpTime: string;                   // "08:00" in IST
  windDownTime: string;                 // "22:45" in IST
  batteryOptimizationDismissed: boolean;
  createdAt: AppTimestamp;
  updatedAt: AppTimestamp;
}
