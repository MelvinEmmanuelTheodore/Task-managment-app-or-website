export const CATEGORIES = [
  'Career',
  'Learning',
  'Portfolio',
  'Health',
  'Family',
  'Language',
  'Leisure',
  'Fixed',
  'Other',
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Career: { bg: '#1E3A8A', text: '#93C5FD', border: '#3B82F6' },
  Learning: { bg: '#14532D', text: '#86EFAC', border: '#22C55E' },
  Portfolio: { bg: '#4C1D95', text: '#D8B4FE', border: '#A855F7' },
  Health: { bg: '#831843', text: '#F472B6', border: '#EC4899' },
  Family: { bg: '#78350F', text: '#FDE047', border: '#EAB308' },
  Language: { bg: '#064E3B', text: '#6EE7B7', border: '#10B981' },
  Leisure: { bg: '#1F2937', text: '#E5E7EB', border: '#6B7280' },
  Fixed: { bg: '#312E81', text: '#C7D2FE', border: '#6366F1' },
  Other: { bg: '#374151', text: '#D1D5DB', border: '#9CA3AF' },
};
