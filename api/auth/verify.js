// Schritt 2: 6-stelliger Code aus der Authenticator-App → Sitzung.
import { send, env, guard, body, clientIp, setSessionCookie } from "../_lib/http.js";
import { verifyTotp } from "../_lib/crypto.js";
import { lockedFor, fail, success, consumeStep, slow } from "../_lib/limiter.js";
import { signToken, verifyToken, SESSION_TTL } from "../../lib/session.js";

export default async function handler(req, res) {
  if (!(await guard(req, res, { method: "POST", auth: false }))) return;
  const ip = clientIp(req);
  const locked = lockedFor(ip);
  if (locked) return send(res, 429, { error: `Zu viele Versuche. Bitte in ${Math.ceil(locked / 60000)} Min. erneut versuchen.` });
  const { pre, code } = await body(req);
  const e = env();
  await slow();
  if (!(await verifyToken(e.sessionSecret, pre, "p"))) return send(res, 401, { error: "Sitzung abgelaufen – bitte Passwort erneut eingeben", restart: true });
  const step = verifyTotp(e.totpSecret, code);
  if (step === null || !consumeStep(step)) {
    fail(ip);
    return send(res, 401, { error: "Code ungültig oder schon verwendet" });
  }
  success(ip);
  setSessionCookie(req, res, await signToken(e.sessionSecret, "s", SESSION_TTL), SESSION_TTL);
  send(res, 200, { ok: true });
}
