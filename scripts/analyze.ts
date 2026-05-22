import { readdir, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Snapshot } from "./types.ts";
import { retailPrice, sylndrMargin, auctionInfo } from "./types.ts";
import { daysSince, listedAt, marginTier } from "./shared.ts";

const ROOT = new URL("..", import.meta.url).pathname;
const SNAPSHOT_DIR = join(ROOT, "snapshots");

export type BulletTone = "good" | "mid" | "hot" | "neutral";

/** Locale-agnostic bullet: a tone, a pip-label key, a body-text key, and args. */
export type AnalysisBullet = {
  tone: BulletTone;
  pipKey: string;       // i18n key for the small chip label
  pipArgs?: Record<string, string | number>;
  textKey: string;      // i18n key for the body text
  textArgs?: Record<string, string | number>;
};

export type SummaryParts = {
  verdictKey: string;             // summary.verdict.good | high | fair
  cohortLineKey: string;          // summary.cohortLine.yes | none
  cohortKindKey: string | null;   // detail.cohort.refSize.kind.model | modelYear
  ageSuffixKey: string | null;    // summary.suffix.ageFresh | ageOld
  heatSuffixKey: string | null;   // summary.suffix.heatHot
  marginSuffixKey: string | null; // summary.suffix.marginLow | marginHigh
  args: {
    refSize: number;
    year: string;
    title: string;
  };
};

export type Analysis = {
  vehicleId: string;
  computedAt: string;
  cohort: {
    sameModelCount: number;
    sameYearCount: number;
    refCohort: "model+year" | "model";
    refSize: number;
  };
  pricePercentile: number | null;
  pricePerKm: number | null;
  pricePerKmPercentile: number | null;
  kmPercentile: number | null;
  daysListed: number;
  marginPct: number | null;
  marginTier: "low" | "mid" | "high" | null;
  auctionHeat: "cold" | "warm" | "hot" | null;
  dealTag: "good" | "fair" | "high";
  bullets: AnalysisBullet[];
  summary: SummaryParts;
};

function percentile(value: number, sortedAsc: number[]): number {
  if (!sortedAsc.length) return 50;
  let lo = 0;
  let hi = sortedAsc.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (sortedAsc[mid]! < value) lo = mid + 1;
    else hi = mid;
  }
  return Math.round((lo / sortedAsc.length) * 100);
}

function cohortKey(snap: Snapshot, withYear: boolean): string {
  const make = (snap.vehicle.carMake?.name ?? "").toLowerCase();
  const model = (snap.vehicle.carModel?.name ?? "").toLowerCase();
  const year = snap.vehicle.carYear?.name ?? "";
  return withYear ? `${make}|${model}|${year}` : `${make}|${model}`;
}

function km(snap: Snapshot): number {
  const n = Number(snap.vehicle.kilometrage);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function dealVerdict(
  pricePctl: number | null,
  kmPctl: number | null,
  ppkmPctl: number | null,
): "good" | "fair" | "high" {
  const signals: number[] = [];
  if (pricePctl != null) signals.push(pricePctl);
  if (ppkmPctl != null) signals.push(ppkmPctl);
  if (!signals.length) return "fair";
  const avg = signals.reduce((a, b) => a + b, 0) / signals.length;
  const kmBonus = kmPctl != null && kmPctl < 40 ? -10 : 0;
  const score = avg + kmBonus;
  if (score < 35) return "good";
  if (score > 70) return "high";
  return "fair";
}

function auctionHeat(snap: Snapshot): "cold" | "warm" | "hot" | null {
  const a = auctionInfo(snap);
  if (!a) return null;
  if (a.isLive) return "hot";
  if (a.bids >= 5) return "hot";
  if (a.bids >= 1) return "warm";
  return "cold";
}

const COHORT_KIND_KEY = {
  yes: "detail.cohort.refSize.kind.modelYear",
  no: "detail.cohort.refSize.kind.model",
};

export function analyzeSnapshot(snap: Snapshot, all: Snapshot[]): Analysis {
  const id = snap.vehicle.id;
  const myKey = cohortKey(snap, true);
  const modelKey = cohortKey(snap, false);

  const modelCohort = all.filter((s) => cohortKey(s, false) === modelKey);
  const yearCohort = all.filter((s) => cohortKey(s, true) === myKey);

  const refUseYear = yearCohort.length >= 4;
  const ref = refUseYear ? yearCohort : modelCohort;
  const refKindKey = refUseYear ? COHORT_KIND_KEY.yes : COHORT_KIND_KEY.no;

  const myPrice = retailPrice(snap);
  const myKm = km(snap);
  const myPpkm = myPrice > 0 && myKm > 0 ? myPrice / myKm : null;

  const refPrices = ref.map((s) => retailPrice(s)).filter((n) => n > 0).sort((a, b) => a - b);
  const refKms = ref.map((s) => km(s)).filter((n) => n > 0).sort((a, b) => a - b);
  const refPpkms = ref
    .map((s) => {
      const p = retailPrice(s);
      const k = km(s);
      return p > 0 && k > 0 ? p / k : null;
    })
    .filter((n): n is number => n != null)
    .sort((a, b) => a - b);

  const pricePctl = myPrice > 0 && refPrices.length >= 3 ? percentile(myPrice, refPrices) : null;
  const kmPctl = myKm > 0 && refKms.length >= 3 ? percentile(myKm, refKms) : null;
  const ppkmPctl = myPpkm != null && refPpkms.length >= 3 ? percentile(myPpkm, refPpkms) : null;

  const margin = sylndrMargin(snap);
  const marginPct = margin?.pct ?? null;
  const mTier = marginPct != null ? marginTier(marginPct) : null;
  const heat = auctionHeat(snap);
  const days = daysSince(listedAt(snap));
  const deal = dealVerdict(pricePctl, kmPctl, ppkmPctl);

  const bullets: AnalysisBullet[] = [];

  if (pricePctl != null) {
    const cheaperPct = 100 - pricePctl;
    const tone: BulletTone = pricePctl < 35 ? "good" : pricePctl > 70 ? "hot" : "mid";
    const pipKey =
      tone === "good" ? "bullet.pip.deal" : tone === "hot" ? "bullet.pip.high" : "bullet.pip.mid";
    bullets.push({
      tone,
      pipKey,
      textKey: "bullet.priceCheaper",
      textArgs: { pct: cheaperPct, n: ref.length, kind: refKindKey },
    });
  }

  if (ppkmPctl != null && myPpkm != null) {
    const cheaperPct = 100 - ppkmPctl;
    const tone: BulletTone = ppkmPctl < 35 ? "good" : ppkmPctl > 70 ? "hot" : "mid";
    const pipKey =
      tone === "good" ? "bullet.pip.value" : tone === "hot" ? "bullet.pip.pricey" : "bullet.pip.value";
    bullets.push({
      tone,
      pipKey,
      textKey: "bullet.ppkmBetter",
      textArgs: { pct: cheaperPct, ppkm: Math.round(myPpkm) },
    });
  }

  if (kmPctl != null) {
    const lowerPct = 100 - kmPctl;
    const tone: BulletTone = kmPctl < 35 ? "good" : kmPctl > 70 ? "hot" : "mid";
    const pipKey =
      tone === "good" ? "bullet.pip.lowKm" : tone === "hot" ? "bullet.pip.highKm" : "bullet.pip.km";
    bullets.push({
      tone,
      pipKey,
      textKey: "bullet.kmLower",
      textArgs: { pct: lowerPct },
    });
  }

  if (mTier && marginPct != null) {
    const tone: BulletTone = mTier === "low" ? "good" : mTier === "high" ? "hot" : "mid";
    const textKey =
      mTier === "low"
        ? "bullet.marginLow"
        : mTier === "high"
          ? "bullet.marginHigh"
          : "bullet.marginMid";
    bullets.push({
      tone,
      pipKey: "bullet.pip.marginPct",
      pipArgs: { pct: marginPct.toFixed(0) },
      textKey,
    });
  }

  if (heat) {
    const tone: BulletTone = heat === "hot" ? "hot" : heat === "warm" ? "mid" : "neutral";
    const pipKey =
      heat === "hot" ? "bullet.pip.hot" : heat === "warm" ? "bullet.pip.warm" : "bullet.pip.cold";
    const textKey =
      heat === "hot" ? "bullet.auctionHot" : heat === "warm" ? "bullet.auctionWarm" : "bullet.auctionCold";
    bullets.push({ tone, pipKey, textKey });
  }

  if (days >= 14) {
    bullets.push({
      tone: "neutral",
      pipKey: "bullet.pip.daysListed",
      pipArgs: { n: days },
      textKey: "bullet.listedOld",
      textArgs: { n: days },
    });
  } else if (days <= 1) {
    bullets.push({
      tone: "good",
      pipKey: "bullet.pip.fresh",
      textKey: "bullet.listedFresh",
    });
  }

  const verdictKey =
    deal === "good"
      ? "summary.verdict.good"
      : deal === "high"
        ? "summary.verdict.high"
        : "summary.verdict.fair";

  const summary: SummaryParts = {
    verdictKey,
    cohortLineKey: ref.length > 0 ? "summary.cohortLine.yes" : "summary.cohortLine.none",
    cohortKindKey: ref.length > 0 ? refKindKey : null,
    ageSuffixKey:
      days <= 1 ? "summary.suffix.ageFresh" : days >= 30 ? "summary.suffix.ageOld" : null,
    heatSuffixKey: heat === "hot" ? "summary.suffix.heatHot" : null,
    marginSuffixKey:
      mTier === "low" ? "summary.suffix.marginLow" : mTier === "high" ? "summary.suffix.marginHigh" : null,
    args: {
      refSize: ref.length,
      year: snap.vehicle.carYear?.name ?? "",
      title: `${snap.vehicle.carMake?.name ?? ""} ${snap.vehicle.carModel?.name ?? ""}`.trim(),
    },
  };

  return {
    vehicleId: id,
    computedAt: new Date().toISOString(),
    cohort: {
      sameModelCount: modelCohort.length,
      sameYearCount: yearCohort.length,
      refCohort: refUseYear ? "model+year" : "model",
      refSize: ref.length,
    },
    pricePercentile: pricePctl,
    pricePerKm: myPpkm,
    pricePerKmPercentile: ppkmPctl,
    kmPercentile: kmPctl,
    daysListed: days,
    marginPct,
    marginTier: mTier,
    auctionHeat: heat,
    dealTag: deal,
    bullets,
    summary,
  };
}

async function loadAllSnapshots(): Promise<Snapshot[]> {
  let files: string[];
  try {
    files = await readdir(SNAPSHOT_DIR);
  } catch {
    return [];
  }
  const snaps: Snapshot[] = [];
  for (const f of files) {
    if (!f.endsWith(".json")) continue;
    if (f.endsWith(".analysis.json")) continue;
    const raw = await Bun.file(join(SNAPSHOT_DIR, f)).text();
    snaps.push(JSON.parse(raw) as Snapshot);
  }
  return snaps;
}

export async function loadAnalysis(id: string): Promise<Analysis | null> {
  const path = join(SNAPSHOT_DIR, `${id}.analysis.json`);
  try {
    const raw = await Bun.file(path).text();
    return JSON.parse(raw) as Analysis;
  } catch {
    return null;
  }
}

export async function analyzeAll(): Promise<number> {
  const all = await loadAllSnapshots();
  if (!all.length) return 0;
  await mkdir(SNAPSHOT_DIR, { recursive: true });
  let written = 0;
  for (const snap of all) {
    const a = analyzeSnapshot(snap, all);
    const path = join(SNAPSHOT_DIR, `${snap.vehicle.id}.analysis.json`);
    await writeFile(path, JSON.stringify(a, null, 2) + "\n");
    written++;
  }
  return written;
}

if (import.meta.main) {
  const n = await analyzeAll();
  console.log(`analyzed ${n} snapshots`);
}
