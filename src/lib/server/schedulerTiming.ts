/** UTC cron evaluation, independent of the database and external integrations. */
const RANGES = [[0, 59], [0, 23], [1, 31], [1, 12], [0, 7]] as const;

function parseField(field: string, min: number, max: number): Set<number> | null {
  const values = new Set<number>();
  for (const token of field.split(",")) {
    const match = /^(\*|\d+(?:-\d+)?)(?:\/(\d+))?$/.exec(token);
    if (!match) return null;
    const step = Number(match[2] ?? 1);
    if (!Number.isInteger(step) || step < 1 || step > max - min + 1) return null;
    let start: number;
    let end: number;
    if (match[1] === "*") [start, end] = [min, max];
    else {
      const bounds = match[1].split("-").map(Number);
      start = bounds[0];
      end = bounds[1] ?? (match[2] ? max : start);
    }
    if (start < min || end > max || start > end) return null;
    for (let n = start; n <= end; n += step) values.add(n);
  }
  return values.size ? values : null;
}

function compile(cron: string) {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const fields = parts.map((part, i) => parseField(part, RANGES[i][0], RANGES[i][1]));
  if (fields.some((field) => !field)) return null;
  return (date: Date): boolean => {
    const dayOfMonth = fields[2]!.has(date.getUTCDate());
    const dayOfWeek = fields[4]!.has(date.getUTCDay()) || (date.getUTCDay() === 0 && fields[4]!.has(7));
    // Standard cron: when both day fields are restricted, either may match.
    const dayMatches = parts[2].startsWith("*") || parts[4].startsWith("*")
      ? dayOfMonth && dayOfWeek : dayOfMonth || dayOfWeek;
    return fields[0]!.has(date.getUTCMinutes()) && fields[1]!.has(date.getUTCHours())
      && fields[3]!.has(date.getUTCMonth() + 1) && dayMatches;
  };
}

export function isValidCron(cron: string): boolean { return compile(cron) !== null; }
export function matchesCronNow(cron: string, now = new Date()): boolean {
  return compile(cron)?.(now) ?? false;
}

/** One catch-up occurrence, never an unbounded replay of missed historical work. */
export function cronOccurrence(cron: string, anchor: Date, direction: "next" | "previous"): Date {
  const matches = compile(cron);
  if (!matches || !Number.isFinite(anchor.getTime())) throw new Error("Invalid UTC cron schedule");
  const minute = 60_000;
  const step = direction === "next" ? minute : -minute;
  let at = Math.floor(anchor.getTime() / minute) * minute + (direction === "next" ? minute : 0);
  // Covers annual schedules and leap-day schedules without an infinite loop.
  for (let i = 0; i < 5 * 366 * 24 * 60; i++, at += step) {
    const date = new Date(at);
    if (matches(date)) return date;
  }
  throw new Error("Cron schedule has no occurrence in the next five years");
}

export function scheduleDueAt(
  job: { schedule_cron: string; next_run_at?: string | null; retry_at?: string | null },
  now = new Date(),
  latestCompletedAt?: string | null,
): Date {
  if (job.retry_at) return new Date(job.retry_at);
  if (job.next_run_at) return new Date(job.next_run_at);
  const previous = cronOccurrence(job.schedule_cron, now, "previous");
  return latestCompletedAt && Date.parse(latestCompletedAt) >= previous.getTime()
    ? cronOccurrence(job.schedule_cron, now, "next") : previous;
}
