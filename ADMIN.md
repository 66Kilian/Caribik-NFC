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
`ADMIN_SESSION_SECRET` értékét, majd indíts egy Redeploy-t.

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
