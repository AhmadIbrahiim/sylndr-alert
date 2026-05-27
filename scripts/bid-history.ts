import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { Snapshot, SylndrItem } from "./types.ts";
import { auctionInfo } from "./types.ts";

const ROOT = new URL("..", import.meta.url).pathname;
const SNAPSHOT_DIR = join(ROOT, "snapshots");

/** One observation of a vehicle's auction tally at a given poll. */
export type BidPoint = {
  t: string; // ISO timestamp of the poll that observed this value
  bids: number; // auction.totalSubmissions
  bidders: number; // auction.totalUniqueSubmitters
};

/**
 * Per-vehicle bid time-series. Snapshots are frozen at first-seen (see
 * diff.ts), so this file is the only record of how the auction moves over
 * time. Points are appended only when the tally changes, so a car that sits
 * untouched for days stays a two-line file; `lastPolled` still advances every
 * poll so "no new bids in N hours" can be measured against the most recent
 * observation rather than the last change.
 */
export type BidHistory = {
  firstSeen: string; // first poll that recorded a tally for this vehicle
  lastPolled: string; // most recent poll that still saw this vehicle
  points: BidPoint[]; // change-points only, oldest → newest
};

function historyPath(id: string): string {
  return join(SNAPSHOT_DIR, `${id}.bids.json`);
}

export async function loadBidHistory(id: string): Promise<BidHistory | null> {
  const path = historyPath(id);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(await Bun.file(path).text()) as BidHistory;
  } catch {
    return null;
  }
}

async function saveBidHistory(id: string, hist: BidHistory): Promise<void> {
  await Bun.write(historyPath(id), JSON.stringify(hist) + "\n");
}

/**
 * Record the current auction tally for every live item. Appends a point only
 * when bids or bidders changed since the last recorded point; always advances
 * `lastPolled`. Vehicles with no auction object are skipped. Returns how many
 * histories gained a new change-point this run.
 */
export async function recordBidHistory(items: SylndrItem[], now: string): Promise<number> {
  await mkdir(SNAPSHOT_DIR, { recursive: true });
  let changed = 0;
  for (const item of items) {
    const info = auctionInfo(item);
    if (!info) continue;
    const id = item.vehicle.id;
    const { bids, bidders } = info;

    const existing = await loadBidHistory(id);
    if (!existing) {
      await saveBidHistory(id, { firstSeen: now, lastPolled: now, points: [{ t: now, bids, bidders }] });
      changed++;
      continue;
    }

    existing.lastPolled = now;
    const last = existing.points[existing.points.length - 1];
    if (!last || last.bids !== bids || last.bidders !== bidders) {
      existing.points.push({ t: now, bids, bidders });
      changed++;
    }
    await saveBidHistory(id, existing);
  }
  return changed;
}

/**
 * One-time migration: seed a history from a frozen snapshot's first-seen tally.
 * The snapshot recorded `totalSubmissions` at `firstSeen`, so that pair is a
 * real (if lone) observation — it gives the series an honest anchor point so
 * the next poll already produces a two-point progression. No-op if a history
 * already exists or the snapshot has no auction. Returns true if seeded.
 */
export async function backfillFromSnapshot(snap: Snapshot): Promise<boolean> {
  const id = snap.vehicle.id;
  if (await loadBidHistory(id)) return false;
  const info = auctionInfo(snap);
  if (!info) return false;
  await mkdir(SNAPSHOT_DIR, { recursive: true });
  await saveBidHistory(id, {
    firstSeen: snap.firstSeen,
    lastPolled: snap.firstSeen,
    points: [{ t: snap.firstSeen, bids: info.bids, bidders: info.bidders }],
  });
  return true;
}

export type BidTrendState =
  | "new" // tracking just started — not enough history to say anything
  | "cold" // no bids at all, and quiet
  | "active" // tally moved within the recent window
  | "stale"; // had bids, but none for a while

export type BidTrend = {
  current: number; // latest bid tally
  currentBidders: number; // latest bidder tally
  values: number[]; // bid tally per change-point, for the sparkline
  staleHours: number; // hours between the last change and the last poll
  windowHours: number; // hours between first and last observation
  recentGain: number; // bids added inside the staleness window's complement
  state: BidTrendState;
};

/** Hours that count as "a while" without movement before a car reads as stale. */
export const STALE_HOURS = 6;
/** Minimum observation window before we draw conclusions from the series. */
const WARMUP_HOURS = 2;

const HOUR_MS = 3_600_000;

function hoursBetween(a: string, b: string): number {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Number.isFinite(ms) ? Math.max(0, ms / HOUR_MS) : 0;
}

/** Derive a renderable trend (state + sparkline values) from a history. */
export function bidTrend(hist: BidHistory | null): BidTrend | null {
  if (!hist || hist.points.length === 0) return null;
  const points = hist.points;
  const last = points[points.length - 1];
  const first = points[0];
  const current = last.bids;
  const values = points.map((p) => p.bids);

  const staleHours = hoursBetween(last.t, hist.lastPolled);
  const windowHours = hoursBetween(first.t, hist.lastPolled);
  const recentGain = current - first.bids;

  let state: BidTrendState;
  if (points.length < 2 && windowHours < WARMUP_HOURS) {
    state = "new";
  } else if (staleHours < STALE_HOURS && points.length >= 2) {
    state = "active";
  } else if (current === 0) {
    state = "cold";
  } else {
    state = "stale";
  }

  return { current, currentBidders: last.bidders, values, staleHours, windowHours, recentGain, state };
}
