import { COOKIE_NAME, isAdminRequest } from "../../lib/session.js";

export function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex");
  res.end(JSON.stringify(body));
}

export function env() {
  return {
    passwordHash: process.env.ADMIN_PASSWORD_HASH || "",
    totpSecret: process.env.ADMIN_TOTP_SECRET || "",
    sessionSecret: process.env.ADMIN_SESSION_SECRET || "",
  };
}

export function isConfigured() {
  const e = env();
  return Boolean(e.passwordHash && e.totpSecret && e.sessionSecret.length >= 32);
}

export function clientIp(req) {
  const f = req.headers["x-forwarded-for"];
  return (Array.isArray(f) ? f[0] : String(f || "")).split(",")[0].trim() || req.socket?.remoteAddress || "?";
}

export function isSecure(req) {
  const proto = req.headers["x-forwarded-proto"];
  if (proto) return String(proto).split(",")[0].trim() === "https";
  return !/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(String(req.headers.host || ""));
}

export function setSessionCookie(req, res, value, maxAge, name = COOKIE_NAME) {
  const parts = [`${name}=${encodeURIComponent(value)}`, "Path=/", "HttpOnly", "SameSite=Strict", `Max-Age=${maxAge}`];
  if (isSecure(req)) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

// Schutz gegen CSRF: nur JSON-POSTs von derselben Herkunft mit eigenem Header.
function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true; // manche Browser senden bei same-origin kein Origin
  try { return new URL(origin).host === req.headers.host; } catch { return false; }
}

/** Methode prüfen, CSRF prüfen und (optional) Login verlangen. */
export async function guard(req, res, { method = "GET", auth = true } = {}) {
  if (req.method !== method) { send(res, 405, { error: "Methode nicht erlaubt" }); return false; }
  if (method !== "GET") {
    if (req.headers["x-mk-admin"] !== "1" || !sameOrigin(req)) { send(res, 403, { error: "Ungültige Anfrage" }); return false; }
  }
  if (auth && !(await isAdminRequest(req.headers.cookie, env().sessionSecret))) {
    send(res, 401, { error: "Nicht angemeldet" });
    return false;
  }
  return true;
}

export async function body(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") { try { return JSON.parse(req.body); } catch { return {}; } }
  return {};
}
