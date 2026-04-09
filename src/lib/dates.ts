/** Local calendar day as YYYY-MM-DD (server timezone). */
export function dayKeyLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parse YYYY-MM-DD into start of that local calendar day. */
export function startOfLocalDayFromKey(dateKey: string): Date {
  const [ys, ms, ds] = dateKey.split("-");
  const y = Number(ys);
  const m = Number(ms);
  const d = Number(ds);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

export function addLocalDays(dateKey: string, delta: number): string {
  const d = startOfLocalDayFromKey(dateKey);
  d.setDate(d.getDate() + delta);
  return dayKeyLocal(d);
}

/** Last `count` local calendar days ending at `end` (inclusive), newest first. */
export function recentDayKeys(end: Date, count: number): string[] {
  const keys: string[] = [];
  let d = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 12, 0, 0, 0);
  for (let i = 0; i < count; i++) {
    keys.push(dayKeyLocal(d));
    d.setDate(d.getDate() - 1);
  }
  return keys;
}

/** Inclusive lower bound and exclusive upper bound in ISO for SQL filtering. */
export function isoRangeForDayKeys(keys: string[]): { fromIso: string; untilIso: string } {
  if (keys.length === 0) {
    const now = new Date();
    return { fromIso: now.toISOString(), untilIso: now.toISOString() };
  }
  const sorted = [...keys].sort();
  const oldest = sorted[0]!;
  const newest = sorted[sorted.length - 1]!;
  const from = startOfLocalDayFromKey(oldest);
  const until = startOfLocalDayFromKey(addLocalDays(newest, 1));
  return { fromIso: from.toISOString(), untilIso: until.toISOString() };
}
