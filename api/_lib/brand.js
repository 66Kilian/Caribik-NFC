// Branding für den Kunden-Admin: aus der Seite selbst gelesen, im Admin
// (site.brand) überschreibbar. So sieht jeder Kunden-Admin wie „seiner“ aus.
const HEX = /^#[0-9a-f]{3,8}$/i;

function cssVar(html, names) {
  for (const n of names) {
    const m = html.match(new RegExp("--" + n + "\\s*:\\s*(#[0-9a-fA-F]{3,8})"));
    if (m) return m[1];
  }
  return null;
}

export function brandFor(site, html) {
  const b = site.brand || {};
  html = String(html || "");
  const brandA = (html.match(/<a[^>]*class="brand"[^>]*>([\s\S]{0,400}?)<\/a>/i) || [])[1] || "";
  const logoSrc = (brandA.match(/<img[^>]*src="([^"]+)"/i) || [])[1] || null;
  const words = brandA.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const font = (html.match(/fonts\.googleapis\.com\/css2\?family=([A-Za-z+]+)/) || [])[1] || null;
  const icon = (html.match(/<link[^>]+rel="(?:apple-touch-icon|icon)"[^>]*href="([^"]+)"/i) || [])[1] || null;
  const pick = (v, d) => (v && HEX.test(v) ? v : d);
  return {
    name: site.name,
    wordmark: b.wordmark || words || site.name,
    logo: b.logo || logoSrc || null,
    icon,
    accent: pick(b.accent, cssVar(html, ["accent", "red", "pink", "brand", "primary"]) || "#e6004f"),
    accent2: pick(b.accent2, cssVar(html, ["red-2", "pink-2", "gold", "accent-2"]) || null),
    bg: pick(b.bg, (html.match(/<meta name="theme-color" content="(#[0-9a-fA-F]{3,8})"/) || [])[1] || cssVar(html, ["bg"]) || "#0e0e12"),
    text: pick(b.text, cssVar(html, ["text"]) || "#f4f4f6"),
    font: font ? font.replace(/\+/g, " ") : null,
  };
}
