# The Theorist

A dark, AI-driven investigation feed and board experience. GPT-4o scores and ranks
government cover-ups, UAP sightings, classified patent secrets, and underground
theories from multiple live sources (Guardian, RSS, Reddit, FOIA indexes), then
presents them as an interactive "terminal" feed with article readers, investigation
boards, and topic trackers (UAP, Outbreaks, Insider Radar).

Built with **Next.js 16 (App Router)**, **React 19**, **Supabase**, **OpenAI**,
**Stripe**, **Resend**, and **PostHog**. Maps use **d3** + **topojson**.

> ⚠️ This repo targets Next.js 16, which has breaking changes vs. earlier versions.
> Before changing framework-level code, read the bundled docs in
> `node_modules/next/dist/docs/` (see [AGENTS.md](./AGENTS.md)).

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

Copy `.env.local.example` to `.env.local` and fill in every key before running the
API routes. Key groups:

- **Supabase** — `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_KEY` (server-only; used by the feed loader and ingest).
- **OpenAI** — `OPENAI_API_KEY` (scoring, lore/article generation, Oracle).
- **Sources** — `GUARDIAN_API_KEY` and the Reddit/Brave keys used by the radars.
- **Billing** — `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
  `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_PRICE_ID`.
- **Cron / admin** — `CRON_SECRET`, `ADMIN_SECRET`.
- **Email** — `RESEND_API_KEY` (weekly briefing).
- **Analytics** — `NEXT_PUBLIC_POSTHOG_*`, `POSTHOG_PROJECT_ID`,
  `POSTHOG_PERSONAL_API_KEY`.
- **Site URL** — set `NEXT_PUBLIC_SITE_URL` to your deployed origin. When unset it
  falls back to `https://conspiracyhub.vercel.app`, which is used for canonical
  URLs, OG metadata, and the sitemap — so set it in production.

Database schema lives in [`supabase-schema.sql`](./supabase-schema.sql) and the
`supabase/` directory.

## Scripts

| Command         | Description              |
| --------------- | ------------------------ |
| `npm run dev`   | Start the dev server     |
| `npm run build` | Production build         |
| `npm run start` | Run the production build |
| `npm run lint`  | ESLint                   |

## Project layout

- `src/app` — App Router routes, API handlers, and page shells.
- `src/components` — feed, readers, trackers, investigation board, admin UI.
- `src/lib` — data access, scoring/ingest pipelines (`src/lib/server`), and helpers.
- `scripts/`, `supabase/` — ingest/cron utilities and database setup.

## Deployment

Deployed on Vercel. Image optimization is enabled for a curated allowlist of stable
image hosts (see [`src/lib/imageHosts.ts`](./src/lib/imageHosts.ts) and
`images.remotePatterns` in [`next.config.ts`](./next.config.ts)); images from other
upstream sources fall back to unoptimized rendering.
