// Local leaderboard rules (Ticket-04 §3). Pure functions shared by the server (scripts/serve.js),
// the browser (src/web/main.js) and the tests.

export const LEADERBOARD_SIZE = 10;

/** 3-12 characters from [A-Za-z0-9_]; Vietnamese (any Unicode letter, NFC) is accepted as a bonus. */
export function normalizeName(raw) {
  return String(raw ?? '').normalize('NFC').trim();
}
export function isValidName(raw) {
  const name = normalizeName(raw);
  const len = [...name].length;
  return len >= 3 && len <= 12 && /^[\p{L}\p{N}_]+$/u.test(name);
}

/** ISO 8601 with the local timezone offset, e.g. 2026-11-20T21:30:05+07:00. */
export function isoWithOffset(date = new Date()) {
  const pad = (n) => String(Math.abs(n)).padStart(2, '0');
  const off = -date.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${sign}${pad(Math.trunc(off / 60))}:${pad(off % 60)}`;
}

/** Sort: score desc, then whoever reached it first (earlier achieved_at) on top. */
export function sortEntries(entries) {
  return [...entries].sort((a, b) => b.score - a.score || Date.parse(a.achieved_at) - Date.parse(b.achieved_at));
}

/** Validates and inserts; returns { entries (top 10), rank (1-based or null if it did not make it) }. */
export function addEntry(entries, { name, score, nights_won, seed, achieved_at = isoWithOffset() }) {
  if (!isValidName(name)) throw new Error('name must be 3-12 letters, digits or _');
  if (!Number.isInteger(score) || score < 0) throw new Error('score must be a non-negative integer');
  if (!Number.isInteger(nights_won) || nights_won < 0 || nights_won > 3) throw new Error('nights_won must be 0-3');
  if (!Number.isInteger(seed)) throw new Error('seed must be an integer');
  const entry = { name: normalizeName(name), score, nights_won, achieved_at, seed };
  const all = sortEntries([...entries, entry]);
  const top = all.slice(0, LEADERBOARD_SIZE);
  const idx = top.indexOf(entry);
  return { entries: top, rank: idx >= 0 ? idx + 1 : null };
}
