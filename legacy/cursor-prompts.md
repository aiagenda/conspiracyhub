# CONSPIRACY ORACLE — CURSOR PROMPT SOROZAT
# Kövesd sorban, minden promptot akkor add be ha az előző kész

---

## PROMPT 1 — Projekt alap + Investigation Board komponens

```
Építsük meg a Conspiracy Oracle nevű Next.js web appot.

A projekt struktúrája már létre van hozva (create-next-app, TypeScript, Tailwind, App Router).

Feladat: hozd létre a fő Investigation Board komponenst.

Másold be ezt a fájlt: src/components/InvestigationBoard.tsx
Az alap JSX komponenst átírom TypeScriptre és Next.js-be:

- Props: 
  nodes: Node[]
  edges: Edge[]
  onNodeClick: (node: Node) => void
  selectedNode: Node | null

- Típusok (src/types/index.ts fájlba):
  type NodeType = "article" | "patent" | "foia" | "company" | "event" | "person"
  
  interface Node {
    id: string
    type: NodeType
    x: number
    y: number
    label: string
    sub: string
    detail: {
      title: string
      body: string
      source: string
      threat: number
    }
  }
  
  interface Edge {
    from: string
    to: string
    color: string
    label: string
    strength: number
  }
  
  interface NewsItem {
    id: string
    title: string
    summary: string
    url: string
    image: string | null
    date: string
    section: string
    score: number
    angle: string
    nodes?: Node[]
    edges?: Edge[]
  }

A vizuális dizájn legyen PONTOSAN ugyanolyan mint az eredeti komponensben:
- Fekete háttér (#050c07)
- Zöld terminal szövegek (#00ff88)
- Share Tech Mono + Rajdhani fontok (Google Fonts)
- Animált szaggatott vonalak az éleken
- Scanline effekt
- Glitch animáció
- Ticker szalag tetején
- Kattintásra jobb oldali detail panel csúszik be

A komponens legyen teljesen statikus és interaktív — egyelőre mock adatokkal dolgozzon.
```

---

## PROMPT 2 — Supabase setup + adatbázis séma

```
Állítsd be a Supabase integrációt.

1. Hozd létre: src/lib/supabase.ts
   - supabase kliens inicializálása
   - típusos wrapper függvények

2. Hozd létre a következő SQL sémát (ezt futtatom a Supabase SQL editorban):

-- Hírek táblázat
create table news_items (
  id uuid default gen_random_uuid() primary key,
  guardian_id text unique not null,
  title text not null,
  summary text,
  url text not null,
  image text,
  published_at timestamptz not null,
  section text not null,
  score integer not null,
  angle text,
  created_at timestamptz default now()
);

-- Oracle elemzések (cache)
create table oracle_analyses (
  id uuid default gen_random_uuid() primary key,
  news_id uuid references news_items(id) on delete cascade,
  nodes jsonb not null,
  edges jsonb not null,
  theories jsonb not null,
  conclusion text not null,
  verdict text not null,
  created_at timestamptz default now()
);

-- Felhasználók (Supabase Auth kiegészítés)
create table user_profiles (
  id uuid references auth.users primary key,
  email text not null,
  plan text default 'free' check (plan in ('free', 'pro')),
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz default now()
);

-- Fogadások
create table bets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users,
  analysis_id uuid references oracle_analyses(id),
  theory_index integer not null,
  side text check (side in ('yes', 'no')),
  created_at timestamptz default now(),
  unique(user_id, analysis_id, theory_index)
);

-- RLS policies
alter table news_items enable row level security;
alter table oracle_analyses enable row level security;
alter table user_profiles enable row level security;
alter table bets enable row level security;

create policy "News items are public" on news_items for select using (true);
create policy "Analyses are public" on oracle_analyses for select using (true);
create policy "Users see own profile" on user_profiles for all using (auth.uid() = id);
create policy "Users manage own bets" on bets for all using (auth.uid() = user_id);

3. .env.local fájlba add hozzá:
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=
OPENAI_API_KEY=
GUARDIAN_API_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
```

---

## PROMPT 3 — Scraper API route

```
Hozd létre: src/app/api/scraper/route.ts

Ez a route naponta 3x fut (Vercel Cron Job), és:

1. Lekéri az aznapi híreket a Guardian API-ból:
   - Kategóriák: technology, science, world, politics, environment, society
   - Kategóriánként 8 cikk
   - Endpoint: https://content.guardianapis.com/search?section={section}&show-fields=headline,trailText,thumbnail,webUrl,webPublicationDate&page-size=8&api-key={GUARDIAN_API_KEY}

2. Kiszűri azokat amelyek már szerepelnek a Supabase news_items táblában (guardian_id alapján)

3. Az új cikkek headlineit elküldi GPT-4o-nak batch-ban score-olásra:
   System prompt:
   "You are a conspiracy potential scorer. Rate each headline 0-100 for conspiracy theory potential based on: government/corporate secrecy, unexplained events, surveillance, health/biotech, military/intelligence, financial control. Return ONLY valid JSON: {scores: [{index: 0, score: 72, angle: 'one-line conspiracy angle in Hungarian'}]}"

4. Csak azokat menti Supabase-be amelyek score >= 55

5. Response: { inserted: number, skipped: number, timestamp: string }

A route legyen védett: csak Authorization: Bearer {CRON_SECRET} headerrel hívható.

Kezelje le az összes hibát és logoljon Supabase-be vagy console-ra.
```

---

## PROMPT 4 — Oracle API route

```
Hozd létre: src/app/api/oracle/route.ts

POST request, body: { newsId: string }

1. Ellenőrizd hogy a news_items táblában létezik-e a newsId

2. Ellenőrizd hogy az oracle_analyses táblában van-e már elemzés ehhez a newsId-hoz
   - Ha igen: return a cached elemzést

3. Ellenőrizd a felhasználó jogosultságát:
   - A request Authorization headeréből Supabase JWT tokenből olvasd ki a user_id-t
   - Ha nincs token: return 401
   - Nézd meg a user_profiles táblában hogy plan === 'pro'
   - Ha free user: return 403 { error: 'upgrade_required' }

4. Ha minden OK, hívd meg GPT-4o-t:
   System prompt:
   "Te egy összeesküvés-elmélet elemző AI vagy. Egy hírcikk alapján építs fel egy vizuális nyomozati hálót.
   
   Adj vissza egy JSON objektumot amely tartalmaz:
   1. nodes: a hírcikk köré épített csomópontok (szabadalmak, CIA FOIA dokumentumok, cégek, személyek, események) — minden csomóponthoz adj x,y koordinátát is egy 1000x640-es canvas-ra elhelyezve, a hírcikk legyen a közepén (500, 320)
   2. edges: a csomópontok közötti kapcsolatok színekkel és erősséggel
   3. theories: 3 összeesküvés-elmélet valószínűséggel
   4. conclusion: összefoglaló
   5. verdict: VALÓS | RÉSZBEN VALÓS | MEGKÉRDŐJELEZHETŐ | TERJESZTETT DEZINFO
   
   Minden csomóponthoz adj valós forrást: létező USPTO szabadalomszámot, CIA FOIA dokumentumszámot, vagy valós eseményt.
   
   CSAK valid JSON-t adj vissza."

5. Mentsd el az elemzést az oracle_analyses táblába

6. Return: a teljes elemzés JSON-ja
```

---

## PROMPT 5 — Főoldal feed

```
Hozd létre: src/app/page.tsx

Ez a főoldal, amit a látogató először lát.

Layout:
- Teljes képernyős dark terminal design (ugyanolyan mint az InvestigationBoard)
- Top navigation bar: "CONSPIRACY ORACLE" logó bal oldalt, jobb oldalt: "Bejelentkezés" + "Pro előfizetés" gombok
- Ticker szalag a top bar alatt (legfrissebb hírek scrollnak benne)
- Filter bar: szekció szűrők (ALL, TECHNOLOGY, SCIENCE, WORLD, stb.)
- News grid: reszponzív, 3 oszlop desktopon, 1 mobilon

NewsCard komponens (src/components/NewsCard.tsx):
- Kép ha van (desaturált overlay-el)
- Threat score badge (piros/sárga/zöld)
- Szekció + időpont
- Cím (Rajdhani font, bold)
- AI conspiracy angle előnézet (szürke, kis betű)
- "◈ ORACLE ELEMZÉS ▶" gomb
  - Ha free user és már 3 ingyenes elemzést használt: megnyílik egy upgrade modal
  - Ha pro user: navigál /board/[id]-re

Az adatokat server component-ként töltsd be a Supabase-ből:
- news_items tábla, score DESC rendezés, limit 50
- 30 perces revalidáció (Next.js ISR)

Üres state: "Nincs elegendő conspiracy potenciálú hír ebben a kategóriában."
Loading state: terminal-stílusú skeleton kártyák
```

---

## PROMPT 6 — Investigation Board oldal

```
Hozd létre: src/app/board/[id]/page.tsx

Ez az oldal jelenik meg amikor egy user rákattint egy hírre.

1. Server component-ként töltsd be a news_items táblából az adott cikket (params.id alapján)

2. Ellenőrizd van-e már oracle_analyses cache ehhez a cikkhez
   - Ha igen: rendereld le rögtön az InvestigationBoard komponenssel
   - Ha nem: client component-ként triggereld az /api/oracle hívást és mutass loading state-t

3. Loading state:
   - Teljes képernyős dark background
   - Animált log sorok (mint az eredeti mockupban):
     "> CIA FOIA adatbázis szkenner inicializálva..."
     "> USPTO szabadalom kereső aktív..."
     stb.
   - Becsült idő: "~8 másodperc"

4. Ha kész: rendereld le az InvestigationBoard komponenst a visszakapott nodes + edges adatokkal

5. Alatta: a 3 elmélet kártyák Polymarket-stílusú betting panellel
   - Bejelentkezett pro user tud fogadni
   - A fogadás elmenti a bets táblába
   - Valós idejű odds frissítés: a fogadások arányából számítva

6. Verdict badge a tetején (VALÓS / RÉSZBEN VALÓS / stb.)

7. "← VISSZA A FEEDRE" gomb bal felső sarokban
```

---

## PROMPT 7 — Auth + Stripe előfizetés

```
Hozd létre az auth és fizetési rendszert.

1. Supabase Auth beállítása:
   src/lib/auth.ts — helper függvények
   - signInWithEmail(email, password)
   - signUpWithEmail(email, password)  
   - signOut()
   - getCurrentUser()
   - getUserPlan()

2. Auth modal komponens (src/components/AuthModal.tsx):
   - Ugyanolyan dark terminal dizájn
   - Tab: Bejelentkezés / Regisztráció
   - Email + jelszó mezők
   - Google OAuth gomb (Supabase-szel)
   - Hiba kezelés terminal-stílusban: "[HIBA] Hibás jelszó"

3. Stripe integráció:
   src/app/api/stripe/checkout/route.ts
   - POST: létrehoz egy Stripe Checkout session-t
   - Price: havi $7 (hozz létre egy Stripe termékben)
   - Success URL: /success
   - Cancel URL: /

   src/app/api/stripe/webhook/route.ts
   - Kezeli: checkout.session.completed → user_profiles.plan = 'pro'
   - Kezeli: customer.subscription.deleted → user_profiles.plan = 'free'

4. Upgrade modal (src/components/UpgradeModal.tsx):
   - Megjelenik ha free user megpróbál elemzést nézni
   - "PRO HOZZÁFÉRÉS" fejléc
   - Feature lista: teljes Oracle elemzés, Polymarket fogadás, email alerts
   - "$7 / hó" ár kiemelve
   - "ELŐFIZETÉS AKTIVÁLÁSA" gomb → Stripe Checkout
   - Terminal dizájn
```

---

## PROMPT 8 — Vercel Cron + Email alerts

```
1. Vercel Cron Job beállítása:
   Hozd létre: vercel.json
   {
     "crons": [
       { "path": "/api/scraper", "schedule": "0 7,13,19 * * *" }
     ]
   }
   
   A scraper route-hoz add hozzá a CRON_SECRET env variable ellenőrzést.

2. Email alert rendszer (pro usereknek):
   src/app/api/alerts/route.ts
   
   Ha a scraper talál 75+ score-ú hírt:
   - Lekéri az összes pro user emailjét a user_profiles táblából
   - Küld emailt Resend API-val (resend.com — ingyenes tier elegendő)
   
   Email template (HTML):
   - Ugyanolyan dark terminal dizájn mint az app
   - "⚠ MAGAS FENYEGETÉSI SZINT ÉSZLELVE" subject
   - A hír neve, score-ja, angle-je
   - "◈ NYOMOZÁS MEGNYITÁSA" CTA gomb
   
   Szükséges package: npm install resend
   Env variable: RESEND_API_KEY

3. Add hozzá az alert triggert a scraper route végéhez:
   Ha van 75+ score-ú új hír → hívja meg az /api/alerts route-ot
```

---

## PROMPT 9 — SEO + PWA + Performance

```
1. SEO (src/app/layout.tsx és minden page):
   - Dinamikus metadata minden hírhez
   - OpenGraph képek (Next.js og image generation)
   - Minden board/[id] oldalnak saját OG kép: a hír neve + threat score + "CONSPIRACY ORACLE"
   - robots.txt: minden indexelhető
   - sitemap.ts: dinamikus, az összes news_items URL-je benne van

2. PWA beállítás:
   - next-pwa package
   - manifest.json: app neve, ikonok, theme_color: #050c07
   - Service worker: cache-eli a statikus asseteket
   - "Hozzáadás a kezdőképernyőhöz" prompt mobilon

3. Performance:
   - Képek: Next.js Image komponens, WebP, lazy loading
   - Fontok: next/font/google, preload
   - Investigation Board SVG: csak kliensen renderelődik (dynamic import, ssr: false)
   - News feed: Supabase real-time subscription az újabb hírekre (toast notification)
```

---

## PROMPT 10 — Deploy

```
Készítsd elő a production deploy-t.

1. Ellenőrizd hogy minden env variable be van állítva a Vercel dashboardon:
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY
   SUPABASE_SERVICE_KEY
   OPENAI_API_KEY
   GUARDIAN_API_KEY
   STRIPE_SECRET_KEY
   STRIPE_WEBHOOK_SECRET
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
   CRON_SECRET
   RESEND_API_KEY

2. Supabase-ben állítsd be:
   - Auth → Site URL: https://conspiracy-oracle.vercel.app
   - Auth → Redirect URLs: https://conspiracy-oracle.vercel.app/**
   - Edge Functions: engedélyezd a service key-t

3. Stripe-ban:
   - Webhook endpoint hozzáadása: https://conspiracy-oracle.vercel.app/api/stripe/webhook
   - Events: checkout.session.completed, customer.subscription.deleted

4. Futtasd: 
   npm run build
   
   Javíts minden TypeScript és ESLint hibát.
   
5. Push main branchre → automatikus Vercel deploy.

6. Teszteld:
   - Regisztráció / bejelentkezés
   - Feed betöltés
   - Scraper manuális trigger: POST /api/scraper Authorization: Bearer {CRON_SECRET}
   - Oracle elemzés egy hírre
   - Stripe checkout (test módban)
   - Webhook fogadás
```

---

# ÖSSZEFOGLALÁS

| Prompt | Mit épít | Becsült idő Cursorban |
|--------|----------|-----------------------|
| 1 | InvestigationBoard komponens TypeScriptben | 15 perc |
| 2 | Supabase séma + lib setup | 10 perc |
| 3 | Guardian scraper + GPT szűrés | 20 perc |
| 4 | Oracle elemzés API + cache | 20 perc |
| 5 | Főoldal feed | 20 perc |
| 6 | Investigation Board oldal | 15 perc |
| 7 | Auth + Stripe fizetés | 30 perc |
| 8 | Cron job + email alerts | 15 perc |
| 9 | SEO + PWA + performance | 15 perc |
| 10 | Deploy | 10 perc |

**Teljes becsült idő: ~2-3 óra Cursorral**

# TIPPEK CURSORHOZ

- Mindig add meg az összes releváns fájlt context-ként (@fájlnév) mielőtt kérsz valamit
- Ha valami nem stimmel a dizájnban: "pontosan ugyanolyan dark terminal dizájnt akarok mint az InvestigationBoard.tsx-ben"
- TypeScript hibáknál: "javítsd az összes TypeScript hibát ebben a fájlban"
- Ha valami nem működik: "add hozzá a console.log-okat hogy lássam mi történik"
