import { Category } from '../types/category';
import { Topic } from '../types/topic';
import { dateToAppTimestamp } from '../utils/dateHelpers';

const now = dateToAppTimestamp(new Date());

export const DEFAULT_CATEGORIES: Category[] = [
  {
    id: 'cat_career',
    name: 'Career',
    priority: 'high',
    sortOrder: 1,
    color: '#2563EB', // Blue
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'cat_prof_dev',
    name: 'Professional Development',
    priority: 'high',
    sortOrder: 2,
    color: '#7C3AED', // Violet
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'cat_languages',
    name: 'Languages and Communication',
    priority: 'medium',
    sortOrder: 3,
    color: '#059669', // Emerald green
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'cat_health',
    name: 'Health and Personal Maintenance',
    priority: 'medium',
    sortOrder: 4,
    color: '#DB2777', // Pink
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'cat_interests',
    name: 'Personal Interests',
    priority: 'low',
    sortOrder: 5,
    color: '#D97706', // Amber
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'cat_entertainment',
    name: 'Entertainment and Social Life',
    priority: 'low',
    sortOrder: 6,
    color: '#4B5563', // Gray
    createdAt: now,
    updatedAt: now,
  },
];

export const DEFAULT_TOPICS: Topic[] = [
  // A. Career
  { id: 'top_career_1', categoryId: 'cat_career', name: 'Applying for jobs in India', priority: 'high', sortOrder: 1, isActive: true, createdAt: now, updatedAt: now },
  { id: 'top_career_2', categoryId: 'cat_career', name: 'Preparing for interviews', priority: 'high', sortOrder: 2, isActive: true, createdAt: now, updatedAt: now },
  { id: 'top_career_3', categoryId: 'cat_career', name: 'LinkedIn optimisation and networking', priority: 'high', sortOrder: 3, isActive: true, createdAt: now, updatedAt: now },
  { id: 'top_career_4', categoryId: 'cat_career', name: 'Completing Grow School course', priority: 'high', sortOrder: 4, isActive: true, createdAt: now, updatedAt: now },
  { id: 'top_career_5', categoryId: 'cat_career', name: 'Researching overseas job opportunities', priority: 'high', sortOrder: 5, isActive: true, createdAt: now, updatedAt: now },
  { id: 'top_career_6', categoryId: 'cat_career', name: 'Deciding which countries to target', priority: 'high', sortOrder: 6, isActive: true, createdAt: now, updatedAt: now },

  // B. Professional Development
  { id: 'top_prof_1', categoryId: 'cat_prof_dev', name: 'SolidWorks modelling and advanced techniques', priority: 'high', sortOrder: 1, isActive: true, createdAt: now, updatedAt: now },
  { id: 'top_prof_2', categoryId: 'cat_prof_dev', name: 'ANSYS FEA and CFD', priority: 'high', sortOrder: 2, isActive: true, createdAt: now, updatedAt: now },
  { id: 'top_prof_3', categoryId: 'cat_prof_dev', name: 'Building automotive portfolio projects', priority: 'high', sortOrder: 3, isActive: true, createdAt: now, updatedAt: now },
  { id: 'top_prof_4', categoryId: 'cat_prof_dev', name: 'Improving my website', priority: 'high', sortOrder: 4, isActive: true, createdAt: now, updatedAt: now },
  { id: 'top_prof_5', categoryId: 'cat_prof_dev', name: 'Wind tunnel project', priority: 'high', sortOrder: 5, isActive: true, createdAt: now, updatedAt: now },
  { id: 'top_prof_6', categoryId: 'cat_prof_dev', name: 'Freelance CAD work and client practice', priority: 'high', sortOrder: 6, isActive: true, createdAt: now, updatedAt: now },

  // C. Languages and Communication
  { id: 'top_lang_1', categoryId: 'cat_languages', name: 'German practice', priority: 'medium', sortOrder: 1, isActive: true, createdAt: now, updatedAt: now },
  { id: 'top_lang_2', categoryId: 'cat_languages', name: 'Japanese or Chinese', priority: 'medium', sortOrder: 2, isActive: true, createdAt: now, updatedAt: now },
  { id: 'top_lang_3', categoryId: 'cat_languages', name: 'IELTS preparation, if necessary', priority: 'medium', sortOrder: 3, isActive: true, createdAt: now, updatedAt: now },
  { id: 'top_lang_4', categoryId: 'cat_languages', name: 'Improving speaking and communication skills', priority: 'medium', sortOrder: 4, isActive: true, createdAt: now, updatedAt: now },

  // D. Health and Personal Maintenance
  { id: 'top_health_1', categoryId: 'cat_health', name: 'Exercise', priority: 'medium', sortOrder: 1, isActive: true, createdAt: now, updatedAt: now },
  { id: 'top_health_2', categoryId: 'cat_health', name: 'Walking', priority: 'medium', sortOrder: 2, isActive: true, createdAt: now, updatedAt: now },
  { id: 'top_health_3', categoryId: 'cat_health', name: 'Improving sleep schedule', priority: 'medium', sortOrder: 3, isActive: true, createdAt: now, updatedAt: now },
  { id: 'top_health_4', categoryId: 'cat_health', name: 'Practising driving', priority: 'medium', sortOrder: 4, isActive: true, createdAt: now, updatedAt: now },
  { id: 'top_health_5', categoryId: 'cat_health', name: 'Healthy digital habits and reducing excessive screen time', priority: 'medium', sortOrder: 5, isActive: true, createdAt: now, updatedAt: now },

  // E. Personal Interests
  { id: 'top_int_1', categoryId: 'cat_interests', name: 'Playing guitar', priority: 'low', sortOrder: 1, isActive: true, createdAt: now, updatedAt: now },
  { id: 'top_int_2', categoryId: 'cat_interests', name: 'Completing my McLaren P1 LEGO', priority: 'low', sortOrder: 2, isActive: true, createdAt: now, updatedAt: now },
  { id: 'top_int_3', categoryId: 'cat_interests', name: 'Recording and editing LEGO videos', priority: 'low', sortOrder: 3, isActive: true, createdAt: now, updatedAt: now },
  { id: 'top_int_4', categoryId: 'cat_interests', name: 'Reading books', priority: 'low', sortOrder: 4, isActive: true, createdAt: now, updatedAt: now },
  { id: 'top_int_5', categoryId: 'cat_interests', name: 'Watching anime and reading manga', priority: 'low', sortOrder: 5, isActive: true, createdAt: now, updatedAt: now },

  // F. Entertainment and Social Life
  { id: 'top_ent_1', categoryId: 'cat_entertainment', name: 'Playing games with friends', priority: 'low', sortOrder: 1, isActive: true, createdAt: now, updatedAt: now },
  { id: 'top_ent_2', categoryId: 'cat_entertainment', name: 'Messaging friends', priority: 'low', sortOrder: 2, isActive: true, createdAt: now, updatedAt: now },
  { id: 'top_ent_3', categoryId: 'cat_entertainment', name: 'YouTube and other entertainment', priority: 'low', sortOrder: 3, isActive: true, createdAt: now, updatedAt: now },
  { id: 'top_ent_4', categoryId: 'cat_entertainment', name: 'Social media', priority: 'low', sortOrder: 4, isActive: true, createdAt: now, updatedAt: now },
];
