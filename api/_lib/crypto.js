import { createHmac, pbkdf2Sync, timingSafeEqual } from "node:crypto";

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
