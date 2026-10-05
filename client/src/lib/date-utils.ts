function parseDate(value: string) { const [year, month, day] = value.split("-").map(Number); return new Date(Date.UTC(year, month - 1, day)); }
export function calculateBusinessDays(startDate: string, endDate: string, startHalfDay = false, endHalfDay = false) {
  if (!startDate || !endDate) return 0;
  const start = parseDate(startDate); const end = parseDate(endDate); if (Number.isNaN(start.getTime()) || start > end) return 0;
  let days = 0; const cursor = new Date(start);
  while (cursor <= end) { const weekday = cursor.getUTCDay(); if (weekday !== 0 && weekday !== 6) days += 1; cursor.setUTCDate(cursor.getUTCDate() + 1); }
  if (!days) return 0; if (startHalfDay) days -= 0.5; if (endHalfDay && startDate !== endDate) days -= 0.5; if (startHalfDay && startDate === endDate && !endHalfDay) days = 0.5; return Math.max(0.5, days);
}
