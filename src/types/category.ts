import { AppTimestamp } from './task';

export type Priority = 'high' | 'medium' | 'low';

export interface Category {
  id: string;               // e.g. "cat_career"
  name: string;             // e.g. "Career"
  priority: Priority;       // high | medium | low
  sortOrder: number;        // secondary sort order (1, 2, 3...)
  color: string;            // hex color for visual badge
  createdAt: AppTimestamp;
  updatedAt: AppTimestamp;
}

