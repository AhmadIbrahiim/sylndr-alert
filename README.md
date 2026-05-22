# sylndr-alert

Personal Sylndr (Egypt used-car marketplace) browser + alerter.

Polls Sylndr's public `/api/market/vehicles` endpoint, snapshots every car currently for sale, regenerates a static dashboard at `docs/index.html` plus per-vehicle detail pages at `docs/v/<id>.html` (deployed to GitHub Pages), enriches each listing with cohort heuristics and a GitHub Models AI take, and pushes a digest notification (email via Resend, push via [ntfy.sh](https://ntfy.sh)) when new listings appear.

## How it works

- **Fetch scope**: every listing with `auctionStatuses ∈ {PUBLISHED, BEING_SOLD, SOLD}` — currently ~1000 cars. No body / transmission / price / km filtering at the API level.
- **Diff**: each poll diffs vehicle IDs against `state/seen.json`. New IDs become snapshots and seed the alert digest.
- **Analyze (heuristic)**: every poll recomputes cohort stats for every snapshot — price percentile vs same make/model/year, EGP-per-km percentile, km percentile, Sylndr margin tier, auction heat — written to `snapshots/<id>.analysis.json`. The dashboard tags each car as `looks fair / middle / trends pricey`.
- **Analyze (AI)**: for NEW vehicles only, the poll calls [GitHub Models](https://github.com/marketplace?type=models) (default `openai/gpt-4o-mini`, requires `models: read` permission on the workflow) with the snapshot + heuristic cohort context and asks for an opinionated buyer's take. The reply is saved to `snapshots/<id>.analysis.md` and rendered on the detail page. Cap: `AI_PER_RUN_CAP=10` per poll to keep latency and free-tier quota usage low.
- **Alerts**: digest mode. One notification per poll says "N new listings" with 3 highlight cards and a link to the dashboard. No per-listing email spam.
- **Index dashboard**: all ~1000 cars rendered as cards. Sticky filter bar at the top filters in-browser by body, transmission, status, deal verdict, price, km, year, and free-text search. Sort by listed-date, price, margin, km, or year. Filter state persists in the URL hash so views are bookmarkable. The card photo opens the live Sylndr listing in a new tab; the title links to the per-vehicle detail page.
- **Per-vehicle detail page**: `docs/v/<id>.html` — gallery, full price ladder with margin visualization, auction tiles, raw specs, heuristic analysis bullets, and the AI take. One static page per car, sharing `docs/assets/style.css`.

## Cron schedule

``` 
0,15,30,45 5-15 * * *
0 16 * * *
```

Runs every 15 min from **05:00 to 15:45 UTC** plus **16:00 UTC** = **8:00 AM – 7:00 PM Cairo (EEST, summer)**. 45 runs/day. Plus:
- `workflow_dispatch` — manual trigger from GitHub Actions UI or `gh workflow run poll.yml`
- `push` to `main` — triggers immediately when you change `scripts/` or the workflow itself

Note: anchored to UTC, so in Egyptian winter (EET, UTC+2) the local-time window shifts to 7 AM – 6 PM.

## Run locally

```bash
bun install
bun scripts/poll.ts        # first run = seed (records everything)
bun scripts/poll.ts        # subsequent runs = diff + analyze + render + notify
```

Without `RESEND_API_KEY` / `EMAIL_TO` / `NTFY_TOPIC` env vars, those sends are dry-run logged. Without `GITHUB_TOKEN`, AI analysis is skipped (logged) and heuristic analysis still runs.

Open `docs/index.html` in a browser to see the dashboard locally.

## One-time setup for the cloud

1. **Resend** (optional, email alerts): sign up at [resend.com](https://resend.com) with the address you want alerts at. Grab the API key. On the free tier, `onboarding@resend.dev` only sends to your account email until you verify a domain.
2. **ntfy.sh** (optional, push alerts): pick a long random topic name (e.g. `sylndr-alert-<your-handle>-<random>`). Subscribe via the iOS/Android app or `https://ntfy.sh/<topic>` in a browser.
3. **GitHub repo secrets** at `Settings → Secrets and variables → Actions`:
   - `RESEND_API_KEY` (optional)
   - `EMAIL_TO` (optional; must match Resend account email until you verify a domain)
   - `NTFY_TOPIC` (optional)
4. **GitHub Models** (optional, free for public repos): nothing to configure — the workflow already requests `models: read`. To disable, drop the `models: read` permission and the AI step becomes a logged no-op.
5. **GitHub Pages**: `Settings → Pages → Source: Deploy from a branch → Branch: main, folder: /docs`.
6. **Trigger the first run**: `gh workflow run poll.yml` (or click "Run workflow" in the Actions tab). You should get a "seeded N listings" notification.

## File layout

```
sylndr-alert/
├── .github/workflows/
│   ├── poll.yml          (cron + push + manual; the main job, with models: read)
│   └── test-email.yml    (manual test for Resend + ntfy)
├── scripts/
│   ├── poll.ts           (orchestrator: fetch → diff → analyze → AI → render → commit)
│   ├── fetch.ts          (Sylndr API client with polite pagination)
│   ├── diff.ts           (state R/W, snapshot writes)
│   ├── analyze.ts        (heuristic cohort analyzer → snapshots/<id>.analysis.json)
│   ├── analyze-ai.ts     (GitHub Models AI take → snapshots/<id>.analysis.md)
│   ├── render.ts         (index page + writeAllDocs)
│   ├── render-vehicle.ts (per-vehicle detail page)
│   ├── shared.ts         (formatters, image helpers, design tokens)
│   ├── styles.ts         (central stylesheet emitted to docs/assets/style.css)
│   ├── email.ts          (Resend digest)
│   ├── ntfy.ts           (ntfy.sh digest)
│   ├── test-email.ts     (manual test for Resend)
│   ├── test-ntfy.ts      (manual test for ntfy)
│   └── types.ts          (shared types + retailPrice/wholesalePrice/etc helpers)
├── docs/
│   ├── index.html        (regenerated each poll; served by GitHub Pages)
│   ├── ar/index.html     (Arabic translation, RTL)
│   ├── v/<id>.html       (one detail page per snapshot, English)
│   ├── ar/v/<id>.html    (one detail page per snapshot, Arabic)
│   └── assets/style.css  (shared by all pages)
├── snapshots/
│   ├── <id>.json             (one per car, full API payload + firstSeen ts)
│   ├── <id>.analysis.json    (heuristic cohort stats — committed each poll)
│   └── <id>.analysis.md      (AI take, written on first sighting of a new car)
├── state/seen.json       (sorted array of every vehicle ID ever observed)
└── state/failures.json   (consecutive-failure counter for broken-scraper alert)
```

## Internationalization

The dashboard renders in two locales: English (`/`) and Arabic (`/ar/`). Arabic uses informal, conversational language — easy to read for an Egyptian buyer. Every page has a language switcher in the header. Make/model names use the API's `arName` field where available; UI strings and analysis bullets come from `scripts/i18n.ts`.

## Run manually

```bash
bun install
bun scripts/poll.ts          # full pipeline: fetch + diff + analyze + AI + render
bun scripts/analyze.ts       # heuristic-only re-analysis of every snapshot
bun scripts/analyze-ai.ts    # AI analysis for snapshots without a .analysis.md (cap = 10)
bun scripts/render.ts        # re-render docs from current snapshots + analyses
```

Local AI calls need `GITHUB_TOKEN` exported (a fine-grained PAT with `models: read` works). Without it, the AI step is a logged no-op and the heuristic analysis still runs.

## Reset / re-seed

Delete `state/seen.json`, `state/failures.json`, and the contents of `snapshots/`. The next run treats everything as new (seed run) and sends one "seeded N listings" notification.
