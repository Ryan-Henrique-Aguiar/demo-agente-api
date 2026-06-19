import { Weekday } from '@prisma/client';

const SLOT_MINUTES = 30;

const WEEKDAY_MAP: Record<number, Weekday> = {
  0: Weekday.SUNDAY,
  1: Weekday.MONDAY,
  2: Weekday.TUESDAY,
  3: Weekday.WEDNESDAY,
  4: Weekday.THURSDAY,
  5: Weekday.FRIDAY,
  6: Weekday.SATURDAY,
};

/** Converte "HH:MM" em minutos desde meia-noite. */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** Converte minutos desde meia-noite em "HH:MM". */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

/** Gera todos os slots de 30 min dentro de [startTime, endTime). */
export function generateSlots(startTime: string, endTime: string): string[] {
  const slots: string[] = [];
  let cur = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  while (cur + SLOT_MINUTES <= end) {
    slots.push(minutesToTime(cur));
    cur += SLOT_MINUTES;
  }
  return slots;
}

/** Retorna o Weekday enum para uma data "YYYY-MM-DD". */
export function getWeekday(dateStr: string): Weekday {
  const [y, mo, d] = dateStr.split('-').map(Number);
  return WEEKDAY_MAP[new Date(y, mo - 1, d).getDay()];
}

/** Formata Date para "YYYY-MM-DD" no fuso local. */
export function formatDateLocal(date: Date): string {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Adiciona N dias a uma data "YYYY-MM-DD". */
export function addDays(dateStr: string, days: number): string {
  const [y, mo, d] = dateStr.split('-').map(Number);
  return formatDateLocal(new Date(y, mo - 1, d + days));
}

export const SLOT_DURATION_MINUTES = SLOT_MINUTES;
