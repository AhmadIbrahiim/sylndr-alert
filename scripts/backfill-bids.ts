/**
 * One-time backfill: seed each vehicle's bid history from its frozen snapshot's
 * first-seen tally, so the time-series has a real anchor point before the next
 * poll. Idempotent — skips vehicles that already have a `.bids.json`.
 *
 *   bun scripts/backfill-bids.ts
 */
import { loadAllSnapshots } from "./render.ts";
import { backfillFromSnapshot } from "./bid-history.ts";

const snaps = await loadAllSnapshots();
let seeded = 0;
for (const snap of snaps) {
  if (await backfillFromSnapshot(snap)) seeded++;
}
console.log(`backfilled ${seeded} bid histories from ${snaps.length} snapshots`);
