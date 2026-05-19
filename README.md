# sylndr-alert

Personal Sylndr (Egypt used-car marketplace) browser + alerter.

Polls Sylndr's public `/api/market/vehicles` endpoint, snapshots every car currently for sale, regenerates a static dashboard at `docs/index.html` (deployed to GitHub Pages), and pushes a digest notification (email via Resend, push via [ntfy.sh](https://ntfy.sh)) when new listings appear.

## How it works

- **Fetch scope**: every listing with `auctionStatuses ∈ {PUBLISHED, BEING_SOLD}` — currently ~800 cars. No body / transmission / price / km filtering at the API level.
- **Diff**: each poll diffs vehicle IDs against `state/seen.json`. New IDs become snapshots and seed the alert digest.
- **Alerts**: digest mode. One notification per poll says "N new listings" with 3 highlight cards and a link to the dashboard. No per-listing email spam.
- **Dashboard**: all ~800 cars rendered as cards. Sticky filter bar at the top filters in-browser by body, transmission, status, price, km, year, and free-text search. Sort by listed-date, price, margin, km, or year. Filter state persists in the URL hash so views are bookmarkable.

## Cron schedule

```
*/15 6-14 * * *
```

Runs every 15 min from **06:00 to 14:45 UTC** = **9:00 AM – 5:45 PM Cairo (EEST, summer)**. 36 runs/day. Plus:
- `workflow_dispatch` — manual trigger from GitHub Actions UI or `gh workflow run poll.yml`
- `push` to `main` — triggers immediately when you change `scripts/` or the workflow itself

Note: anchored to UTC, so in Egyptian winter (EET, UTC+2) the local-time window shifts to 8 AM – 4:45 PM. Bump the cron hours +1 to restore 9 AM – 5:45 PM if running in winter.

## Run locally

```bash
bun install
bun scripts/poll.ts        # first run = seed (records everything)
bun scripts/poll.ts        # subsequent runs = diff + notify
```

Without `RESEND_API_KEY` / `EMAIL_TO` / `NTFY_TOPIC` env vars, those sends are dry-run logged.

Open `docs/index.html` in a browser to see the dashboard locally.

## One-time setup for the cloud

1. **Resend** (optional, email alerts): sign up at [resend.com](https://resend.com) with the address you want alerts at. Grab the API key. On the free tier, `onboarding@resend.dev` only sends to your account email until you verify a domain.
2. **ntfy.sh** (optional, push alerts): pick a long random topic name (e.g. `sylndr-alert-<your-handle>-<random>`). Subscribe via the iOS/Android app or `https://ntfy.sh/<topic>` in a browser.
3. **GitHub repo secrets** at `Settings → Secrets and variables → Actions`:
   - `RESEND_API_KEY` (optional)
   - `EMAIL_TO` (optional; must match Resend account email until you verify a domain)
   - `NTFY_TOPIC` (optional)
4. **GitHub Pages**: `Settings → Pages → Source: Deploy from a branch → Branch: main, folder: /docs`.
5. **Trigger the first run**: `gh workflow run poll.yml` (or click "Run workflow" in the Actions tab). You should get a "seeded N listings" notification.

## File layout

```
sylndr-alert/
├── .github/workflows/
│   ├── poll.yml          (cron + push + manual; the main job)
│   └── test-email.yml    (manual test for Resend + ntfy)
├── scripts/
│   ├── poll.ts           (orchestrator: fetch → diff → notify → render → commit)
│   ├── fetch.ts          (Sylndr API client with polite pagination)
│   ├── diff.ts           (state R/W, snapshot writes)
│   ├── render.ts         (dashboard HTML, filter bar, client-side JS)
│   ├── email.ts          (Resend digest)
│   ├── ntfy.ts           (ntfy.sh digest)
│   ├── test-email.ts     (manual test for Resend)
│   ├── test-ntfy.ts      (manual test for ntfy)
│   └── types.ts          (shared types + retailPrice/wholesalePrice/etc helpers)
├── docs/index.html       (regenerated each poll; served by GitHub Pages)
├── snapshots/<id>.json   (one per car, full API payload + firstSeen ts)
├── state/seen.json       (sorted array of every vehicle ID ever observed)
└── state/failures.json   (consecutive-failure counter for broken-scraper alert)
```

## Reset / re-seed

Delete `state/seen.json`, `state/failures.json`, and the contents of `snapshots/`. The next run treats everything as new (seed run) and sends one "seeded N listings" notification.
