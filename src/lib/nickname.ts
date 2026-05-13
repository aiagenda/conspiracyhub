const MIN = 2;
const MAX = 40;

export type NicknameParseResult =
  | { ok: true; value: string | null }
  | { ok: false; error: "nickname_too_short" | "nickname_too_long" | "nickname_chars" };

/** Collapse whitespace; empty input → null (clear profile nickname). */
export function parseNicknameInput(raw: unknown): NicknameParseResult {
  if (raw === null || raw === undefined) return { ok: true, value: null };
  if (typeof raw !== "string") return { ok: false, error: "nickname_chars" };
  const t = raw.trim().replace(/\s+/g, " ");
  if (t.length === 0) return { ok: true, value: null };
  if (t.length < MIN) return { ok: false, error: "nickname_too_short" };
  if (t.length > MAX) return { ok: false, error: "nickname_too_long" };
  if (!/^[\p{L}\p{N}_\-\. ]+$/u.test(t)) return { ok: false, error: "nickname_chars" };
  return { ok: true, value: t };
}

export function nicknameFromAuthMetadata(meta: Record<string, unknown> | undefined): string | null {
  const raw = meta?.nickname;
  if (typeof raw !== "string") return null;
  const parsed = parseNicknameInput(raw);
  return parsed.ok ? parsed.value : null;
}
