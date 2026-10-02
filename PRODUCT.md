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
- Lovekino facts (official site lovekino.at / forum pages, checked 2026-10-02): Michael-Bernhard-Gasse 13, 1120 Wien; +43 1 817 16 48; office@lovekino.at; since 1979. Hours: Mo 12–15, Tue closed (Ruhetag), Wed 12–22, Thu–Sun 17–24. Theme nights: Greedy Monday / Greedy Midweek (Konsumationspauschale Damen 29, Paare 39, Herren 79 €), Thu Donnerstags-Knaller (Damen 0, Paare 7,50, Herren 20 €), Fri–Sun Damen 10, Paare 15, Herren 20 €; JOYclub members pay less. Price list valid since 1.11.2024: Herren 20, Paare 15, Damen 10 (higher at special events), Kuschelzimmer 20 €/60 min, drinks list on the page. Two cinemas (A: daily programme, B: international productions), bar, darts, Pärchenkabine, Kuschelzimmer, 2 Gloryholes, Milking Table, Gynostuhl, Massageliege, GangBang-Table, shower; forum at lovekino.at/forum; 18+ only.
- No age gate (owner decision for these sites).

## Brand Commitments
- Lovekino: reflect Lovekino's colours (red / heart). Everything else delegated to us.
- Owner's taste: must not look AI-generated; must look great on phones.

## Evidence on Hand
- Lovekino: real photos from the official site (lovekino.at, "Unsere Location in Bildern") in `img/*.jpg`; the bedroom photo is cropped to remove an explicit TV screen. Do not invent reviews or awards.

## Product Principles
1. Save-the-contact first, every screen.
2. Feel like the place, not like a template.
3. Phone first, thumb reach, fast on mobile data.
4. Only verified facts; unknowns say "auf Anfrage".
