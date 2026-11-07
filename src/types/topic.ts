import { AppTimestamp } from './task';
import { Priority } from './category';

export interface Topic {
  id: string;               // e.g. "top_1"
  categoryId: string;       // Foreign key -> Category.id
  name: string;             // Topic title
  priority: Priority;       // Topic-level priority
  sortOrder: number;        // Display order within category
  isActive: boolean;        // Active vs Deactivated
  createdAt: AppTimestamp;
  updatedAt: AppTimestamp;
}

