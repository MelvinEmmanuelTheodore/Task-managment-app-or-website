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
  if (day < 1 || day > 31) return false;
  return true;
}

