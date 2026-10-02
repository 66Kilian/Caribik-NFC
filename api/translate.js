// Automatische Übersetzung (DeepL) für beide Admins: Deutsch → gesperrte Sprachen.
// Benötigt DEEPL_API_KEY (kostenloser DeepL-API-Plan reicht).
import { send, guard, body, env } from "./_lib/http.js";
import { isAdminRequest, clientSiteFromCookie } from "../lib/session.js";

const TARGET = { en: "EN-GB", hu: "HU", sk: "SK", cs: "CS", pl: "PL", it: "IT", fr: "FR", es: "ES", ro: "RO", nl: "NL", pt: "PT-PT", sl: "SL", bg: "BG", uk: "UK", ru: "RU", tr: "TR" };
const MAX = 5000;

export default async function handler(req, res) {
  if (!(await guard(req, res, { method: "POST", auth: false }))) return;
  const secret = env().sessionSecret;
  const ok = (await isAdminRequest(req.headers.cookie, secret)) || (await clientSiteFromCookie(req.headers.cookie, secret));
  if (!ok) return send(res, 401, { error: "Nicht angemeldet" });
  const key = process.env.DEEPL_API_KEY || "";
  if (!key) return send(res, 503, { error: "Automatische Übersetzung ist noch nicht eingerichtet (DEEPL_API_KEY fehlt)." });

  const b = await body(req);
  const text = String(b.text || "");
  if (text.length > MAX) return send(res, 400, { error: "Text zu lang" });
  const langs = [...new Set((b.to || []).map(String))].filter(l => /^[a-z]{2}$/.test(l)).slice(0, 12);
  if (!text.trim()) return send(res, 200, { translations: Object.fromEntries(langs.map(l => [l, ""])) });

  const host = key.endsWith(":fx") ? "https://api-free.deepl.com" : "https://api.deepl.com";
  const out = {}, failed = {};
  await Promise.all(langs.map(async l => {
    if (!TARGET[l]) { failed[l] = "Sprache wird nicht unterstützt"; return; }
    try {
      const r = await fetch(host + "/v2/translate", {
        method: "POST",
        headers: { Authorization: "DeepL-Auth-Key " + key, "Content-Type": "application/json" },
        body: JSON.stringify({ text: [text], source_lang: "DE", target_lang: TARGET[l], tag_handling: "html", preserve_formatting: true }),
      });
      if (!r.ok) { failed[l] = r.status === 456 ? "Monatliches DeepL-Kontingent aufgebraucht" : `DeepL ${r.status}`; return; }
      out[l] = (await r.json()).translations[0].text;
    } catch (e) {
      failed[l] = String(e.message || e);
    }
  }));
  send(res, 200, { translations: out, failed });
}
