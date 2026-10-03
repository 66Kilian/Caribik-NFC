// Impressum je Seite: Daten aus data/sites.json (Admin → Einstellungen → Impressum),
// ausgeliefert unter /<slug>/impressum/ (bzw. /impressum/ auf Subdomain und Startseite).
// Pflichtangaben nach § 5 ECG, § 14 UGB, § 63 GewO und § 25 MedienG.

export const IMPRESSUM_FIELDS = [
  // key, Bezeichnung im Impressum, Pflicht?
  ["name", "Name / Firma", true],
  ["legal", "Rechtsform", false],
  ["street", "Straße und Hausnummer", true],
  ["zip", "PLZ", true],
  ["city", "Ort", true],
  ["country", "Land", false],
  ["email", "E-Mail", true],
  ["phone", "Telefon", false],
  ["uid", "UID-Nummer", false],
  ["gisa", "GISA-Zahl", false],
  ["fn", "Firmenbuchnummer", false],
  ["court", "Firmenbuchgericht", false],
  ["purpose", "Unternehmensgegenstand", true],
  ["chamber", "Kammer / Berufsverband", false],
  ["authority", "Aufsichtsbehörde", false],
  ["media", "Medieninhaber, Herausgeber & inhaltlich verantwortlich", false],
  ["extra", "Weitere Angaben", false],
];
const KEYS = IMPRESSUM_FIELDS.map(f => f[0]);
export const IMPRESSUM_REQUIRED = IMPRESSUM_FIELDS.filter(f => f[2]).map(f => f[0]);

/** Bereinigt die Eingabe aus dem Admin (nur bekannte Felder, Länge begrenzt). */
export function cleanImpressum(o) {
  const out = {};
  if (!o || typeof o !== "object") return out;
  for (const k of KEYS) {
    const v = String(o[k] == null ? "" : o[k]).replace(/\r/g, "").trim();
    if (v) out[k] = v.slice(0, k === "extra" ? 2000 : 300);
  }
  return out;
}

/** Fehlende Pflichtfelder (leeres Array = vollständig). */
export function impressumMissing(o) {
  o = o || {};
  const miss = IMPRESSUM_REQUIRED.filter(k => !String(o[k] || "").trim());
  if (o.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(o.email)) miss.push("email");
  return [...new Set(miss)];
}

const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const lines = s => esc(s).replace(/\n/g, "<br>");
const color = (c, d) => (/^#[0-9a-f]{3,8}$/i.test(c || "") ? c : d);

/**
 * Fertige Impressum-Seite. `backHref` führt zurück zur Website.
 * Farben aus site.brand (Admin → Ügyfél-admin arculata), sonst neutral dunkel.
 */
export function renderImpressum(site, { backHref = "../" } = {}) {
  const o = (site && site.impressum) || {};
  const brand = (site && site.brand) || {};
  const bg = color(brand.bg, "#0e0d10"), accent = color(brand.accent, "#e9cf9a");
  const title = (site && site.name) || "Impressum";
  const row = (label, value, html) => (value ? `<div class="r"><dt>${esc(label)}</dt><dd>${html || lines(value)}</dd></div>` : "");
  const addr = [o.street, [o.zip, o.city].filter(Boolean).join(" "), o.country || "Österreich"].filter(Boolean).map(esc).join("<br>");
  const name = [o.name, o.legal].filter(Boolean).join(" ");
  const fb = o.fn ? esc(o.fn) + (o.court ? ", " + esc(o.court) : "") : "";
  const ok = !impressumMissing(o).length;

  const body = ok ? `
    <section>
      <h2>Website-Betreiber</h2>
      <p class="big">${esc(name)}<br>${addr}</p>
    </section>
    <section>
      <h2>Kontakt</h2>
      <dl>
        ${row("E-Mail", o.email, `<a href="mailto:${esc(o.email)}">${esc(o.email)}</a>`)}
        ${row("Telefon", o.phone, `<a href="tel:${esc(String(o.phone).replace(/[^\d+]/g, ""))}">${esc(o.phone)}</a>`)}
      </dl>
    </section>
    <section>
      <h2>Unternehmensdaten</h2>
      <dl>
        ${row("UID-Nummer", o.uid)}
        ${row("GISA-Zahl", o.gisa)}
        ${row("Firmenbuch", fb, fb)}
        ${row("Unternehmensgegenstand", o.purpose)}
        ${row("Kammer / Berufsverband", o.chamber)}
        ${row("Aufsichtsbehörde", o.authority)}
      </dl>
    </section>
    <section>
      <h2>Medieninhaber, Herausgeber &amp; inhaltlich verantwortlich</h2>
      <p>${o.media ? lines(o.media) : esc(name) + " (Adresse wie oben)"}</p>
    </section>
    ${o.extra ? `<section><h2>Weitere Angaben</h2><p>${lines(o.extra)}</p></section>` : ""}`
    : `<section><p class="big">Die Angaben werden gerade ergänzt.</p></section>`;

  return `<!doctype html>
<html lang="de"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Impressum · ${esc(title)}</title>
<meta name="robots" content="noindex, follow">
<style>
  :root{--bg:${bg};--accent:${accent};--text:#f5f2ee;--dim:#b3aca6;--line:rgba(245,242,238,.14)}
  *{box-sizing:border-box}
  html{background:var(--bg)}
  body{margin:0;background:var(--bg);color:var(--text);font:17px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased}
  ::selection{background:var(--accent);color:var(--bg)}
  main{width:min(720px,100% - 40px);margin:0 auto;padding:28px 0 72px}
  a{color:inherit;text-underline-offset:.2em}
  a:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
  .back{display:inline-flex;align-items:center;gap:8px;min-height:44px;font-weight:600;text-decoration:none;color:var(--dim)}
  .back:hover{color:var(--text)}
  h1{margin:28px 0 6px;font-size:clamp(40px,10vw,64px);line-height:1;letter-spacing:-.01em;font-weight:700}
  .law{margin:0 0 36px;color:var(--dim);font-size:14px}
  section{padding:22px 0;border-top:1px solid var(--line)}
  h2{margin:0 0 10px;font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);font-weight:700}
  p{margin:0}
  .big{font-size:20px;line-height:1.5}
  dl{margin:0}
  .r{display:grid;grid-template-columns:minmax(120px,38%) 1fr;gap:4px 16px;padding:8px 0}
  dt{color:var(--dim)}
  dd{margin:0;overflow-wrap:anywhere}
  @media(max-width:480px){.r{grid-template-columns:1fr;gap:0}}
</style>
</head><body>
<main>
  <a class="back" href="${esc(backHref)}">← ${esc(title)}</a>
  <h1>Impressum</h1>
  <p class="law">Informationspflicht gemäß § 5 ECG, § 14 UGB, § 63 GewO und § 25 MedienG</p>
  ${body}
</main>
</body></html>`;
}
