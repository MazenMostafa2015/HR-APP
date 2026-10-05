export type LeaveDayOptions = {
  startDate: string;
  endDate: string;
  startHalfDay?: boolean;
  endHalfDay?: boolean;
  holidays?: string[];
};

function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function calculateBusinessDays(options: LeaveDayOptions): number {
  const start = parseDate(options.startDate);
  const end = parseDate(options.endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return 0;

  const holidaySet = new Set(options.holidays ?? []);
  let days = 0;
  const cursor = new Date(start);

  while (cursor <= end) {
    const weekday = cursor.getUTCDay();
    if (weekday !== 0 && weekday !== 6 && !holidaySet.has(dateKey(cursor))) days += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  if (days === 0) return 0;
  if (options.startHalfDay) days -= 0.5;
  if (options.endHalfDay && options.endDate !== options.startDate) days -= 0.5;
  if (options.startHalfDay && options.endDate === options.startDate && !options.endHalfDay) days = 0.5;
  return Math.max(0.5, Number(days.toFixed(2)));
}

export function isValidDateRange(startDate: string, endDate: string) {
  return Boolean(startDate && endDate && parseDate(startDate) <= parseDate(endDate));
}
