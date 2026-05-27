import type { Snapshot, SylndrImage } from "./types.ts";

export function fmt(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

export function fmtPrice(n: number): string {
  if (!n) return "—";
  return fmt(n);
}

export function fmtPriceShort(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

export function fmtKm(s: string | null | undefined): string {
  if (!s) return "—";
  const n = Number(s);
  if (!Number.isFinite(n)) return s;
  return fmt(n);
}

export function fmtRelative(iso: string): string {
  const t = new Date(iso).getTime();
  const dt = Date.now() - t;
  const min = Math.floor(dt / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  return `${mo}mo ago`;
}

export function fmtAbsolute(iso: string): string {
  const d = new Date(iso);
  return d.toISOString().slice(0, 16).replace("T", " ") + " UTC";
}

export function daysSince(iso: string): number {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
}

/**
 * Inline-SVG sparkline from a series of values. No deps, no script — just a
 * filled area + stroked line + a dot on the latest point, sized to fit a
 * flex/grid cell via preserveAspectRatio="none". Classes (spark-area /
 * spark-line / spark-dot) are styled in styles.ts. A flat or single-point
 * series renders as a centered horizontal line so "no movement" still reads.
 */
export function sparklineSvg(
  values: number[],
  opts?: { w?: number; h?: number; cls?: string },
): string {
  const w = opts?.w ?? 120;
  const h = opts?.h ?? 30;
  const cls = opts?.cls ?? "spark";
  if (values.length === 0) return "";

  const pad = 2;
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const flat = max === min;
  const range = flat ? 1 : max - min;
  const n = values.length;

  const xAt = (i: number) => (n === 1 ? pad + innerW / 2 : pad + (i / (n - 1)) * innerW);
  const yAt = (v: number) => (flat ? h / 2 : pad + innerH - ((v - min) / range) * innerH);

  // For a single point, draw a flat line spanning the full width.
  const xs = n === 1 ? [pad, w - pad] : values.map((_, i) => xAt(i));
  const ys = n === 1 ? [yAt(values[0]), yAt(values[0])] : values.map((v) => yAt(v));

  const line = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
  const baseline = (h - pad).toFixed(1);
  const area = `${line} L${xs[xs.length - 1].toFixed(1)},${baseline} L${xs[0].toFixed(1)},${baseline} Z`;
  const dotX = xs[xs.length - 1].toFixed(1);
  const dotY = ys[ys.length - 1].toFixed(1);

  return `<svg class="${cls}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-hidden="true"><path class="spark-area" d="${area}" /><path class="spark-line" d="${line}" fill="none" /><circle class="spark-dot" cx="${dotX}" cy="${dotY}" r="2.4" /></svg>`;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function listedAt(snap: Snapshot): string {
  return snap.auction?.publishedAt ?? snap.firstSeen;
}

export function pickPhoto(snap: Snapshot): string | null {
  const imgs = snap.vehicle.images ?? [];
  const ext = imgs.find((i) => i.imageType === "EXTERIOR");
  return ext?.imageUrl ?? imgs[0]?.imageUrl ?? null;
}

export function partitionedImages(snap: Snapshot): {
  exterior: SylndrImage[];
  interior: SylndrImage[];
  engine: SylndrImage[];
  other: SylndrImage[];
} {
  const all = snap.vehicle.images ?? [];
  const exterior: SylndrImage[] = [];
  const interior: SylndrImage[] = [];
  const engine: SylndrImage[] = [];
  const other: SylndrImage[] = [];
  for (const img of all) {
    switch (img.imageType) {
      case "EXTERIOR":
        exterior.push(img);
        break;
      case "INTERIOR":
        interior.push(img);
        break;
      case "ENGINE":
        engine.push(img);
        break;
      default:
        other.push(img);
    }
  }
  return { exterior, interior, engine, other };
}

export function marginTier(pct: number): "low" | "mid" | "high" {
  if (pct < 15) return "low";
  if (pct < 30) return "mid";
  return "high";
}

export function fmtAuctionTypeLabel(t: string | null): string {
  if (!t) return "auction";
  return t.toLowerCase();
}

export function vehicleTitle(snap: Snapshot): string {
  const make = snap.vehicle.carMake?.name ?? "";
  const model = snap.vehicle.carModel?.name ?? "";
  return `${make} ${model}`.trim() || "Unknown vehicle";
}

// URL helpers now live in i18n.ts since they vary by locale.

export type InspectionStats = {
  total: number;
  faulty: number;
  ok: number;
  neutral: number;
  okPct: number;             // 0-100
  severity: "clean" | "minor" | "many";
  bySection: Array<{
    name: string;
    nameEn: string;
    order: number;
    total: number;
    faulty: number;
    ok: number;
    neutral: number;
    okPct: number;
    severity: "clean" | "minor" | "many";
  }>;
};

import type { Snapshot } from "./types.ts";

function classify(faultyPct: number): "clean" | "minor" | "many" {
  if (faultyPct < 15) return "clean";
  if (faultyPct < 40) return "minor";
  return "many";
}

export function computeInspectionStats(snap: Snapshot): InspectionStats | null {
  const sections = snap.inspectionReport?.sections;
  if (!sections || sections.length === 0) return null;

  let total = 0;
  let faulty = 0;
  let ok = 0;
  let neutral = 0;
  const bySection: InspectionStats["bySection"] = [];

  for (const s of sections) {
    let sTotal = 0;
    let sFaulty = 0;
    let sOk = 0;
    let sNeutral = 0;
    for (const a of s.answers ?? []) {
      sTotal++;
      if (a.faulty === true) sFaulty++;
      else if (a.faulty === false) sOk++;
      else sNeutral++;
    }
    total += sTotal;
    faulty += sFaulty;
    ok += sOk;
    neutral += sNeutral;
    const denom = sTotal - sNeutral || 1;
    const sOkPct = Math.round((sOk / denom) * 100);
    bySection.push({
      name: s.name,
      nameEn: s.nameEn,
      order: s.order ?? 0,
      total: sTotal,
      faulty: sFaulty,
      ok: sOk,
      neutral: sNeutral,
      okPct: sOkPct,
      severity: classify(((sFaulty / denom) * 100)),
    });
  }

  bySection.sort((a, b) => a.order - b.order);

  const denomTotal = total - neutral || 1;
  const okPct = Math.round((ok / denomTotal) * 100);
  const faultyPct = (faulty / denomTotal) * 100;

  return {
    total,
    faulty,
    ok,
    neutral,
    okPct,
    severity: classify(faultyPct),
    bySection,
  };
}
