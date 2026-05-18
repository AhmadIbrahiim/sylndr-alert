# sylndr-alert

Personal alerting tool that watches the Sylndr (Egypt) used-car marketplace and emails when new listings match your filter. Static dashboard auto-published to GitHub Pages.

Architecture, design choices, and the full spec live in the design doc at
`~/.gstack/projects/sylndr-alert/`.

## How it works

- A GitHub Actions cron job (every 10 min) hits the public Sylndr vehicles API.
- The poll diffs against `state/seen.json`. Anything not previously seen is "new."
- New listings → snapshot to `snapshots/<id>.json`, send an HTML email via Resend, regenerate `docs/index.html`, commit the state back to `main`.
- First run on an empty `state/` is a "seed" — records everything, sends a one-time confirmation email.

## Run locally

```bash
bun install
bun scripts/poll.ts        # first run = seed
bun scripts/poll.ts        # subsequent runs = steady-state
```

Without `RESEND_API_KEY` / `EMAIL_TO` set, email sends are dry-run logged.

Open `docs/index.html` in a browser to see the dashboard.

## One-time setup for the cloud

1. **Create a Resend account** at [resend.com](https://resend.com) using the email you want alerts sent *to*. (Free tier sends from `onboarding@resend.dev`, but only to the account owner's email until you verify a custom sending domain.) Grab the API key.
2. **Push this repo to GitHub** (any visibility — Actions + Pages both work on free private repos for personal accounts).
3. **Add two repo secrets** in `Settings → Secrets and variables → Actions`:
   - `RESEND_API_KEY` — from step 1
   - `EMAIL_TO` — the email address registered on your Resend account
4. **Enable GitHub Pages** in `Settings → Pages`:
   - Source: "Deploy from a branch"
   - Branch: `main`, folder: `/docs`
5. **Trigger the first run** from `Actions → poll → Run workflow`. You should get a "seeded N listings" email within a few minutes.

## Changing what's tracked

Edit `filters.json` and commit/push. The next cron run uses the new filter, no redeploy.

```json
{
  "size": 20,
  "maxKilometrage": 100000,
  "minPrice": 250000,
  "maxPrice": 1500000,
  "transmissions": ["Automatic"],
  "bodyStyles": ["SUV", "Vans"],
  "auctionStatuses": ["PUBLISHED", "BEING_SOLD"]
}
```

This is the exact JSON body the script POSTs to `https://sylndr.com/api/market/vehicles`. Any field that endpoint accepts can be added.

## Cadence reality check

`schedule: */10 * * * *` is *best-effort* on GitHub Actions' free tier. In practice cron jobs run every 15–30 minutes and occasionally get skipped under load. This is fine for a personal tool watching a market where listings appear hourly at most.

## Reset / re-seed

Delete `state/seen.json` and the contents of `snapshots/`. The next run will treat everything as new (seed run) and send the "seeded N listings" email again.
