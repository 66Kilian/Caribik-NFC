// Einfacher Schutz gegen Durchprobieren. Er lebt im Speicher der jeweiligen
// Funktionsinstanz; zusammen mit Passwort + 2FA reicht das für einen
// einzelnen Admin-Zugang.
const fails = new Map(); // ip -> { n, until }
const usedCodes = new Map(); // step -> expiresAt

const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;

export function lockedFor(ip) {
  const f = fails.get(ip);
  if (!f || !f.until) return 0;
  const left = f.until - Date.now();
  if (left <= 0) { fails.delete(ip); return 0; }
  return left;
}

export function fail(ip) {
  const f = fails.get(ip) || { n: 0, until: 0 };
  f.n++;
  if (f.n >= MAX_FAILS) { f.until = Date.now() + LOCK_MS; f.n = 0; }
  fails.set(ip, f);
}

export function success(ip) { fails.delete(ip); }

/** Ein TOTP-Code darf nur einmal verwendet werden (je Konto). */
export function consumeStep(step, scope = "owner") {
  const now = Date.now(), key = scope + ":" + step;
  for (const [k, exp] of usedCodes) if (exp < now) usedCodes.delete(k);
  if (usedCodes.has(key)) return false;
  usedCodes.set(key, now + 3 * 60 * 1000);
  return true;
}

export const slow = () => new Promise(r => setTimeout(r, 400 + Math.random() * 400));

export function _reset() { fails.clear(); usedCodes.clear(); }
