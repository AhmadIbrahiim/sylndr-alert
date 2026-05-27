import { readFile, writeFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Snapshot, SylndrItem } from "./types.ts";
import {
  retailPrice,
  marketPrice,
  askingPrice,
  marketPremium,
  auctionInfo,
} from "./types.ts";
import { fmt, fmtKm, listedAt, daysSince } from "./shared.ts";
import { loadAnalysis } from "./analyze.ts";

const ROOT = new URL("..", import.meta.url).pathname;
const SNAPSHOT_DIR = join(ROOT, "snapshots");

const ENDPOINT = "https://models.github.ai/inference/chat/completions";
const MODEL = process.env.AI_MODEL ?? "openai/gpt-4o-mini";
const TIMEOUT_MS = 30_000;
const CONCURRENCY = 2;
const PER_RUN_CAP = Number(process.env.AI_PER_RUN_CAP ?? "20");

const SYSTEM_PROMPT = `You are a no-nonsense Egyptian used-car analyst writing for a buyer browsing Sylndr.com listings.
Given one car's API data plus computed cohort stats, write a TIGHT, opinionated take (~80-120 words, markdown).
Be specific and useful. Lead with the verdict. Cover: is the asking price reasonable for the year + km, what to inspect first on this make/model, and any red flags. Skip generic filler.
Never invent numbers. Use only what's in the data. Output markdown only — no code fences, no preamble.`;

function buildUserPrompt(snap: Snapshot, analysis: Awaited<ReturnType<typeof loadAnalysis>>): string {
  const v = snap.vehicle;
  const a = auctionInfo(snap);
  const retail = retailPrice(snap);
  const market = marketPrice(snap);
  const asked = askingPrice(snap);
  const margin = marketPremium(snap);
  const days = daysSince(listedAt(snap));

  const lines: string[] = [];
  lines.push(`## Car`);
  lines.push(`- ${v.carYear?.name ?? "?"} ${v.carMake?.name ?? ""} ${v.carModel?.name ?? ""}`.trim());
  if (v.bodyStyle) lines.push(`- Body: ${v.bodyStyle}`);
  if (v.transmission) lines.push(`- Transmission: ${v.transmission}`);
  if (v.color) lines.push(`- Color: ${v.color}`);
  if (v.kilometrage) lines.push(`- Kilometrage: ${fmtKm(v.kilometrage)} km`);
  lines.push(`- Listed: ${days} days ago`);

  lines.push(`\n## Prices (EGP)`);
  if (asked) lines.push(`- Asking: ${fmt(asked)}`);
  if (market) lines.push(`- Sylndr's market price estimate: ${fmt(market)}`);
  if (retail) lines.push(`- Retail (buyer pays): ${fmt(retail)}`);
  if (margin) {
    const label = margin.pct >= 0 ? "above market" : "below market";
    lines.push(`- Retail vs market: ${Math.abs(margin.pct).toFixed(1)}% ${label} (${fmt(Math.abs(margin.abs))} EGP)`);
  }

  if (a) {
    lines.push(`\n## Auction`);
    lines.push(`- Status: ${a.status}, Type: ${a.type ?? "?"}`);
    lines.push(`- Bids: ${a.bids}, Bidders: ${a.bidders}`);
    if (a.winnerAmount) lines.push(`- Winning bid: ${fmt(a.winnerAmount)} EGP`);
  }

  if (analysis) {
    lines.push(`\n## Cohort stats (${analysis.cohort.refSize} ${analysis.cohort.refCohort} listings)`);
    if (analysis.pricePercentile != null) lines.push(`- Price percentile: ${analysis.pricePercentile} (0 = cheapest, 100 = most expensive)`);
    if (analysis.pricePerKmPercentile != null) lines.push(`- EGP-per-km percentile: ${analysis.pricePerKmPercentile}`);
    if (analysis.kmPercentile != null) lines.push(`- KM percentile: ${analysis.kmPercentile} (0 = lowest)`);
    if (analysis.pricePerKm != null) lines.push(`- This car EGP/km: ${analysis.pricePerKm.toFixed(1)}`);
    lines.push(`- Heuristic verdict: ${analysis.dealTag}`);
  }

  lines.push(`\nWrite the take now.`);
  return lines.join("\n");
}

export type AiResult = { id: string; ok: boolean; reason: string };

async function callModel(prompt: string): Promise<{ ok: boolean; text: string; status?: number; reason?: string }> {
  const token = process.env.GITHUB_TOKEN ?? process.env.AI_TOKEN;
  if (!token) return { ok: false, text: "", reason: "missing GITHUB_TOKEN" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
        "x-github-api-version": "2024-08-01",
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.4,
        max_tokens: 320,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, text: "", status: res.status, reason: body.slice(0, 200) || res.statusText };
    }
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = json.choices?.[0]?.message?.content?.trim() ?? "";
    if (!text) return { ok: false, text: "", reason: "empty completion" };
    return { ok: true, text };
  } catch (err) {
    return { ok: false, text: "", reason: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timer);
  }
}

async function loadSnapshot(id: string): Promise<Snapshot | null> {
  const path = join(SNAPSHOT_DIR, `${id}.json`);
  if (!existsSync(path)) return null;
  const raw = await readFile(path, "utf-8");
  return JSON.parse(raw) as Snapshot;
}

async function analysisExists(id: string): Promise<boolean> {
  const path = join(SNAPSHOT_DIR, `${id}.analysis.md`);
  try {
    const s = await stat(path);
    return s.size > 0;
  } catch {
    return false;
  }
}

async function processOne(id: string): Promise<AiResult> {
  if (await analysisExists(id)) return { id, ok: true, reason: "already-have" };
  const snap = await loadSnapshot(id);
  if (!snap) return { id, ok: false, reason: "no-snapshot" };
  const heuristic = await loadAnalysis(id);
  const prompt = buildUserPrompt(snap, heuristic);
  const out = await callModel(prompt);
  if (!out.ok) return { id, ok: false, reason: out.reason ?? "model-error" };
  const path = join(SNAPSHOT_DIR, `${id}.analysis.md`);
  await writeFile(path, out.text.trim() + "\n");
  return { id, ok: true, reason: "written" };
}

async function runBatched<T>(ids: string[], worker: (id: string) => Promise<T>, concurrency: number): Promise<T[]> {
  const out: T[] = [];
  let i = 0;
  async function pump() {
    while (i < ids.length) {
      const idx = i++;
      out[idx] = await worker(ids[idx]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, ids.length) }, pump));
  return out;
}

export async function analyzeAiForItems(items: SylndrItem[]): Promise<{ attempted: number; written: number; failures: AiResult[] }> {
  const ids = items.map((i) => i.vehicle.id).slice(0, PER_RUN_CAP);
  if (!ids.length) return { attempted: 0, written: 0, failures: [] };
  if (!process.env.GITHUB_TOKEN && !process.env.AI_TOKEN) {
    console.log(`[ai] no GITHUB_TOKEN — skipping AI analysis (${ids.length} item${ids.length === 1 ? "" : "s"} would have been processed)`);
    return { attempted: 0, written: 0, failures: [] };
  }
  console.log(`[ai] running ${MODEL} for ${ids.length} new vehicles (cap=${PER_RUN_CAP}, concurrency=${CONCURRENCY})`);
  const results = await runBatched(ids, processOne, CONCURRENCY);
  const written = results.filter((r) => r.ok && r.reason === "written").length;
  const failures = results.filter((r) => !r.ok);
  for (const f of failures) console.log(`[ai] FAIL ${f.id}: ${f.reason}`);
  console.log(`[ai] done — written=${written} skipped=${results.length - written - failures.length} failures=${failures.length}`);
  return { attempted: ids.length, written, failures };
}

if (import.meta.main) {
  const argIds = process.argv.slice(2);
  let ids = argIds;
  if (!ids.length) {
    const { readdir } = await import("node:fs/promises");
    const files = await readdir(SNAPSHOT_DIR);
    ids = [];
    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      if (f.endsWith(".analysis.json")) continue;
      if (f.endsWith(".bids.json")) continue;
      const id = f.replace(/\.json$/, "");
      if (await analysisExists(id)) continue;
      ids.push(id);
      if (ids.length >= PER_RUN_CAP) break;
    }
  }
  if (!ids.length) {
    console.log("[ai] nothing to do");
    process.exit(0);
  }
  const items: SylndrItem[] = [];
  for (const id of ids) {
    const snap = await loadSnapshot(id);
    if (snap) items.push(snap);
  }
  await analyzeAiForItems(items);
}
