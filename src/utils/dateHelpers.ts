import { AppTimestamp } from '../types/task';

export const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // +05:30

/** Convert a Date to our serialisable AppTimestamp */
export function dateToAppTimestamp(date: Date): AppTimestamp {
  const ms = date.getTime();
  const seconds = Math.floor(ms / 1000);
  const nanoseconds = (ms % 1000) * 1e6;
  return {
    seconds,
    nanoseconds,
  };
}

/** Convert a serialisable AppTimestamp to a JavaScript Date */
export function appTimestampToDate(ts: AppTimestamp): Date {
  return new Date(ts.seconds * 1000 + Math.floor(ts.nanoseconds / 1e6));
}

/** Convert a serialisable AppTimestamp to epoch milliseconds */
export function appTimestampToMillis(ts: AppTimestamp): number {
  return ts.seconds * 1000 + Math.floor(ts.nanoseconds / 1e6);
}

/** Convert a serialisable AppTimestamp to an ISO 8601 string */
export function appTimestampToISOString(ts: AppTimestamp): string {
  return appTimestampToDate(ts).toISOString();
}

/** Get the current calendar day formatted as "YYYY-MM-DD" in IST */
export function getCurrentISTDate(): string {
  const now = new Date();
  const istDate = new Date(now.getTime() + IST_OFFSET_MS);
  return istDate.toISOString().split('T')[0];
}

/** Format a timestamp or Date for display in 12h IST time with AM/PM */
export function formatTimeIST(dateOrTimestamp: Date | AppTimestamp): string {
  const date = 'seconds' in dateOrTimestamp ? appTimestampToDate(dateOrTimestamp) : dateOrTimestamp;
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

/** Format a date string ("YYYY-MM-DD") for friendly header display */
export function formatDateIST(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

/** Add or subtract days from a "YYYY-MM-DD" string */
export function addDays(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

/** Get Monday of the week for a given date */
export function getStartOfWeek(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = d.getUTCDay(); // 0 is Sunday, 1 is Monday...
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  d.setUTCDate(d.getUTCDate() + diffToMonday);
  return d.toISOString().split('T')[0];
}

/** Get Sunday of the week for a given date */
export function getEndOfWeek(dateStr: string): string {
  return addDays(getStartOfWeek(dateStr), 6);
}

export interface WeekDayInfo {
  date: string;
  dayName: string;
  dayNumber: number;
  isToday: boolean;
}

/** Get all 7 days (Monday to Sunday) for the week containing dateStr */
export function getWeekDays(dateStr: string): WeekDayInfo[] {
  const mondayStr = getStartOfWeek(dateStr);
  const todayStr = getCurrentISTDate();
  const days: WeekDayInfo[] = [];

  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  for (let i = 0; i < 7; i++) {
    const curDate = addDays(mondayStr, i);
    const dayNum = parseInt(curDate.split('-')[2], 10);
    days.push({
      date: curDate,
      dayName: dayNames[i],
      dayNumber: dayNum,
      isToday: curDate === todayStr,
    });
  }

  return days;
}

/** Format week range for header display: e.g. "9 Nov – 15 Nov 2026" */
export function formatWeekRange(startDateStr: string, endDateStr: string): string {
  const [sY, sM, sD] = startDateStr.split('-').map(Number);
  const [eY, eM, eD] = endDateStr.split('-').map(Number);
  const startD = new Date(Date.UTC(sY, sM - 1, sD));
  const endD = new Date(Date.UTC(eY, eM - 1, eD));

  const startFormatted = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
  }).format(startD);

  const endFormatted = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(endD);

  return `${startFormatted} – ${endFormatted}`;
}
