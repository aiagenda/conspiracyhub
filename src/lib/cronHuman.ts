/**
 * Plain-language summary of a 5-field cron string, matching how
 * {@link matchesCronNow} interprets it: all times are UTC.
 */
export function humanizeCronUtc(cronExpr: string): string {
  const parts = cronExpr.trim().split(/\s+/).filter(Boolean);
  if (parts.length !== 5) {
    return "Use exactly 5 fields separated by spaces: minute · hour · day-of-month · month · weekday. Everything is evaluated in UTC.";
  }

  const [minRaw, hourRaw, dom, mon, dow] = parts;

  if (dom !== "*" || mon !== "*" || dow !== "*") {
    return `Custom calendar rule (UTC). When day-of-month, month, or weekday are not “*”, the pattern is more specific than a simple repeat — raw: ${cronExpr}`;
  }

  // Every minute
  if (minRaw === "*" && hourRaw === "*") {
    return "Every minute (UTC). Very frequent — usually only the Vercel tick uses this style.";
  }

  // Every hour at fixed minute: "30 * * * *"
  if (hourRaw === "*" && /^\d{1,2}$/.test(minRaw)) {
    const m = Math.min(59, parseInt(minRaw, 10));
    return `Once every hour at ${String(m).padStart(2, "0")} minutes past the hour, 24× per day (UTC).`;
  }

  // Every N hours at fixed minute: "15 */6 * * *"
  if (hourRaw.startsWith("*/")) {
    const step = parseInt(hourRaw.slice(2), 10);
    if (!Number.isFinite(step) || step < 1 || step > 23) {
      return `Hour field uses a step (UTC). Expression: ${cronExpr}`;
    }
    if (/^\d{1,2}$/.test(minRaw)) {
      const m = Math.min(59, parseInt(minRaw, 10));
      const slots: string[] = [];
      for (let h = 0; h < 24; h += step) {
        slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
      }
      const stepLabel =
        step === 1
          ? "Every hour"
          : step === 2
            ? "Every 2 hours"
            : step === 3
              ? "Every 3 hours"
              : step === 4
                ? "Every 4 hours"
                : step === 6
                  ? "Every 6 hours"
                  : step === 12
                    ? "Every 12 hours"
                    : `Every ${step} hours`;
      return `${stepLabel}, at ${String(m).padStart(2, "0")} minutes past the hour (UTC). Clock times: ${slots.join(", ")}.`;
    }
  }

  // Once daily "M H * * *"
  if (/^\d{1,2}$/.test(minRaw) && /^\d{1,2}$/.test(hourRaw)) {
    const h = Math.min(23, parseInt(hourRaw, 10));
    const m = Math.min(59, parseInt(minRaw, 10));
    return `Once per day at ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} UTC.`;
  }

  return `Custom pattern (UTC). Order is: minute · hour · day-of-month · month · weekday. Current: ${cronExpr}`;
}
