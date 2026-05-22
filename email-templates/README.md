# Supabase Auth — e-mail sablonok

A HTML fájlok **nem** a Next.js build része: a **Supabase Dashboard** „Email template” mezőjébe kell másolni őket. A repo csak verziókezeli a dizájnt.

## `reset-password-email.html` — jelszó visszaállítás

1. [Supabase Dashboard](https://supabase.com/dashboard) → projekt → **Authentication**.
2. **Emails** / **Email templates** → **Reset password** (Recovery).
3. **Subject** (javaslat): `Reset your access — The Theorist`
4. A **Body** / **Message** (HTML) mezőbe illeszd be a **`reset-password-email.html` teljes tartalmát**.
5. **Save** → teszt „Forgot password?” a login modalból.

A link a kódban ide mutat: `{origin}/auth/reset-password` — legyen benne a **Redirect URLs** listában (lásd lent).

## `password-changed-email.html` — sikeres jelszócsere értesítés

Ez **nem** linkes email — csak megerősíti, hogy a jelszó megváltozott (Supabase security notification).

1. [Supabase Dashboard](https://supabase.com/dashboard) → projekt → **Authentication**.
2. **Emails** → **Security notifications** (vagy **Notifications**) → kapcsold be: **Password changed**.
3. **Password changed** template → **Subject:** `Your access was re-secured — The Theorist`
4. **Body (HTML):** másold be a **`password-changed-email.html` teljes tartalmát**.
5. **Save** → teszt: állíts be új jelszót a `/auth/reset-password` oldalon.

Sablonváltozók: `{{ .Email }}`, `{{ .SiteURL }}` (sign-in gomb — a Dashboard **Site URL** mezőjéből jön).

## `confirmation-email.html` — regisztráció megerősítése

Régebbi, részletesebb sablon. Az új, tisztább dizájn: **`confirmation-email-v2.html`** (ugyanaz a stílus, mint a reset email).

1. [Supabase Dashboard](https://supabase.com/dashboard) → projekt → **Authentication**.
2. **Emails** / **Email templates** → **Confirm signup** (Confirm your signup).
3. **Subject** (javaslat): `Confirm your access — The Theorist`
4. A **Body** / **Message** (HTML) mezőbe illeszd be a **`confirmation-email-v2.html`** (vagy `confirmation-email.html`) teljes tartalmát**.
5. **Save** → teszt regisztráció.

### Sablonváltozók (Go template)

| Változó | Szerep |
|---------|--------|
| `{{ .ConfirmationURL }}` | Megerősítő / reset link (kötelező, ne töröld). |
| `{{ .Email }}` | User e-mail címe. |
| `{{ .SiteURL }}` | App Site URL (password-changed „Sign in” gomb). |

Doksi: [Auth email templates](https://supabase.com/docs/guides/auth/auth-email-templates)

## Redirect URL-ek (ne `localhost` maradjon élesben)

A kódban a `signUp` **`emailRedirectTo: {aktuális origin}/account`** értéket küldi; a reset **`emailRedirectTo: {origin}/auth/reset-password`**.

**Supabase** → **Authentication** → **URL Configuration**:

1. **Site URL:** állítsd az éles app URL-re (pl. `https://the-theorist.com`), ne hagyjad `http://localhost:3000`-on productionhez.
2. **Redirect URLs:** legyen benne pl.  
   `http://localhost:3000/**` (lokális teszt)  
   `https://the-theorist.com/**`  
   és konkrétan: `https://the-theorist.com/auth/reset-password`

Ha az `emailRedirectTo` prefixe nincs a Redirect listában, a megerősítés / reset hibázhat vagy rossz hostra mutathat.

### Címek a HTML-ben

A lábléc / figyelmeztetés: `info@the-theorist.com`, `noreply@the-theorist.com`, `the-theorist.com` — igazítsd a valós domainhez, ha más.
