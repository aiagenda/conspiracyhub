import { timingSafeEqual } from "node:crypto";

/** No environment, including development, authorizes an absent scheduler secret. */
export function checkCronAuth(authHeader: string | null): boolean {
  const configured = process.env.CRON_SECRET?.trim();
  const match = /^Bearer\s+(\S+)$/i.exec(authHeader ?? "");
  if (!configured || !match) return false;
  const candidate = Buffer.from(match[1]);
  const expected = Buffer.from(configured);
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}
