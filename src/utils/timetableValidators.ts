import { TimetableBlock } from '../types/timetable';

/** Timetable Block Input Validators & Time Calculations */

export function validateStartTime(time: string): boolean {
  if (!time) return false;
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(time.trim());
}

export function validateDurationMin(dur: number): boolean {
  return Number.isInteger(dur) && dur >= 5 && dur <= 480;
}

export function validateDate(dateStr: string): boolean {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) return false;
  const [year, month, day] = dateStr.trim().split('-').map(Number);
  if (year < 2000 || year > 2100) return false;
  if (month < 1 || month > 12) return false;

  // Use Date.UTC to verify that year, month-1, day reconstructs the exact same calendar values
  // Rejects invalid calendar dates like 2026-02-29, 2026-02-31, while accepting leap years (e.g. 2024-02-29)
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/** Convert "HH:mm" 24h string to minutes from midnight (0-1439) */
export function timeToMinutes(timeStr: string): number {
  if (!timeStr || !validateStartTime(timeStr)) return 0;
  const [h, m] = timeStr.trim().split(':').map(Number);
  return h * 60 + m;
}

/** Convert minutes from midnight to "HH:mm" 24h string */
export function minutesToTime(totalMins: number): string {
  const normalized = ((totalMins % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/** Calculate end time string ("HH:mm") from start time and duration */
export function calculateEndTime(startTime: string, durationMin: number): string {
  const startMins = timeToMinutes(startTime);
  return minutesToTime(startMins + durationMin);
}

/** Calculate duration in minutes between start time and end time */
export function calculateDuration(startTime: string, endTime: string): number {
  const startMins = timeToMinutes(startTime);
  const endMins = timeToMinutes(endTime);
  if (endMins >= startMins) {
    return endMins - startMins;
  }
  // Wrap around midnight
  return 1440 - startMins + endMins;
}

/**
 * Check if two time intervals overlap on the same date.
 * Touching intervals (e.g. 09:00-10:00 and 10:00-11:00) do NOT overlap.
 */
export function hasOverlap(startA: string, durA: number, startB: string, durB: number): boolean {
  const aStart = timeToMinutes(startA);
  const aEnd = aStart + durA;
  const bStart = timeToMinutes(startB);
  const bEnd = bStart + durB;

  return aStart < bEnd && bStart < aEnd;
}

/**
 * Find all blocks that conflict with a given time window on targetDate.
 */
export function findConflictingBlocks(
  blocks: TimetableBlock[],
  targetDate: string,
  startTime: string,
  durationMin: number,
  excludeBlockId?: string
): TimetableBlock[] {
  if (!validateStartTime(startTime) || !validateDurationMin(durationMin)) {
    return [];
  }

  return blocks.filter((b) => {
    if (b.id === excludeBlockId) return false;
    if (b.date !== targetDate) return false;
    // Don't flag skipped or cancelled blocks as active conflicts
    if (b.status === 'skipped' || b.status === 'cancelled') return false;
    return hasOverlap(startTime, durationMin, b.startTime, b.durationMin);
  });
}
