// Signierte Tokens (HMAC-SHA256) – funktioniert mit Web Crypto in der
// Edge-Middleware und in Node-Funktionen.

export const COOKIE_NAME = "mk_admin";
export const SESSION_TTL = 8 * 60 * 60; // 8 Stunden
export const PRE_TTL = 5 * 60; // Passwort ok, 2FA ausstehend

const enc = new TextEncoder();

function b64url(bytes) {
  let s = "";
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(secret, data) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

function eq(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export async function signToken(secret, kind, ttl) {
  const nonce = b64url(crypto.getRandomValues(new Uint8Array(12)));
  const body = `${kind}.${Math.floor(Date.now() / 1000) + ttl}.${nonce}`;
  return body + "." + (await hmac(secret, body));
}

export async function verifyToken(secret, token, kind) {
  if (!secret || secret.length < 32 || typeof token !== "string") return false;
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== kind) return false;
  const exp = Number(parts[1]);
  if (!Number.isFinite(exp) || exp < Date.now() / 1000) return false;
  const body = parts.slice(0, 3).join(".");
  return eq(parts[3], await hmac(secret, body));
}

export function readCookie(header, name = COOKIE_NAME) {
  if (!header) return null;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

export async function isAdminRequest(cookieHeader, secret) {
  return verifyToken(secret, readCookie(cookieHeader), "s");
}
