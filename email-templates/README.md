# Supabase Auth — e-mail sablonok

A HTML fájlok **nem** a Next.js build része: a **Supabase Dashboard** „Email template” mezőjébe kell másolni őket. A repo csak verziókezeli a dizájnt.

## `confirmation-email.html` — regisztráció megerősítése

1. [Supabase Dashboard](https://supabase.com/dashboard) → projekt → **Authentication**.
2. **Emails** / **Email templates** → **Confirm signup** (Confirm your signup).
3. **Subject** (javaslat): `Confirm your access — The Theorist`
4. A **Body** / **Message** (HTML) mezőbe illeszd be a **`confirmation-email.html` teljes tartalmát**.
5. **Save** → teszt regisztráció.

### Sablonváltozók (Go template)

| Változó | Szerep |
|---------|--------|
| `{{ .ConfirmationURL }}` | Megerősítő link (kötelező, ne töröld). |
| `{{ .Email }}` | Regisztrált e-mail (REF sor). |

Doksi: [Auth email templates](https://supabase.com/docs/guides/auth/auth-email-templates)

## Redirect URL-ek (ne `localhost` maradjon élesben)

A kódban a `signUp` **`emailRedirectTo: {aktuális origin}/account`** értéket küldi, tehát a megerősítő link **annak a hostnak** felel meg, ahol a user regisztrált.

**Supabase** → **Authentication** → **URL Configuration**:

1. **Site URL:** állítsd az éles app URL-re (pl. `https://conspiracyhub-ashen.vercel.app`), ne hagyjad `http://localhost:3000`-on productionhez.
2. **Redirect URLs:** legyen benne pl.  
   `http://localhost:3000/**` (lokális teszt)  
   és  
   `https://conspiracyhub-ashen.vercel.app/**` (vagy a végleges domain).

Ha az `emailRedirectTo` prefixe nincs a Redirect listában, a megerősítés hibázhat vagy rossz hostra mutathat.

### Címek a HTML-ben

A lábléc / figyelmeztetés: `info@the-theorist.com`, `noreply@the-theorist.com`, `the-theorist.com` — igazítsd a valós domainhez, ha más.
