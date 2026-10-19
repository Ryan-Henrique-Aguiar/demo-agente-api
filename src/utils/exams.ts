import { addDays, getWeekday, minutesToTime, timeToMinutes } from './availability';

export const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

export function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;
}

export function todayKey(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function examSlots(startTime: string, endTime: string, duration: number): string[] {
  const slots: string[] = [];
  for (let minute = timeToMinutes(startTime); minute + duration <= timeToMinutes(endTime); minute += duration) {
    slots.push(minutesToTime(minute));
  }
  return slots;
}

export { addDays, getWeekday, minutesToTime, timeToMinutes };
