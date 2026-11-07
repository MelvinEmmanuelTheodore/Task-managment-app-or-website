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
    toDate: () => new Date(ms),
    toMillis: () => ms,
    toISOString: () => new Date(ms).toISOString(),
  };
}

/** Get the current calendar day formatted as "YYYY-MM-DD" in IST */
export function getCurrentISTDate(): string {
  const now = new Date();
  const istDate = new Date(now.getTime() + IST_OFFSET_MS);
  return istDate.toISOString().split('T')[0];
}

/** Format a timestamp or Date for display in 12h IST time with AM/PM */
export function formatTimeIST(dateOrTimestamp: Date | AppTimestamp): string {
  const date = 'toDate' in dateOrTimestamp ? dateOrTimestamp.toDate() : dateOrTimestamp;
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
