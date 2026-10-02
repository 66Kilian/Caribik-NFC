# Admin – meinekontaktkarte.com/admin

Az adminból kezelheted a munkáidat (`Munkák/` mappa) és a főoldalt:

- **Csoportosított lista**: Hauptseite, Kunden, Demos, vagy bármilyen új csoport.
- **Cím**: `meinekontaktkarte.com/<cím>/`, opcionálisan aldomain is (`<név>.meinekontaktkarte.com`).
  Ha módosítod a címet, a régi cím automatikusan átirányít, így a már kiadott NFC-kártyák továbbra is működnek.
- **Be/ki kapcsolás**: kikapcsolt oldal helyett a látogató egy „nem elérhető” oldalt lát (404, nem indexelődik).
- **Szekciók**: sorrend (húzással vagy ↑↓ gombokkal), elrejtés/megjelenítés, élő előnézettel mobil és asztali nézetben.
- **Tartalom**: kattints az előnézetben egy szövegre, linkre vagy képre.
  - Szöveg: minden nyelven szerkeszthető (DE, EN, HU, SK, CS …).
  - Link: cím (tel:, mailto:, https:) és „új lapon nyíljon”.
  - Kép: csere feltöltéssel (automatikus kicsinyítéssel) és alt-szöveg.
- **Verziók**: minden közzététel egy Git-commit, és bármelyik korábbi verzió visszaállítható.
- **Piszkozat**: a közzé nem tett változások a böngészőben megmaradnak (újratöltés vagy lejárt munkamenet után is).
- **Ügyfél-admin**: Beállítások → „+ Admin létrehozása” → meghívó link (7 napig érvényes, egyszer használható).
  Az ügyfél a `meinekontaktkarte.com/<cím>/admin/` oldalon regisztrál (név, felhasználónév, jelszó), utána
  bekapcsolhatja a kétlépcsős azonosítást (vagy később). Ugyanitt: jelszó-link, 2FA törlése, fiók törlése.
- **Saját repó**: minden munkának lehet saját GitHub-repója (pl. `66Kilian/LoveKinoADMIN`). Minden mentés
  (a tiéd és az ügyfélé is) oda is bekerül; a „Teljes szinkron most” gomb a teljes mappát átmásolja.
- **Arculat**: az ügyfél-admin automatikusan a weboldal logóját, színeit és betűtípusát használja – felülírható.

## Nyelv

- Az ügyfél-admin mindig **német**.
- A saját admin (`/admin/`) alapból német; fent a **DE | HU** gombbal átválthatsz magyarra (a böngésző megjegyzi).

## Automatikus fordítás

Többnyelvű szövegnél a német a fő szöveg. A többi nyelv (EN, HU …) **zárolva** van, és a német
átírásakor automatikusan lefordul (DeepL). „🔒 Entsperren” után kézzel átírható, és onnantól nem írja
felül a fordítás; az „Automatisch” gomb visszakapcsolja (és újrafordítja).

## Ügyfél-admin (`/<cím>/admin/`)

- Német nyelvű, a weboldal saját logójával és színeivel.
- Élő előnézet mobil és asztali nézetben; kattintás egy szövegre → szerkesztés (minden nyelven),
  képre → csere, linkre → cím. A szekciók sorrendje (pl. a hero lejjebb/feljebb) és láthatósága állítható.
- **„Änderungen speichern”** = azonnal egy commit a fő repóban (→ Vercel deploy, kb. 30–60 mp) és a saját repóban.
  Az admin kijelzi, mikor „Live”.
- Beállítások: 2FA be/ki, jelszócsere, **„Hängst du fest?” → WhatsApp: +36 20 627 0766**, kijelentkezés.
- Az ügyfél csak a saját oldalát látja és mentheti. Szkriptet, `on…` eseményattribútumot, iframe-et és
  `javascript:` linket nem tud beilleszteni (a szerver ellenőrzi), mert az oldala ugyanazon a domainen fut, mint az admin.
- A fiókok a `data/accounts.enc.json` fájlban vannak, **AES-256-GCM-mel titkosítva** (a repó nyilvános!).
  A fájl nem kerül ki a weboldalra, és a módosítása nem indít Vercel-buildet (`vercel.json` → `ignoreCommand`).

## Biztonság

| Védelem | Részletek |
|---|---|
| Jelszó | PBKDF2-SHA256, 210 000 iteráció. A szerveren csak a hash van, a jelszó sehol. |
| Kétlépcsős azonosítás | TOTP (Google/Microsoft Authenticator, 1Password …), ±30 mp tűrés. Egy kód csak egyszer használható. |
| Munkamenet | HMAC-aláírt, `HttpOnly` + `Secure` + `SameSite=Strict` cookie, 8 óra. 30 perc tétlenség után automatikus kiléptetés. |
| Brute force | 5 hibás próbálkozás után 15 perc zárolás IP-címenként, plusz szándékos késleltetés minden kísérletnél. |
| CSRF | Minden módosító kérés csak ugyanarról az originről, egyedi fejléccel fogadható el. |
| Rejtett fájlok | `/data`, `/lib`, `/scripts`, `/Munkák/…` és a konfigurációs fájlok kívülről nem érhetők el, csak bejelentkezve. |
| Fejlécek | Az admin nem ágyazható be (clickjacking ellen), nem indexelődik, nem cache-elődik, HSTS. |
| Napló | Minden változás egy commit a GitHubon (mikor, mi változott). |

**Minden munkamenet kiléptetése** (pl. ha elveszett egy eszköz): Vercelben cseréld le az
`ADMIN_SESSION_SECRET` értékét, majd indíts egy Redeploy-t. Ez az ügyfeleket is kilépteti.
Ha az `MK_DATA_KEY` nincs beállítva, előtte állítsd be a **régi** `ADMIN_SESSION_SECRET` értékére, különben az
ügyfélfiókok olvashatatlanná válnak.

**Elveszett telefon (2FA):** futtasd le újra a `/admin/setup.html` oldalt, és cseréld le a Vercelben az
`ADMIN_TOTP_SECRET` (és ha kell, az `ADMIN_PASSWORD_HASH`) értékét. Ha a titkos kulcsot a beállításkor
elmentetted a jelszókezelődbe, azzal egy új telefonon is azonnal visszaállíthatod a 2FA-t.

## Egyszeri beállítás

### 1. Jelszó és 2FA
Nyisd meg: `https://meinekontaktkarte.com/admin/setup.html`
- Adj meg egy jelszót (min. 12 karakter).
- Olvasd be a QR-kódot a hitelesítő alkalmazással, és írd be a kódot.
- A megjelenő 3 értéket add hozzá a Vercelben (lásd lent).

A setup oldal mindent a böngésződben generál, a szerverre semmit nem küld.

### 2. GitHub-token (a mentéshez)
GitHub → Settings → Developer settings → **Fine-grained personal access tokens** → Generate new token
- Repository access: **Only select repositories** → `meinekontaktkarte`
- Az ügyfél-repókat is add hozzá: `LoveKinoADMIN`, `CaribikADMIN`, `MaximADMIN`, `Venus-PornrudiADMIN`
  (meglévő tokennél: Edit → Repository access)
- Permissions → Repository permissions → **Contents: Read and write**
- Lejárat: pl. 1 év (írd be a naptáradba, mikor kell megújítani)

### 3. Vercel környezeti változók
Vercel → projekt → **Settings → Environment Variables** (Environment: Production):

| Név | Érték |
|---|---|
| `ADMIN_PASSWORD_HASH` | a setup oldalról |
| `ADMIN_TOTP_SECRET` | a setup oldalról |
| `ADMIN_SESSION_SECRET` | a setup oldalról |
| `GITHUB_TOKEN` | a GitHub-token |
| `GITHUB_REPO` | `66Kilian/meinekontaktkarte` (alapértelmezett, elhagyható) |
| `GITHUB_BRANCH` | az a branch, amiből az éles oldal települ (alapértelmezett: `main`) |
| `DEEPL_API_KEY` | DeepL API-kulcs az automatikus fordításhoz (deepl.com → API Free, a kulcs `:fx`-re végződik). Nélküle a többi nyelv kézzel szerkeszthető, csak nem fordul magától. |
| `MK_DATA_KEY` | véletlen kulcs az ügyfélfiókok titkosításához (min. 32 karakter, pl. `openssl rand -base64 48`). **Soha ne cseréld le** – különben az ügyfélfiókok elvesznek. Ha nincs megadva, az `ADMIN_SESSION_SECRET` szolgál kulcsként. |

Utána: **Deployments → Redeploy**.

### 4. Aldomainek (opcionális)
Ahhoz, hogy a `valami.meinekontaktkarte.com` címek működjenek:
Vercel → **Settings → Domains** → add hozzá: `*.meinekontaktkarte.com`.
A wildcard domainhez a Vercel nameservereit kell használni a domainnél (a Vercel ezt jelzi).
Ezután az adminban bármelyik munkához megadhatsz aldomaint, és mentés után azonnal működik.

## Hogyan működik?

- `data/sites.json`: a munkák listája (név, csoport, mappa, cím, aldomain, be/ki, régi címek).
- `middleware.js`: minden kérésnél eldönti, melyik mappát kell kiszolgálni (`/cím/`, aldomain), átirányít a régi címekről,
  a kikapcsolt oldalakra pedig 404-et ad.
- `api/`: bejelentkezés, 2FA és a mentés. A mentés egyetlen commit a GitHubon, amire a Vercel automatikusan újra deployol
  (kb. 30–60 mp). Az admin kijelzi, mikor lett élesben.
- A szekciók elrejtése egy `data-mk-off` attribútum a HTML-ben, ami bármikor visszakapcsolható.
- A nem német szövegek módosításai a munka mappájában lévő `mk-i18n.js` fájlba kerülnek.
  Ezt ne szerkeszd kézzel.
- **Új munka:** tegyél egy új mappát a `Munkák/` alá (`index.html`-lel), és pushold.
  Az adminban megjelenik az „Új munka” gombnál; felvétel után kikapcsolt állapotból indul.

## Helyi tesztelés

```bash
# jelszó: "test", TOTP-kulcs: JBSWY3DPEHPK3PXP
export ADMIN_TOTP_SECRET=JBSWY3DPEHPK3PXP
export ADMIN_SESSION_SECRET=$(node -e 'console.log(require("crypto").randomBytes(40).toString("hex"))')
export ADMIN_PASSWORD_HASH=$(node -e 'const c=require("crypto"),s=c.randomBytes(16);console.log("pbkdf2$210000$"+s.toString("base64")+"$"+c.pbkdf2Sync("test",s,210000,32,"sha256").toString("base64"))')
MK_LOCAL_REPO=/tmp/masolat-a-reporol npm run dev   # http://localhost:3000/admin/
npm test                                            # routing tesztek
```

Az `MK_LOCAL_REPO` egy git-klón legyen: a helyi admin ott commitol a GitHub helyett.
