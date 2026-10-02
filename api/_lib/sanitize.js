// Kunden dürfen Texte, Bilder, Links und Reihenfolge ändern – aber keine
// Skripte einschleusen. Ihre Seite läuft unter derselben Domain wie /admin,
// ein fremdes Skript könnte sonst die Sitzung des Betreibers missbrauchen.

const SCRIPT_RE = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
const HANDLER_RE = /\s(on[a-z]+)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
const DANGER_TAG_RE = /<(iframe|object|embed|base|frame|frameset|applet)\b/gi;
const META_REFRESH_RE = /<meta\b[^>]*http-equiv/gi;
const STYLE_RE = /<style\b/gi;
const JS_URL_RE = /(?:href|src|action|formaction|xlink:href)\s*=\s*["']?\s*(?:javascript|vbscript|data:text\/html)/gi;
const OVERRIDES_SCRIPT = /^\s*src\s*=\s*["']?mk-i18n\.js["']?(\s+defer(=["']{2})?)?\s*$/i;

function bag(list) {
  const m = new Map();
  for (const x of list) m.set(x, (m.get(x) || 0) + 1);
  return m;
}
function extra(oldList, newList) {
  const b = bag(oldList);
  return newList.filter(x => { const n = b.get(x) || 0; if (n) { b.set(x, n - 1); return false; } return true; });
}
const norm = s => String(s).replace(/\s+/g, " ").trim();

function scripts(html) {
  return [...html.matchAll(SCRIPT_RE)].map(m => {
    const attrs = norm(m[1]).replace(/="([^"]*)"/g, "=$1").replace(/='([^']*)'/g, "=$1").replace(/\s(defer|async)=(?=\s|$)/g, " $1");
    return attrs + "|" + norm(m[2]);
  });
}
function handlers(html) {
  return [...html.matchAll(HANDLER_RE)].map(m => m[1].toLowerCase() + "=" + norm(m[2].replace(/^["']|["']$/g, "")));
}
const count = (re, s) => (s.match(re) || []).length;

// Das Admin-eigene Style zum Ausblenden ([data-mk-off]) ist erlaubt, solange es nur Selektoren enthält.
const MK_STYLE_RE = /<style id="mk-admin-style">([^<]*)<\/style>/g;
function withoutAdminStyle(html) {
  return html.replace(MK_STYLE_RE, (m, css) => (/^[\w\s\[\]="#:,!{}.\-]*$/.test(css) && !/url\(|@import|expression\(/i.test(css) ? "" : m));
}

/** Liefert einen Fehlertext, wenn das neue HTML mehr ausführbaren Code enthält als das alte. */
export function checkClientHtml(oldHtml, newHtml) {
  oldHtml = withoutAdminStyle(oldHtml); newHtml = withoutAdminStyle(newHtml);
  const added = extra(scripts(oldHtml), scripts(newHtml)).filter(s => !OVERRIDES_SCRIPT.test(s.split("|")[0]) || s.split("|")[1]);
  if (added.length) return "Skripte dürfen im Kunden-Admin nicht verändert werden.";
  if (extra(handlers(oldHtml), handlers(newHtml)).length) return "Ereignis-Attribute (on…) sind nicht erlaubt.";
  if (count(DANGER_TAG_RE, newHtml) > count(DANGER_TAG_RE, oldHtml)) return "Eingebettete Fremdinhalte (iframe/object/embed) sind nicht erlaubt.";
  if (count(META_REFRESH_RE, newHtml) > count(META_REFRESH_RE, oldHtml)) return "Diese Änderung ist nicht erlaubt.";
  if (count(JS_URL_RE, newHtml) > count(JS_URL_RE, oldHtml)) return "javascript:-Links sind nicht erlaubt.";
  if (count(STYLE_RE, newHtml) > count(STYLE_RE, oldHtml)) return "Eigene Stylesheets sind nicht erlaubt.";
  if (count(/<link\b/gi, newHtml) > count(/<link\b/gi, oldHtml)) return "Diese Änderung ist nicht erlaubt.";
  return null;
}

const BAD_TEXT = /<\s*\/?\s*(script|iframe|object|embed|style|link|meta|base|form|svg|math)\b|\son[a-z]+\s*=|javascript:|vbscript:|data:text\/html/i;

/** Texte (Übersetzungen) werden per innerHTML eingesetzt – nur harmloses Inline-HTML erlauben. */
export function checkOverrides(o) {
  for (const map of Object.values(o || {})) for (const v of Object.values(map || {})) {
    if (BAD_TEXT.test(String(v))) return "Dieser Text enthält nicht erlaubten Code.";
  }
  return null;
}
