import { TimetableBlock } from '../types/timetable';

/** Timetable Block Input Validators & Time Calculations */

export interface BlockTimingValidation {
  valid: boolean;
  error?: string;
  startMinutes?: number;
  endMinutes?: number;
  durationMin?: number;
}

export function validateStartTime(time: string): boolean {
  if (!time) return false;
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(time.trim());
}

export function validateEndTimeFormat(time: string): boolean {
  if (!time) return false;
  const trimmed = time.trim();
  if (trimmed === '24:00') return true;
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(trimmed);
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

/** Convert "HH:mm" 24h string to minutes from midnight (0-1440, where 24:00 is 1440) */
export function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const trimmed = timeStr.trim();
  if (trimmed === '24:00') return 1440;
  if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(trimmed)) return 0;
  const [h, m] = trimmed.split(':').map(Number);
  return h * 60 + m;
}

/** Convert minutes from midnight to "HH:mm" 24h string (1440 -> "24:00") */
export function minutesToTime(totalMins: number): string {
  if (totalMins === 1440) return '24:00';
  const normalized = ((totalMins % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/** Calculate end time string ("HH:mm" or "24:00") from start time and duration */
export function calculateEndTime(startTime: string, durationMin: number): string {
  const startMins = timeToMinutes(startTime);
  const total = startMins + durationMin;
  if (total === 1440) return '24:00';
  return minutesToTime(total);
}

/**
 * Calculate duration in minutes between start time and end time for same-day intervals.
 * If end time is before or equal to start time (or crosses midnight), returns 0.
 */
export function calculateDuration(startTime: string, endTime: string): number {
  if (!validateStartTime(startTime) || !validateEndTimeFormat(endTime)) return 0;
  const startMins = timeToMinutes(startTime);
  const endMins = timeToMinutes(endTime);
  if (endMins > startMins) {
    return endMins - startMins;
  }
  return 0;
}

/**
 * Validates start time, end time, and duration consistently.
 * Enforces:
 * 1. Valid formats for start (00:00 - 23:59) and end (00:05 - 24:00).
 * 2. Duration bounds (5 to 480 minutes).
 * 3. End time strictly after start time on the same day.
 * 4. Overnight block prevention: block must end by 24:00 of the same calendar day.
 * 5. Value agreement: expected end time from start + duration must match end time.
 */
export function validateBlockTiming(
  startTime: string,
  endTime: string,
  durationMin: number
): BlockTimingValidation {
  if (!validateStartTime(startTime)) {
    return {
      valid: false,
      error: 'Start time must be in HH:mm 24-hour format (e.g. 09:30 or 14:00).',
    };
  }

  if (!validateEndTimeFormat(endTime)) {
    return {
      valid: false,
      error: 'End time must be in HH:mm 24-hour format (e.g. 10:30 or 24:00).',
    };
  }

  if (!validateDurationMin(durationMin)) {
    return {
      valid: false,
      error: 'Duration must be between 5 and 480 minutes.',
    };
  }

  const startMins = timeToMinutes(startTime);
  const endMins = timeToMinutes(endTime);

  // 1. Same-day order validation: end must be after start
  if (endMins <= startMins) {
    return {
      valid: false,
      error: 'End time must be after start time on the same day. Overnight blocks spanning past midnight are not supported.',
    };
  }

  // 2. Block cannot extend past midnight (24:00 / 1440 min)
  if (startMins + durationMin > 1440 || endMins > 1440) {
    return {
      valid: false,
      error: 'Block cannot extend past midnight (24:00). Overnight blocks spanning past midnight are not supported.',
    };
  }

  // 3. Agreement / synchronisation check between start, end, and duration
  const expectedEndMins = startMins + durationMin;
  if (endMins !== expectedEndMins) {
    const expectedEndStr = minutesToTime(expectedEndMins);
    return {
      valid: false,
      error: `Start time (${startTime}), end time (${endTime}), and duration (${durationMin}m) disagree. With start ${startTime} and duration ${durationMin}m, expected end time is ${expectedEndStr}.`,
    };
  }

  return {
    valid: true,
    startMinutes: startMins,
    endMinutes: endMins,
    durationMin,
  };
}

/**
 * Check if two time intervals overlap on the same date.
 * Touching intervals (e.g. 09:00-10:00 and 10:00-11:00) do NOT overlap.
 */
export function hasOverlap(startA: string, durA: number, startB: string, durB: number): boolean {
  if (!validateStartTime(startA) || !validateStartTime(startB)) return false;
  if (!validateDurationMin(durA) || !validateDurationMin(durB)) return false;
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

/** Recovery Slot suggestion structure */
export interface RecoverySlot {
  startTime: string;
  endTime: string;
  durationMin: number;
}

/**
 * Find the next chronological pending block on targetDate starting at or after referenceStartTime.
 */
export function getNextPendingBlock(
  blocks: TimetableBlock[],
  targetDate: string,
  referenceStartTime: string,
  excludeBlockId?: string
): TimetableBlock | null {
  const refMins = timeToMinutes(referenceStartTime);

  const candidates = blocks.filter((b) => {
    if (b.id === excludeBlockId) return false;
    if (b.date !== targetDate) return false;
    if (b.status !== 'pending') return false;
    return timeToMinutes(b.startTime) >= refMins;
  });

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
  return candidates[0];
}

/**
 * Find the earliest conflict-free available slot on targetDate for a given duration,
 * starting from afterTime and ending by maxEndTime (default "24:00").
 */
export function findRecoverySlot(
  blocks: TimetableBlock[],
  targetDate: string,
  durationMin: number,
  afterTime: string,
  excludeBlockId?: string,
  maxEndTime: string = '24:00'
): RecoverySlot | null {
  if (!validateDurationMin(durationMin)) return null;

  const afterMins = timeToMinutes(afterTime);
  const maxEndMins = timeToMinutes(maxEndTime);

  // Align start search to the next 15-minute boundary
  let candidateStartMins = Math.ceil(afterMins / 15) * 15;

  while (candidateStartMins + durationMin <= maxEndMins) {
    const candidateStart = minutesToTime(candidateStartMins);
    const conflicts = findConflictingBlocks(
      blocks,
      targetDate,
      candidateStart,
      durationMin,
      excludeBlockId
    );

    if (conflicts.length === 0) {
      return {
        startTime: candidateStart,
        endTime: minutesToTime(candidateStartMins + durationMin),
        durationMin,
      };
    }

    candidateStartMins += 15;
  }

  return null;
}

