# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Everyone who taps or scans one of our NFC cards (or opens the link) for a client business: curious first-timers and regulars alike, almost always on a phone, often on the move or in the evening. For Lovekino (Erotikkino, Wien-Meidling): anyone interested in Lovekino — singles, couples, women, swingers, Wednesday-event guests.

## Product Purpose
meinekontaktkarte.com builds one-page "digital business card" sites behind NFC cards. Each client site must let a visitor understand the venue in seconds and keep it: the primary action is **Kontakt speichern** (vCard download), then route and call. Success = the contact lands in the visitor's phone.

## Positioning
A card you touch opens a page that feels like the venue itself, not a template: one URL per client (`meinekontaktkarte.com/<slug>/`), editable by the owner in our admin (sections, texts, images, on/off).

## Operating Context
- Static HTML per client in `Munkák/<Client>/`, German content in HTML, EN/HU in `i18n.js`; the admin edits `data-i18n` texts, images and section order, so sections stay `header`, `main > section`, `footer`.
- Mobile bottom bar (Kontakt speichern + Route) appears after the hero.
- Live opening status in Vienna time.

## Capabilities and Constraints
- Lovekino facts (public sources, to be confirmed by client): Michael-Bernhard-Gasse 13, 1120 Wien; +43 1 817 16 48; Mo–Sa 12–22, So/Feiertag 16–21; Tagesticket 10 € (valid until closing), women and couples free; two cinema halls, bar; Loverooms (Solokabine, Paarkabine mit Gloryhole, Kuschelraum) from 10 €/60 min; Wednesday event 19:00 from 39 €; forum at lovekino.at/forum; 18+ only.
- No age gate (owner decision for these sites).

## Brand Commitments
- Lovekino: reflect Lovekino's colours (red / heart). Everything else delegated to us.
- Owner's taste: must not look AI-generated; must look great on phones.

## Evidence on Hand
- Lovekino: no real photos yet. `img/hero.jpg` is a generated demo cinema scene; other images are labeled placeholders. Do not invent reviews, awards, founding year or prices beyond the facts above.

## Product Principles
1. Save-the-contact first, every screen.
2. Feel like the place, not like a template.
3. Phone first, thumb reach, fast on mobile data.
4. Only verified facts; unknowns say "auf Anfrage".
