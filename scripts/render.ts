import { readdir, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Snapshot } from "./types.ts";

const ROOT = new URL("..", import.meta.url).pathname;
const SNAPSHOT_DIR = join(ROOT, "snapshots");
const DOCS_DIR = join(ROOT, "docs");
const DOCS_INDEX = join(DOCS_DIR, "index.html");

function fmtPrice(n: number): string {
  if (!n) return "—";
  return new Intl.NumberFormat("en-US").format(n) + " EGP";
}

function fmtKm(s: string | null | undefined): string {
  if (!s) return "—";
  const n = Number(s);
  if (!Number.isFinite(n)) return s;
  return new Intl.NumberFormat("en-US").format(n) + " km";
}

function fmtRelative(iso: string): string {
  const t = new Date(iso).getTime();
  const dt = Date.now() - t;
  const min = Math.floor(dt / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

function pickPhoto(snap: Snapshot): string | null {
  const imgs = snap.vehicle.images ?? [];
  const ext = imgs.find((i) => i.imageType === "EXTERIOR");
  return ext?.imageUrl ?? imgs[0]?.imageUrl ?? null;
}

function listingUrl(snap: Snapshot): string {
  return `https://sylndr.com/en/buy-cars/${snap.vehicle.id}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderCard(snap: Snapshot, opts: { compact?: boolean } = {}): string {
  const v = snap.vehicle;
  const title = `${v.carYear?.name ?? ""} ${v.carMake?.name ?? ""} ${v.carModel?.name ?? ""}`.trim() || "Unknown vehicle";
  const photo = pickPhoto(snap);
  const url = listingUrl(snap);
  const beingSold = snap.auction?.status === "BEING_SOLD";
  const price = fmtPrice(v.netSylndrOfferPrice);
  const km = fmtKm(v.kilometrage);
  const body = v.bodyStyle ?? "—";
  const trans = v.transmission ?? "—";
  const seenStamp = fmtRelative(snap.firstSeen);

  const photoTag = photo
    ? `<img src="${escapeHtml(photo)}" alt="${escapeHtml(title)}" />`
    : `<div class="no-photo">no photo</div>`;

  const badge = beingSold ? `<span class="badge">&#128293; BEING_SOLD</span>` : "";
  const wrapperStyle = opts.compact ? "" : "";

  return `
<article class="card">
  <a class="thumb" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${photoTag}</a>
  <div class="body">
    <a class="title" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(title)}</a>
    <div class="price">${escapeHtml(price)} ${badge}</div>
    <div class="meta">
      <span>${escapeHtml(km)}</span>
      <span>&middot;</span>
      <span>${escapeHtml(body)}</span>
      <span>&middot;</span>
      <span>${escapeHtml(trans)}</span>
    </div>
    <div class="stamp">first seen ${escapeHtml(seenStamp)}${v.salesforceName ? ` &middot; ${escapeHtml(v.salesforceName)}` : ""}</div>
  </div>
</article>`;
}

const PAGE_CSS = `
:root{color-scheme:light dark;--bg:#0f0f10;--fg:#f5f5f5;--muted:#a0a0a8;--card:#1a1a1d;--accent:#ffb454;--border:#2a2a2e}
@media (prefers-color-scheme: light){:root{--bg:#fafafa;--fg:#111;--muted:#666;--card:#fff;--accent:#c95a00;--border:#e6e6e6}}
*{box-sizing:border-box}
body{margin:0;padding:24px;font:15px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:var(--bg);color:var(--fg)}
header{max-width:960px;margin:0 auto 24px;display:flex;justify-content:space-between;align-items:baseline;gap:16px;flex-wrap:wrap}
h1{margin:0;font-size:22px;letter-spacing:-0.01em}
header .sub{color:var(--muted);font-size:13px}
main{max-width:960px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px}
.card{background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:hidden;display:flex;flex-direction:column}
.thumb{display:block;aspect-ratio:4/3;background:#000;overflow:hidden}
.thumb img{width:100%;height:100%;object-fit:cover;display:block}
.no-photo{width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:12px}
.body{padding:12px 14px;display:flex;flex-direction:column;gap:6px}
.title{font-weight:600;color:var(--fg);text-decoration:none;font-size:15px;line-height:1.25}
.title:hover{text-decoration:underline}
.price{font-size:18px;font-weight:700;color:var(--accent);display:flex;align-items:center;gap:8px}
.badge{font-size:11px;background:rgba(255,68,68,.15);color:#ff6b6b;padding:2px 7px;border-radius:999px;font-weight:600;letter-spacing:.02em}
.meta{color:var(--muted);font-size:13px;display:flex;gap:6px;flex-wrap:wrap}
.stamp{color:var(--muted);font-size:11px;margin-top:4px}
footer{max-width:960px;margin:32px auto 8px;color:var(--muted);font-size:12px;text-align:center}
`;

export function renderPage(snapshots: Snapshot[]): string {
  const cards = snapshots.map((s) => renderCard(s)).join("\n");
  const now = new Date().toISOString();
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Sylndr alerts &middot; ${snapshots.length} listings</title>
<style>${PAGE_CSS}</style>
</head>
<body>
<header>
  <div>
    <h1>Sylndr alerts</h1>
    <div class="sub">${snapshots.length} listings tracked &middot; rendered ${now.replace("T", " ").slice(0, 16)} UTC</div>
  </div>
  <div class="sub"><a href="https://github.com/" style="color:inherit;text-decoration:none">source</a></div>
</header>
<main>
${cards}
</main>
<footer>auto-generated by sylndr-alert &middot; data &copy; sylndr.com</footer>
</body>
</html>
`;
}

export async function loadAllSnapshots(): Promise<Snapshot[]> {
  let files: string[];
  try {
    files = await readdir(SNAPSHOT_DIR);
  } catch {
    return [];
  }
  const snaps: Snapshot[] = [];
  for (const f of files) {
    if (!f.endsWith(".json")) continue;
    const raw = await Bun.file(join(SNAPSHOT_DIR, f)).text();
    snaps.push(JSON.parse(raw) as Snapshot);
  }
  snaps.sort((a, b) => (a.firstSeen < b.firstSeen ? 1 : -1));
  return snaps;
}

export async function writeDocsIndex(): Promise<number> {
  const snaps = await loadAllSnapshots();
  const html = renderPage(snaps);
  await mkdir(DOCS_DIR, { recursive: true });
  await writeFile(DOCS_INDEX, html);
  return snaps.length;
}

if (import.meta.main) {
  const n = await writeDocsIndex();
  console.log(`rendered docs/index.html with ${n} snapshots`);
}
