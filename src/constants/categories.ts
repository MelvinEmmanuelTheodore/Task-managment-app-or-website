import { Category } from '../types/category';
import { Topic } from '../types/topic';
import { DEFAULT_CATEGORIES, DEFAULT_TOPICS } from './defaultData';

export const CATEGORIES = DEFAULT_CATEGORIES.map((c) => c.name);

export const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Career: { bg: '#1E3A8A', text: '#93C5FD', border: '#2563EB' },
  'Professional Development': { bg: '#3B0764', text: '#DDD6FE', border: '#7C3AED' },
  'Languages and Communication': { bg: '#064E3B', text: '#A7F3D0', border: '#059669' },
  'Health and Personal Maintenance': { bg: '#831843', text: '#FBCFE8', border: '#DB2777' },
  'Personal Interests': { bg: '#78350F', text: '#FDE68A', border: '#D97706' },
  'Entertainment and Social Life': { bg: '#1F2937', text: '#E5E7EB', border: '#4B5563' },
};
