/** Timetable Block Input Validators */

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
  // This correctly rejects invalid calendar dates like 2026-02-29, 2026-02-31, 2026-04-31, while accepting leap years (e.g. 2024-02-29)
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

