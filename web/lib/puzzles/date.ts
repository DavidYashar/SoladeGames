/** UTC date helpers. The "day" for a daily puzzle is defined by the UTC
 *  calendar date so all players worldwide share the same puzzle day. */

export function dateKey(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateKey(key: string): boolean {
  if (!DATE_RE.test(key)) return false;
  return !Number.isNaN(Date.parse(key));
}

const DAY_MS = 86_400_000;

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(a) - Date.parse(b)) / DAY_MS);
}

export function addDays(key: string, days: number): string {
  return dateKey(new Date(Date.parse(key) + days * DAY_MS));
}
