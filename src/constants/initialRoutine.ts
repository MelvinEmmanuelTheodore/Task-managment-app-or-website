import { TimetableBlock } from '../types/timetable';
import { dateToAppTimestamp } from '../utils/dateHelpers';

export const WEEK_1_ROUTINE_NAME = 'Week 1 - Initial Productivity Routine';
export const WEEK_1_DATES = [
  '2026-11-09', // Monday
  '2026-11-10', // Tuesday
  '2026-11-11', // Wednesday
  '2026-11-12', // Thursday
  '2026-11-13', // Friday
] as const;

export function getInitialWeek1Blocks(): TimetableBlock[] {
  const now = dateToAppTimestamp(new Date());
  const blocks: TimetableBlock[] = [];

  const daysData = [
    {
      date: '2026-11-09',
      dayName: 'Monday',
      overseasResearchTitle: 'Overseas research - Target countries',
      overseasResearchNotes: 'Identify one or two target countries.',
      technicalLearningTitle: 'Technical learning - SolidWorks practice',
      technicalLearningNotes: 'SolidWorks practice.',
      technicalTopicId: 'top_prof_1',
      afternoonActivityTitle: 'Portfolio & application review - Candidex',
      afternoonActivityNotes: 'Update application records in Candidex.',
      afternoonCategoryId: 'cat_career',
      afternoonTopicId: 'top_career_1',
      nightActivityTitle: 'German or reading',
      nightActivityNotes: 'German language study or reading books.',
    },
    {
      date: '2026-11-10',
      dayName: 'Tuesday',
      overseasResearchTitle: 'Overseas research - Automotive employers',
      overseasResearchNotes: 'Research automotive employers.',
      technicalLearningTitle: 'Technical learning - ANSYS intro & FEA',
      technicalLearningNotes: 'ANSYS introduction and FEA.',
      technicalTopicId: 'top_prof_2',
      afternoonActivityTitle: 'Portfolio, interview preparation or communication',
      afternoonActivityNotes: 'Communication and portfolio review.',
      afternoonCategoryId: 'cat_languages',
      afternoonTopicId: 'top_lang_4',
      nightActivityTitle: 'German practice and communication',
      nightActivityNotes: 'German practice and communication.',
    },
    {
      date: '2026-11-11',
      dayName: 'Wednesday',
      overseasResearchTitle: 'Overseas applications - Suitable opportunities',
      overseasResearchNotes: 'Suitable overseas applications.',
      technicalLearningTitle: 'Technical learning - SolidWorks modelling',
      technicalLearningNotes: 'SolidWorks modelling.',
      technicalTopicId: 'top_prof_1',
      afternoonActivityTitle: 'Interview prep - Automotive project presentation',
      afternoonActivityNotes: 'Practise explaining an automotive project aloud.',
      afternoonCategoryId: 'cat_career',
      afternoonTopicId: 'top_career_2',
      nightActivityTitle: 'German or reading',
      nightActivityNotes: 'German language study or reading books.',
    },
    {
      date: '2026-11-12',
      dayName: 'Thursday',
      overseasResearchTitle: 'Overseas research - Visa & eligibility',
      overseasResearchNotes: 'Visa and job eligibility requirements.',
      technicalLearningTitle: 'Technical learning - ANSYS practice',
      technicalLearningNotes: 'ANSYS practice.',
      technicalTopicId: 'top_prof_2',
      afternoonActivityTitle: 'Portfolio improvement',
      afternoonActivityNotes: 'Portfolio improvement.',
      afternoonCategoryId: 'cat_prof_dev',
      afternoonTopicId: 'top_prof_3',
      nightActivityTitle: 'German or reading',
      nightActivityNotes: 'German language study or reading books.',
    },
    {
      date: '2026-11-13',
      dayName: 'Friday',
      overseasResearchTitle: 'Overseas research - Applications & follow-ups',
      overseasResearchNotes: 'Applications and follow-ups.',
      technicalLearningTitle: 'Technical learning - SolidWorks project',
      technicalLearningNotes: 'SolidWorks project.',
      technicalTopicId: 'top_prof_3',
      afternoonActivityTitle: 'Weekly progress review',
      afternoonActivityNotes: 'Weekly progress review.',
      afternoonCategoryId: 'cat_career',
      afternoonTopicId: 'top_career_1',
      nightActivityTitle: 'German or reading',
      nightActivityNotes: 'German language study or reading books.',
    },
  ];

  for (const day of daysData) {
    const d = day.date;

    // 1. 08:00 - 09:00 (Wake up, breakfast and preparation) [Essential]
    blocks.push({
      id: `blk_w1_${d}_0800`,
      title: 'Wake up, breakfast and preparation',
      categoryId: 'cat_health',
      topicId: 'top_health_3',
      priority: 'high',
      date: d,
      startTime: '08:00',
      durationMin: 60,
      isFixed: true,
      notes: 'Wake up at 08:00, breakfast, morning preparation.',
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      actualStart: null,
      actualEnd: null,
      actualHistory: [],
    });

    // 2. 09:00 - 10:30 (Indian job applications) [High]
    blocks.push({
      id: `blk_w1_${d}_0900`,
      title: 'Indian job applications',
      categoryId: 'cat_career',
      topicId: 'top_career_1',
      priority: 'high',
      date: d,
      startTime: '09:00',
      durationMin: 90,
      isFixed: false,
      notes: 'Indian job applications and outreach.',
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      actualStart: null,
      actualEnd: null,
      actualHistory: [],
    });

    // 3. 10:30 - 10:45 (Break) [Flexible]
    blocks.push({
      id: `blk_w1_${d}_1030`,
      title: 'Break',
      categoryId: 'cat_health',
      priority: 'low',
      date: d,
      startTime: '10:30',
      durationMin: 15,
      isFixed: false,
      notes: 'Rest, hydrate, and relax.',
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      actualStart: null,
      actualEnd: null,
      actualHistory: [],
    });

    // 4. 10:45 - 12:15 (Overseas job search and applications) [High]
    blocks.push({
      id: `blk_w1_${d}_1045`,
      title: 'Overseas job search and applications',
      categoryId: 'cat_career',
      topicId: 'top_career_5',
      priority: 'high',
      date: d,
      startTime: '10:45',
      durationMin: 90,
      isFixed: false,
      notes: 'Targeted overseas job search, role requirements, and applications.',
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      actualStart: null,
      actualEnd: null,
      actualHistory: [],
    });

    // 5. 12:15 - 13:00 (Overseas research and application tracking - weekday specific) [High]
    blocks.push({
      id: `blk_w1_${d}_1215`,
      title: day.overseasResearchTitle,
      categoryId: 'cat_career',
      topicId: 'top_career_5',
      priority: 'high',
      date: d,
      startTime: '12:15',
      durationMin: 45,
      isFixed: false,
      notes: day.overseasResearchNotes,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      actualStart: null,
      actualEnd: null,
      actualHistory: [],
    });

    // 6. 13:00 - 14:00 (Lunch and rest) [Essential]
    blocks.push({
      id: `blk_w1_${d}_1300`,
      title: 'Lunch and rest',
      categoryId: 'cat_health',
      priority: 'high',
      date: d,
      startTime: '13:00',
      durationMin: 60,
      isFixed: true,
      notes: 'Lunch and rest.',
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      actualStart: null,
      actualEnd: null,
      actualHistory: [],
    });

    // 7. 14:00 - 15:30 (Technical learning and projects - weekday specific) [High]
    blocks.push({
      id: `blk_w1_${d}_1400`,
      title: day.technicalLearningTitle,
      categoryId: 'cat_prof_dev',
      topicId: day.technicalTopicId,
      priority: 'high',
      date: d,
      startTime: '14:00',
      durationMin: 90,
      isFixed: false,
      notes: day.technicalLearningNotes,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      actualStart: null,
      actualEnd: null,
      actualHistory: [],
    });

    // 8. 15:30 - 16:00 (Break) [Flexible]
    blocks.push({
      id: `blk_w1_${d}_1530`,
      title: 'Break',
      categoryId: 'cat_health',
      priority: 'low',
      date: d,
      startTime: '15:30',
      durationMin: 30,
      isFixed: false,
      notes: 'Afternoon break, stretch and relax.',
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      actualStart: null,
      actualEnd: null,
      actualHistory: [],
    });

    // 9. 16:00 - 17:00 (Portfolio, interview preparation or communication - weekday specific) [Medium]
    blocks.push({
      id: `blk_w1_${d}_1600`,
      title: day.afternoonActivityTitle,
      categoryId: day.afternoonCategoryId,
      topicId: day.afternoonTopicId,
      priority: 'medium',
      date: d,
      startTime: '16:00',
      durationMin: 60,
      isFixed: false,
      notes: day.afternoonActivityNotes,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      actualStart: null,
      actualEnd: null,
      actualHistory: [],
    });

    // 10. 17:00 - 17:30 (Buffer and family responsibilities) [Flexible]
    blocks.push({
      id: `blk_w1_${d}_1700`,
      title: 'Buffer and family responsibilities',
      categoryId: 'cat_health',
      priority: 'low',
      date: d,
      startTime: '17:00',
      durationMin: 30,
      isFixed: false,
      notes: 'Buffer and family responsibilities.',
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      actualStart: null,
      actualEnd: null,
      actualHistory: [],
    });

    // 11. 17:30 - 18:15 (Exercise or walking) [Essential]
    blocks.push({
      id: `blk_w1_${d}_1730`,
      title: 'Exercise or walking',
      categoryId: 'cat_health',
      topicId: 'top_health_1',
      priority: 'high',
      date: d,
      startTime: '17:30',
      durationMin: 45,
      isFixed: true,
      notes: 'Exercise or walking.',
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      actualStart: null,
      actualEnd: null,
      actualHistory: [],
    });

    // 12. 18:15 - 19:00 (Shower and family time) [Essential]
    blocks.push({
      id: `blk_w1_${d}_1815`,
      title: 'Shower and family time',
      categoryId: 'cat_health',
      priority: 'high',
      date: d,
      startTime: '18:15',
      durationMin: 45,
      isFixed: true,
      notes: 'Shower and family time.',
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      actualStart: null,
      actualEnd: null,
      actualHistory: [],
    });

    // 13. 19:00 - 20:00 (Dinner and family) [Essential]
    blocks.push({
      id: `blk_w1_${d}_1900`,
      title: 'Dinner and family',
      categoryId: 'cat_health',
      priority: 'high',
      date: d,
      startTime: '19:00',
      durationMin: 60,
      isFixed: true,
      notes: 'Dinner and family.',
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      actualStart: null,
      actualEnd: null,
      actualHistory: [],
    });

    // 14. 20:00 - 21:00 (LEGO McLaren P1 - constant every weekday) [Low]
    blocks.push({
      id: `blk_w1_${d}_2000`,
      title: 'LEGO McLaren P1',
      categoryId: 'cat_interests',
      topicId: 'top_int_2',
      priority: 'low',
      date: d,
      startTime: '20:00',
      durationMin: 60,
      isFixed: false,
      notes: 'LEGO McLaren P1.',
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      actualStart: null,
      actualEnd: null,
      actualHistory: [],
    });

    // 15. 21:00 - 21:30 (German or reading - weekday specific) [Medium]
    blocks.push({
      id: `blk_w1_${d}_2100`,
      title: day.nightActivityTitle,
      categoryId: 'cat_languages',
      topicId: 'top_lang_1',
      priority: 'medium',
      date: d,
      startTime: '21:00',
      durationMin: 30,
      isFixed: false,
      notes: day.nightActivityNotes,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      actualStart: null,
      actualEnd: null,
      actualHistory: [],
    });

    // 16. 21:30 - 22:30 (Gaming, anime, friends or hobbies) [Flexible]
    blocks.push({
      id: `blk_w1_${d}_2130`,
      title: 'Gaming, anime, friends or hobbies',
      categoryId: 'cat_entertainment',
      topicId: 'top_ent_1',
      priority: 'low',
      date: d,
      startTime: '21:30',
      durationMin: 60,
      isFixed: false,
      notes: 'Gaming, anime, friends or hobbies.',
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      actualStart: null,
      actualEnd: null,
      actualHistory: [],
    });

    // 17. 22:30 - 22:45 (Prepare for tomorrow) [Medium]
    blocks.push({
      id: `blk_w1_${d}_2230`,
      title: 'Prepare for tomorrow',
      categoryId: 'cat_health',
      topicId: 'top_health_3',
      priority: 'medium',
      date: d,
      startTime: '22:30',
      durationMin: 15,
      isFixed: false,
      notes: 'Prepare for tomorrow. Sleep time: 22:45.',
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      actualStart: null,
      actualEnd: null,
      actualHistory: [],
    });
  }

  return blocks;
}

