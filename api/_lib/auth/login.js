// Schritt 1: Passwort. Liefert bei Erfolg ein 5-Minuten-Zwischentoken für die 2FA.
import { send, env, guard, body, clientIp, isConfigured } from "../http.js";
import { verifyPassword } from "../crypto.js";
import { lockedFor, fail, slow } from "../limiter.js";
import { signToken, PRE_TTL } from "../../../lib/session.js";

export default async function handler(req, res) {
  if (!(await guard(req, res, { method: "POST", auth: false }))) return;
  if (!isConfigured()) return send(res, 503, { error: "Admin ist noch nicht eingerichtet (siehe /admin/setup.html)" });
  const ip = clientIp(req);
  const locked = lockedFor(ip);
  if (locked) return send(res, 429, { error: `Zu viele Versuche. Bitte in ${Math.ceil(locked / 60000)} Min. erneut versuchen.` });
  const { password } = await body(req);
  await slow();
  if (!verifyPassword(String(password || ""), env().passwordHash)) {
    fail(ip);
    return send(res, 401, { error: "Falsches Passwort" });
  }
  send(res, 200, { ok: true, pre: await signToken(env().sessionSecret, "p", PRE_TTL) });
}
