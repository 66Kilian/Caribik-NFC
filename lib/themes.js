// Farbdesigns, die Kunden in ihrem Admin wählen können. „standard“ = das Design,
// das der Betreiber geliefert hat (keine Überschreibung).
// Ein Design setzt nur CSS-Variablen – alle Seiten nutzen dieselben Namen
// (Aliase wie --red/--pink/--accent zeigen auf dieselbe Rolle).

export const THEMES = [
  { id: "luxus", name: "Luxus", desc: "Weiß & Gold", light: true,
    bg: "#faf7f1", bg2: "#f2ece1", card: "#ffffff", text: "#1d1a15", dim: "#6a6253", faint: "#9a9180",
    accent: "#a8844a", accent2: "#c9a66b", gold: "#9c7a3f", gold2: "#5b4520", onAccent: "#ffffff", shade: "#16120b" },
  { id: "domina", name: "Domina", desc: "Schwarz & Rot",
    bg: "#0a0606", bg2: "#120909", card: "#190c0d", text: "#f7eeee", dim: "#bba5a6", faint: "#86716f",
    accent: "#c8102e", accent2: "#ff4458", gold: "#ff6b78", gold2: "#ffd9dc", onAccent: "#ffffff", shade: "#070303" },
  { id: "noir", name: "Noir", desc: "Schwarz & Gold",
    bg: "#0b0a08", bg2: "#12100c", card: "#18150f", text: "#f6f0e4", dim: "#b5aa92", faint: "#7f7766",
    accent: "#d4af37", accent2: "#f0d27a", gold: "#e3c56a", gold2: "#fff1c9", onAccent: "#15120a", shade: "#060504" },
  { id: "velvet", name: "Velvet", desc: "Violett & Pink",
    bg: "#0d0812", bg2: "#140c1b", card: "#1b1124", text: "#f7effb", dim: "#baa8c7", faint: "#82718f",
    accent: "#c2189f", accent2: "#f72585", gold: "#e58cff", gold2: "#f7dcff", onAccent: "#ffffff", shade: "#07040a" },
  { id: "rose", name: "Rosé", desc: "Schwarz & Rosé",
    bg: "#0d0a0b", bg2: "#151012", card: "#1c1517", text: "#fbf1f3", dim: "#c3aeb4", faint: "#8c787d",
    accent: "#e79bb0", accent2: "#f6c3d1", gold: "#f0b3c3", gold2: "#fde7ed", onAccent: "#2a1219", shade: "#080506" },
  { id: "smaragd", name: "Smaragd", desc: "Schwarz & Grün",
    bg: "#06100d", bg2: "#0a1713", card: "#0f1e19", text: "#ecf7f2", dim: "#a2bdb2", faint: "#6c877c",
    accent: "#10b981", accent2: "#5eead4", gold: "#6ee7b7", gold2: "#d1fae5", onAccent: "#04130d", shade: "#030907" },
];

const mix = (a, b, p) => `color-mix(in srgb, ${a} ${p}%, ${b})`;

/** CSS für ein Design (leer für „standard“ oder unbekannt). */
export function themeCss(id) {
  const t = THEMES.find(x => x.id === id);
  if (!t) return "";
  const line = mix(t.accent, "transparent", t.light ? 22 : 16);
  return `:root{color-scheme:${t.light ? "light" : "dark"};` +
    `--bg:${t.bg};--bg-2:${t.bg2};--card:${t.card};--surface:${t.card};--surface-2:${mix(t.card, t.text, 94)};--surface-3:${mix(t.card, t.text, 88)};` +
    `--line:${line};--text:${t.text};--text-dim:${t.dim};--text-faint:${t.faint};` +
    `--red:${t.accent};--pink:${t.accent};--accent:${t.accent};--red-2:${t.accent2};--pink-2:${t.accent2};--violet:${t.accent2};` +
    `--gold:${t.gold};--gold-2:${t.gold2};--red-soft:${mix(t.accent, "transparent", 14)};--gold-soft:${mix(t.gold, "transparent", 12)};--pink-soft:${mix(t.accent, "transparent", 14)};` +
    `--on-accent:${t.onAccent};--shade:${t.shade};--glass:${mix(t.bg, "transparent", 86)};--hi:${t.light ? t.text : "#fff"};` +
    // --t-*: nur im Design gesetzt; die Seiten nutzen sie als var(--t-…, Originalfarbe)
    `--t-accent:${t.accent};--t-accent2:${t.accent2};--t-gold:${t.gold};--t-gold2:${t.gold2};--t-bg:${t.bg};--t-bg2:${t.bg2};--t-card:${t.card};` +
    `--t-text:${t.text};--t-dim:${t.dim};--t-line:${line};--t-shade:${t.shade};--t-on-accent:${t.onAccent};--t-hi:${t.light ? t.text : "#fff"};` +
    `--t-g1:${t.accent};--t-g2:${mix(t.accent, "#000", 72)};--t-g3:${mix(t.accent, "#000", 34)};--t-g4:${mix(t.accent, t.shade, 10)};` +
    `--t-btn-bg:${t.light ? t.text : "#fff"};--t-btn-ink:${t.light ? t.bg : "#0a0b12"};` +
    `--t-hover:${mix(t.accent, "#000", 86)};--t-gold-deep:${mix(t.gold, "#000", 80)};` +
    `--t-hero-accent:${t.light ? t.accent2 : t.gold2};--t-photo-text:${t.light ? "#fbf7ef" : t.text};--t-photo-dim:${t.light ? "rgba(255,255,255,.78)" : t.dim};--t-sign:${t.light ? t.accent : t.gold2};` +
    // Aliase einzelner Seiten (Caribik/Venus)
    `--line-strong:${mix(t.accent, "transparent", t.light ? 34 : 28)};--orange:${t.accent2};--orange-soft:${mix(t.accent2, "transparent", 14)};` +
    `--lagoon:${t.gold};--lagoon-soft:${mix(t.gold, "transparent", 13)};--sunset:linear-gradient(95deg,${t.accent} 0%,${t.accent2} 50%,${t.gold} 100%);` +
    (t.light ? `--t-header-bg:${mix(t.bg, "transparent", 90)};` : "") + `}`;
}

export function publicThemes() {
  return [{ id: "standard", name: "Standard", desc: "Dein Original-Design" }].concat(
    THEMES.map(t => ({ id: t.id, name: t.name, desc: t.desc, light: !!t.light, swatch: [t.bg, t.card, t.accent, t.gold], css: themeCss(t.id) })));
}

const TAG_RE = /<style id="mk-theme">[\s\S]*?<\/style>\s*/g;
const ATTR_RE = /(<html\b[^>]*?)\sdata-mk-theme="[^"]*"/i;

/** Liest das gewählte Design aus dem HTML (<html data-mk-theme="…">). */
export function themeOf(html) {
  const m = String(html).match(/<html\b[^>]*\sdata-mk-theme="([a-z]+)"/i);
  return m ? m[1] : "standard";
}

/**
 * Setzt das Design-CSS kanonisch (der Kunde kann so kein eigenes CSS einschleusen):
 * vorhandenes mk-theme entfernen, für ein bekanntes Design neu am Ende von <head> einfügen.
 */
export function applyTheme(html, id) {
  html = String(html).replace(TAG_RE, "").replace(ATTR_RE, "$1");
  const css = themeCss(id);
  if (!css) return html;
  html = html.replace(/<html\b/i, `<html data-mk-theme="${id}"`);
  return html.replace(/<\/head>/i, `<style id="mk-theme">${css}</style>\n</head>`);
}
