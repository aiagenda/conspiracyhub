<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

Single service: a **Next.js 16 (App Router)** app ("The Theorist"). Standard scripts
live in `package.json` / `README.md` (`npm run dev`, `build`, `start`, `lint`). The
startup update script only runs `npm install`.

- **Run:** `npm run dev` → http://localhost:3000. There is **no automated test suite**.
- **Lint:** `npm run lint` currently reports pre-existing errors/warnings unrelated to
  setup — do not treat those as environment breakage.
- **Graceful degradation:** every external integration (Supabase, OpenAI, Stripe,
  Resend, PostHog, Guardian/Reddit/Brave) is optional. With no `.env.local` the app
  still boots; the feed just shows a "SUPABASE NOT CONFIGURED" notice.

### Running with a local database (for feed/article/UAP functionality)

The core feed is Supabase-backed. Docker + the Supabase CLI are installed in the VM.

1. Start Docker if not running: `sudo dockerd > /tmp/dockerd.log 2>&1 &` then
   `sudo chmod 666 /var/run/docker.sock` (needed once per boot for non-sudo `docker`).
2. `supabase start` (from repo root) brings up the local stack and applies all
   `supabase/migrations/*` plus `supabase/seed.sql`.
3. Create `.env.local` (gitignored) with the local values printed by `supabase status`:
   - `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY>`
   - `SUPABASE_SERVICE_KEY=<SERVICE_ROLE_KEY>` (note: the code reads `SUPABASE_SERVICE_KEY`, not `SUPABASE_SERVICE_ROLE_KEY`)
   - `NEXT_PUBLIC_SITE_URL=http://localhost:3000`
4. Restart `npm run dev` after creating/changing `.env.local`.

**Non-obvious gotcha:** the SQL migrations create tables but never `GRANT` privileges
to the PostgREST roles (`anon`/`authenticated`/`service_role`). Hosted Supabase grants
these automatically; the local CLI does not, so without a fix the REST API returns
`permission denied for table ...` and the feed shows "NO ARTICLES". `supabase/seed.sql`
restores these grants (and inserts demo feed rows) and is applied automatically by
`supabase start` / `supabase db reset`. `page.tsx` also sets `revalidate = 900`, so
after seeding/changing data restart the dev server to bypass the route cache.
