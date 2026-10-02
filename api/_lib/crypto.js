import { createHmac, createHash, createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";

// Passwort-Hash-Format: pbkdf2$<iterationen>$<salt base64>$<hash base64>
// (wird im Browser unter /admin/setup.html erzeugt)
export function verifyPassword(password, stored) {
  if (typeof password !== "string" || !stored) return false;
  const [algo, iter, salt, hash] = String(stored).split("$");
  if (algo !== "pbkdf2" || !iter || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const got = pbkdf2Sync(password.normalize("NFC"), Buffer.from(salt, "base64"), Number(iter), expected.length, "sha256");
  return got.length === expected.length && timingSafeEqual(got, expected);
}

function base32Decode(s) {
  const alpha = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  s = String(s).toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0, val = 0;
  const out = [];
  for (const c of s) {
    val = (val << 5) | alpha.indexOf(c);
    bits += 5;
    if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}

export function totpAt(secret, counter) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const h = createHmac("sha1", base32Decode(secret)).update(buf).digest();
  const o = h[h.length - 1] & 15;
  const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1000000).padStart(6, "0");
}

/** Liefert den Zeitschritt des gültigen Codes (±30 s Toleranz) oder null. */
export function verifyTotp(secret, code, now = Date.now()) {
  code = String(code || "").replace(/\s/g, "");
  if (!secret || !/^\d{6}$/.test(code)) return null;
  const step = Math.floor(now / 30000);
  for (const d of [0, -1, 1]) {
    const a = Buffer.from(totpAt(secret, step + d));
    if (timingSafeEqual(a, Buffer.from(code))) return step + d;
  }
  return null;
}

// ------------------------------------------------ Kunden-Konten
const PBKDF2_ITER = 210000;

export function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(String(password).normalize("NFC"), salt, PBKDF2_ITER, 32, "sha256");
  return `pbkdf2$${PBKDF2_ITER}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export function randomToken(bytes = 32) { return randomBytes(bytes).toString("base64url"); }
export function sha256(s) { return createHash("sha256").update(String(s)).digest("hex"); }

export function randomBase32(len = 32) {
  const alpha = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567", b = randomBytes(len);
  let s = "";
  for (const x of b) s += alpha[x & 31];
  return s;
}

// AES-256-GCM. Der Schlüssel wird aus MK_DATA_KEY (oder ersatzweise
// ADMIN_SESSION_SECRET) abgeleitet – das Repo ist öffentlich, die Datei nicht lesbar.
function dataKey() {
  const secret = process.env.MK_DATA_KEY || process.env.ADMIN_SESSION_SECRET || "";
  if (secret.length < 32) throw new Error("MK_DATA_KEY fehlt (mind. 32 Zeichen, Vercel → Environment Variables)");
  return createHash("sha256").update("mk-accounts\0" + secret).digest();
}

export function encryptJson(obj) {
  const iv = randomBytes(12), c = createCipheriv("aes-256-gcm", dataKey(), iv);
  const data = Buffer.concat([c.update(JSON.stringify(obj), "utf8"), c.final()]);
  return JSON.stringify({ v: 1, iv: iv.toString("base64"), tag: c.getAuthTag().toString("base64"), data: data.toString("base64") }) + "\n";
}

export function decryptJson(text) {
  const o = JSON.parse(text);
  const d = createDecipheriv("aes-256-gcm", dataKey(), Buffer.from(o.iv, "base64"));
  d.setAuthTag(Buffer.from(o.tag, "base64"));
  return JSON.parse(Buffer.concat([d.update(Buffer.from(o.data, "base64")), d.final()]).toString("utf8"));
}
