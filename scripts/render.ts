import { readdir, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Snapshot } from "./types.ts";
import {
  retailPrice,
  wholesalePrice,
  askingPrice,
  sylndrMargin,
  auctionInfo,
} from "./types.ts";

const ROOT = new URL("..", import.meta.url).pathname;
const SNAPSHOT_DIR = join(ROOT, "snapshots");
const DOCS_DIR = join(ROOT, "docs");
const DOCS_INDEX = join(DOCS_DIR, "index.html");

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

function fmtPrice(n: number): string {
  if (!n) return "—";
  return fmt(n);
}

function fmtKm(s: string | null | undefined): string {
  if (!s) return "—";
  const n = Number(s);
  if (!Number.isFinite(n)) return s;
  return fmt(n);
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
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  return `${mo}mo ago`;
}

function fmtAbsolute(iso: string): string {
  const d = new Date(iso);
  return d.toISOString().slice(0, 16).replace("T", " ") + " UTC";
}

function listedAt(snap: Snapshot): string {
  return snap.auction?.publishedAt ?? snap.firstSeen;
}

function pickPhoto(snap: Snapshot): string | null {
  const imgs = snap.vehicle.images ?? [];
  const ext = imgs.find((i) => i.imageType === "EXTERIOR");
  return ext?.imageUrl ?? imgs[0]?.imageUrl ?? null;
}

function slug(s: string | null | undefined): string {
  if (!s) return "x";
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "x";
}

function listingUrl(snap: Snapshot): string {
  const make = slug(snap.vehicle.carMake?.name);
  const model = slug(snap.vehicle.carModel?.name);
  return `https://sylndr.com/en/car-details/used-cars/${make}/${model}/${snap.vehicle.id}`;
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
  const year = v.carYear?.name ?? "";
  const make = v.carMake?.name ?? "";
  const model = v.carModel?.name ?? "";
  const title = `${make} ${model}`.trim() || "Unknown vehicle";
  const photo = pickPhoto(snap);
  const url = listingUrl(snap);
  const beingSold = snap.auction?.status === "BEING_SOLD";
  const retail = retailPrice(snap);
  const wholesale = wholesalePrice(snap);
  const asked = askingPrice(snap);
  const margin = sylndrMargin(snap);
  const auction = auctionInfo(snap);
  const price = fmtPrice(retail);
  const km = fmtKm(v.kilometrage);
  const body = v.bodyStyle ?? "—";
  const trans = v.transmission ?? "—";
  const listedIso = listedAt(snap);
  const listedRel = fmtRelative(listedIso);
  const listedAbs = fmtAbsolute(listedIso);

  const photoTag = photo
    ? `<img src="${escapeHtml(photo)}" alt="${escapeHtml(title)}" loading="lazy" />`
    : `<div class="no-photo">no photo</div>`;

  const badge = beingSold ? `<span class="badge badge-hot">&#128293; sold</span>` : "";

  const yearN = Number(year) || 0;
  const kmN = Number(v.kilometrage) || 0;

  const winningBidAmount = auction?.winnerAmount ?? null;
  const winningDiscount =
    winningBidAmount && retail > 0
      ? Math.round((1 - winningBidAmount / retail) * 100)
      : null;

  const ladderRows: string[] = [];

  if (wholesale > 0 && margin) {
    ladderRows.push(
      `<div class="pl-row" title="Sylndr offered the seller ${fmt(wholesale)} EGP">
        <dt>Sylndr price</dt>
        <dd><span class="pl-val">${escapeHtml(fmtPriceShort(wholesale))}</span><span class="pl-tag pl-margin-${marginTier(margin.pct)}">${margin.pct.toFixed(0)}% margin</span></dd>
      </div>`,
    );
  }

  if (asked > 0 && asked !== wholesale) {
    ladderRows.push(
      `<div class="pl-row" title="What the seller originally asked for (vehicle.askingPrice from the Sylndr API)">
        <dt>Asking</dt>
        <dd>${escapeHtml(fmtPriceShort(asked))}</dd>
      </div>`,
    );
  }

  if (winningBidAmount && winningDiscount != null) {
    ladderRows.push(
      `<div class="pl-row pl-sold" title="Winning bid amount accepted by Sylndr — sale in progress">
        <dt>Auction price</dt>
        <dd><span class="pl-val">${escapeHtml(fmtPriceShort(winningBidAmount))}</span><span class="pl-tag pl-discount">${winningDiscount}% under</span></dd>
      </div>`,
    );
  }

  const priceLadder = ladderRows.length
    ? `<dl class="price-ladder">${ladderRows.join("")}</dl>`
    : "";

  const auctionStrip = auction
    ? `<div class="auction-strip">
        <span class="auction-type">${escapeHtml(fmtAuctionTypeLabel(auction.type))}</span>
        <span class="meta-dot"></span>
        <span class="auction-bids${auction.bids > 0 ? " has-bids" : ""}">${auction.bids} ${auction.bids === 1 ? "bid" : "bids"}${auction.bidders > 0 ? ` <span class="bidders">&middot; ${auction.bidders} ${auction.bidders === 1 ? "bidder" : "bidders"}</span>` : ""}</span>
      </div>`
    : "";

  const search = `${title} ${v.salesforceName ?? ""}`.toLowerCase();
  return `<article class="card${beingSold ? " card-hot" : ""}"
    data-make="${escapeHtml((make || "").toLowerCase())}"
    data-model="${escapeHtml((model || "").toLowerCase())}"
    data-year="${yearN}"
    data-km="${kmN}"
    data-price="${retail}"
    data-body="${escapeHtml((body || "").toLowerCase())}"
    data-trans="${escapeHtml((trans || "").toLowerCase())}"
    data-status="${escapeHtml(auction?.status ?? "")}"
    data-margin="${margin ? margin.pct.toFixed(1) : ""}"
    data-listed="${escapeHtml(listedIso)}"
    data-search="${escapeHtml(search)}">
  <a class="thumb" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(title)}">
    ${photoTag}
    ${beingSold ? '<span class="thumb-ribbon">&#128293;</span>' : ""}
  </a>
  <div class="body">
    <div class="row-top">
      <div class="year">${escapeHtml(year)}</div>
      ${badge}
    </div>
    <a class="title" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(title)}</a>
    <div class="price"><span class="price-num">${escapeHtml(price)}</span><span class="price-unit">EGP</span></div>
    ${priceLadder}
    <div class="meta">
      <span class="meta-item">${escapeHtml(km)} <span class="meta-unit">km</span></span>
      <span class="meta-dot"></span>
      <span class="meta-item">${escapeHtml(body)}</span>
      <span class="meta-dot"></span>
      <span class="meta-item">${escapeHtml(trans)}</span>
    </div>
    ${auctionStrip}
    <div class="stamp">
      <span title="${escapeHtml(listedAbs)}">listed ${escapeHtml(listedRel)}</span>
      ${v.salesforceName ? `<span class="ref">${escapeHtml(v.salesforceName)}</span>` : ""}
    </div>
  </div>
</article>`;
}

const PAGE_CSS = `
:root{
  color-scheme:dark light;
  --bg:#0a0a0c;
  --bg-grad-1:#0c0c10;
  --bg-grad-2:#08080a;
  --panel:#121215;
  --card:#15151a;
  --card-hover:#1a1a21;
  --border:rgba(255,255,255,.06);
  --border-strong:rgba(255,255,255,.12);
  --fg:#f4f4f6;
  --fg-soft:#c8c8cd;
  --muted:#7e7e88;
  --muted-dim:#54545c;
  --accent:#ff7a45;
  --accent-soft:rgba(255,122,69,.12);
  --hot:#ff5b6c;
  --hot-soft:rgba(255,91,108,.14);
  --gold:#f5b942;
  --thumb-bg:linear-gradient(135deg,#1a1a20 0%,#26222a 100%);
  --shadow-card:0 1px 0 rgba(255,255,255,.04), 0 8px 24px -8px rgba(0,0,0,.6);
  --shadow-card-hover:0 1px 0 rgba(255,255,255,.06), 0 16px 40px -10px rgba(0,0,0,.7);
}
@media (prefers-color-scheme: light){
  :root{
    --bg:#fafaf7;
    --bg-grad-1:#fbfaf6;
    --bg-grad-2:#f3f1ec;
    --panel:#ffffff;
    --card:#ffffff;
    --card-hover:#fffdfa;
    --border:rgba(20,18,16,.08);
    --border-strong:rgba(20,18,16,.16);
    --fg:#1a1a1d;
    --fg-soft:#3a3a40;
    --muted:#76767f;
    --muted-dim:#a5a5ad;
    --accent:#d4501c;
    --accent-soft:rgba(212,80,28,.10);
    --hot:#c83245;
    --hot-soft:rgba(200,50,69,.10);
    --gold:#a06d00;
    --thumb-bg:linear-gradient(135deg,#f4f0e9 0%,#e8e2d8 100%);
    --shadow-card:0 1px 0 rgba(0,0,0,.02), 0 8px 24px -10px rgba(0,0,0,.10);
    --shadow-card-hover:0 1px 0 rgba(0,0,0,.04), 0 18px 40px -12px rgba(0,0,0,.18);
  }
}

*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{
  font:15px/1.5 -apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI Variable","Segoe UI",Roboto,system-ui,sans-serif;
  background:radial-gradient(ellipse 100% 60% at 50% 0%, var(--bg-grad-1) 0%, var(--bg-grad-2) 60%, var(--bg) 100%);
  color:var(--fg);
  -webkit-font-smoothing:antialiased;
  -moz-osx-font-smoothing:grayscale;
  min-height:100vh;
}
a{color:inherit}
.wrap{max-width:1120px;margin:0 auto;padding:32px 24px 64px}

/* HEADER */
header.hero{margin-bottom:36px}
.brand-row{display:flex;align-items:center;justify-content:space-between;gap:24px;flex-wrap:wrap;margin-bottom:24px}
.brand{display:flex;align-items:center;gap:12px}
.brand-mark{
  width:36px;height:36px;border-radius:10px;
  background:linear-gradient(135deg,var(--accent) 0%,#ff4a1a 100%);
  display:flex;align-items:center;justify-content:center;
  color:#fff;font-weight:700;font-size:18px;
  box-shadow:0 4px 12px -4px rgba(255,122,69,.5);
}
.brand-text{display:flex;flex-direction:column;line-height:1.15}
.brand-name{font-size:18px;font-weight:700;letter-spacing:-0.01em}
.brand-tag{font-size:12px;color:var(--muted);font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.updated{
  font-size:12px;color:var(--muted);
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
  display:flex;align-items:center;gap:8px;
}
.pulse{width:7px;height:7px;border-radius:50%;background:#3ddc84;box-shadow:0 0 0 0 rgba(61,220,132,.5);animation:pulse 2s infinite}
@keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(61,220,132,.4)}50%{box-shadow:0 0 0 6px rgba(61,220,132,0)}}

/* STATS */
.stats{
  display:grid;grid-template-columns:repeat(4,1fr);gap:12px;
  margin-bottom:20px;
}
.stat{
  background:var(--panel);
  border:1px solid var(--border);
  border-radius:14px;
  padding:16px 18px;
  display:flex;flex-direction:column;gap:4px;
}
.stat-val{font-size:24px;font-weight:700;letter-spacing:-0.02em;font-variant-numeric:tabular-nums;line-height:1.1}
.stat-val.accent{color:var(--accent)}
.stat-val.hot{color:var(--hot)}
.stat-val .stat-unit{font-size:13px;color:var(--muted);font-weight:500;margin-left:4px}
.stat-label{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;font-weight:600}
@media (max-width:720px){
  .stats{grid-template-columns:repeat(2,1fr)}
  .stat-val{font-size:20px}
}

/* FILTER BAR */
.filter-bar{
  background:var(--panel);
  border:1px solid var(--border);
  border-radius:14px;
  padding:14px 16px;
  margin-bottom:24px;
  display:flex;flex-direction:column;gap:10px;
}
.fb-row{display:flex;align-items:center;flex-wrap:wrap;gap:10px}
.fb-row-top{gap:8px}
.fb-label{
  font-size:10px;color:var(--muted);
  text-transform:uppercase;letter-spacing:.08em;font-weight:700;
  min-width:48px;
}
.fb-search{
  flex:1;min-width:180px;
  background:var(--bg);
  border:1px solid var(--border);
  color:var(--fg);
  padding:8px 12px;
  border-radius:8px;
  font:14px/1.4 inherit;
  outline:none;
}
.fb-search::placeholder{color:var(--muted-dim)}
.fb-search:focus{border-color:var(--accent)}
.fb-sort{
  background:var(--bg);
  border:1px solid var(--border);
  color:var(--fg);
  padding:8px 12px;border-radius:8px;
  font:13px/1.4 inherit;outline:none;
  cursor:pointer;
}
.fb-sort:focus{border-color:var(--accent)}
.fb-reset{
  background:transparent;
  border:1px solid var(--border);
  color:var(--fg-soft);
  padding:8px 14px;border-radius:8px;
  font:12px/1.4 inherit;cursor:pointer;
  font-weight:600;letter-spacing:.02em;
}
.fb-reset:hover{border-color:var(--accent);color:var(--accent)}
.chips{display:flex;flex-wrap:wrap;gap:5px;flex:1}
.chip{cursor:pointer}
.chip input{position:absolute;opacity:0;pointer-events:none}
.chip span{
  display:inline-block;
  background:var(--bg);
  border:1px solid var(--border);
  color:var(--fg-soft);
  padding:4px 10px;border-radius:999px;
  font:12px/1.2 inherit;font-weight:500;
  transition:background .12s ease,border-color .12s ease,color .12s ease;
}
.chip:hover span{border-color:var(--border-strong)}
.chip input:checked + span{
  background:var(--accent-soft);
  border-color:var(--accent);
  color:var(--accent);
  font-weight:700;
}
.fb-ranges{flex-wrap:wrap;gap:14px}
.fb-range{
  display:flex;align-items:center;gap:6px;
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
  font-size:12px;
}
.fb-range input[type=number]{
  background:var(--bg);
  border:1px solid var(--border);
  color:var(--fg);
  width:96px;
  padding:6px 8px;border-radius:6px;
  font:12px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;
  outline:none;
  font-variant-numeric:tabular-nums;
}
.fb-range input[type=number]:focus{border-color:var(--accent)}
.fb-range input[type=number]::-webkit-outer-spin-button,
.fb-range input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
.fb-dash{color:var(--muted-dim)}
@media (max-width:640px){
  .fb-label{min-width:auto}
  .fb-search{width:100%}
  .fb-row-top{flex-direction:column;align-items:stretch}
}

/* GRID */
main.grid{
  display:grid;
  grid-template-columns:repeat(auto-fill,minmax(280px,1fr));
  gap:18px;
}

/* CARD */
.card{
  background:var(--card);
  border:1px solid var(--border);
  border-radius:16px;
  overflow:hidden;
  display:flex;flex-direction:column;
  position:relative;
  box-shadow:var(--shadow-card);
  transition:transform .15s ease, box-shadow .15s ease, border-color .15s ease, background .15s ease;
}
.card:hover{
  transform:translateY(-2px);
  border-color:var(--border-strong);
  background:var(--card-hover);
  box-shadow:var(--shadow-card-hover);
}
.card-hot{
  border-color:rgba(255,91,108,.28);
}
.card-hot:hover{border-color:rgba(255,91,108,.5)}

.thumb{
  display:block;aspect-ratio:4/3;
  background:var(--thumb-bg);
  overflow:hidden;
  position:relative;
}
.thumb img{
  width:100%;height:100%;object-fit:cover;display:block;
  transition:transform .4s ease;
}
.card:hover .thumb img{transform:scale(1.03)}
.no-photo{
  width:100%;height:100%;
  display:flex;align-items:center;justify-content:center;
  color:var(--muted-dim);font-size:12px;
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
}
.thumb-ribbon{
  position:absolute;top:10px;left:10px;
  background:var(--hot);
  color:#fff;
  font-size:14px;
  width:28px;height:28px;border-radius:8px;
  display:flex;align-items:center;justify-content:center;
  box-shadow:0 4px 12px -2px rgba(255,91,108,.5);
}

.body{padding:14px 16px 16px;display:flex;flex-direction:column;gap:6px}
.row-top{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:18px}
.year{
  font-size:11px;
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
  color:var(--muted);
  letter-spacing:.04em;
  font-weight:600;
}
.title{
  font-weight:650;color:var(--fg);text-decoration:none;
  font-size:15px;line-height:1.25;letter-spacing:-0.005em;
  margin:0;
  display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden;
}
.title:hover{color:var(--accent)}

.price{
  display:flex;align-items:baseline;gap:4px;margin-top:2px;
  font-variant-numeric:tabular-nums;
}
.price-num{
  font-size:22px;font-weight:700;
  color:var(--accent);
  letter-spacing:-0.02em;
  line-height:1;
}
.price-unit{font-size:12px;color:var(--muted);font-weight:600;letter-spacing:.04em}

.price-ladder{
  margin:6px 0 4px;
  padding:0;
  display:flex;flex-direction:column;gap:3px;
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
  font-size:11px;
  font-variant-numeric:tabular-nums;
}
.pl-row{
  display:flex;align-items:baseline;justify-content:space-between;
  gap:8px;margin:0;
}
.pl-row dt{
  color:var(--muted);
  font-weight:500;
  letter-spacing:.01em;
  text-transform:lowercase;
  font-size:10px;
}
.pl-row dd{
  margin:0;
  color:var(--fg-soft);
  display:flex;align-items:baseline;gap:6px;
}
.pl-val{color:var(--fg);font-weight:700}
.pl-tag{
  font-size:9px;
  font-weight:700;
  letter-spacing:.04em;
  text-transform:uppercase;
  padding:1px 5px;
  border-radius:4px;
  background:rgba(127,127,127,.10);
}
.pl-margin-low{color:#3ddc84;background:rgba(61,220,132,.10)}
.pl-margin-mid{color:var(--gold);background:rgba(245,185,66,.12)}
.pl-margin-high{color:var(--hot);background:var(--hot-soft)}
.pl-discount{color:#3ddc84;background:rgba(61,220,132,.12)}
.pl-sold dt{color:var(--accent);font-weight:700}
.pl-sold dd .pl-val{color:var(--accent)}

.meta{
  color:var(--fg-soft);font-size:13px;
  display:flex;flex-wrap:wrap;align-items:center;gap:8px;
  margin-top:4px;
}
.meta-item{font-variant-numeric:tabular-nums}
.meta-unit{color:var(--muted);font-size:11px}
.meta-dot{width:3px;height:3px;border-radius:50%;background:var(--muted-dim)}

.auction-strip{
  display:flex;align-items:center;gap:8px;
  font-size:11px;
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
  color:var(--muted);
  margin-top:8px;padding:6px 10px;
  background:rgba(127,127,127,.06);
  border:1px solid var(--border);
  border-radius:8px;
}
.auction-strip .auction-type{
  color:var(--fg-soft);
  letter-spacing:.04em;
  text-transform:uppercase;
  font-weight:600;
  font-size:10px;
}
.auction-strip .auction-bids.has-bids{color:var(--fg-soft);font-weight:600}
.auction-strip .bidders{color:var(--muted);font-weight:500}

.stamp{
  display:flex;align-items:center;justify-content:space-between;gap:8px;
  margin-top:6px;padding-top:8px;
  border-top:1px solid var(--border);
  color:var(--muted);font-size:11px;
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
}
.ref{color:var(--muted-dim)}

.badge{
  display:inline-flex;align-items:center;gap:3px;
  font-size:10px;font-weight:700;
  padding:3px 8px;border-radius:999px;
  letter-spacing:.04em;text-transform:uppercase;
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
}
.badge-hot{background:var(--hot-soft);color:var(--hot)}

/* FOOTER */
footer{
  margin-top:48px;padding-top:24px;
  border-top:1px solid var(--border);
  display:flex;justify-content:space-between;align-items:center;gap:16px;
  flex-wrap:wrap;
  color:var(--muted);font-size:12px;
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
}
footer a{color:var(--fg-soft);text-decoration:none;border-bottom:1px dotted var(--muted-dim)}
footer a:hover{color:var(--accent);border-color:var(--accent)}

/* EMPTY STATE */
.empty{
  text-align:center;padding:64px 24px;
  color:var(--muted);
}
.empty h2{color:var(--fg-soft);font-weight:600;margin:0 0 8px;font-size:16px}

/* SCROLLBAR */
@media (pointer:fine){
  ::-webkit-scrollbar{width:10px;height:10px}
  ::-webkit-scrollbar-track{background:transparent}
  ::-webkit-scrollbar-thumb{background:var(--border-strong);border-radius:10px}
  ::-webkit-scrollbar-thumb:hover{background:var(--muted-dim)}
}

/* ENTRY ANIMATION */
@media (prefers-reduced-motion: no-preference){
  .card{animation:fadeUp .4s ease backwards}
  .card:nth-child(1){animation-delay:.02s}
  .card:nth-child(2){animation-delay:.05s}
  .card:nth-child(3){animation-delay:.08s}
  .card:nth-child(4){animation-delay:.11s}
  .card:nth-child(5){animation-delay:.14s}
  .card:nth-child(6){animation-delay:.17s}
  .card:nth-child(7){animation-delay:.20s}
  .card:nth-child(8){animation-delay:.23s}
  .card:nth-child(n+9){animation-delay:.26s}
}
@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
`;

function uniqueSorted<T>(arr: T[]): T[] {
  return [...new Set(arr)].filter((x) => x != null && x !== "").sort() as T[];
}

type FacetData = {
  bodies: string[];
  transmissions: string[];
  statuses: string[];
  years: { min: number; max: number };
  prices: { min: number; max: number };
};



function computeFacets(snaps: Snapshot[]): FacetData {
  const bodies = uniqueSorted(snaps.map((s) => s.vehicle.bodyStyle ?? "").filter(Boolean));
  const transmissions = uniqueSorted(snaps.map((s) => s.vehicle.transmission ?? "").filter(Boolean));
  const statuses = uniqueSorted(snaps.map((s) => s.auction?.status ?? "").filter(Boolean));
  const years = snaps.map((s) => Number(s.vehicle.carYear?.name)).filter(Number.isFinite);
  const prices = snaps.map((s) => retailPrice(s)).filter((p) => p > 0);
  return {
    bodies,
    transmissions,
    statuses,
    years: {
      min: years.length ? Math.min(...years) : 2000,
      max: years.length ? Math.max(...years) : 2026,
    },
    prices: {
      min: prices.length ? Math.min(...prices) : 0,
      max: prices.length ? Math.max(...prices) : 5_000_000,
    },
  };
}

function fmtPriceShort(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

function fmtAuctionTypeLabel(t: string | null): string {
  if (!t) return "auction";
  return t.toLowerCase();
}

function marginTier(pct: number): "low" | "mid" | "high" {
  if (pct < 15) return "low";
  if (pct < 30) return "mid";
  return "high";
}

function renderStatsBar(total: number): string {
  return `<section class="stats">
  <div class="stat">
    <div class="stat-val"><span data-stat="visible">${fmt(total)}</span><span class="stat-unit">/ ${fmt(total)}</span></div>
    <div class="stat-label">Showing</div>
  </div>
  <div class="stat">
    <div class="stat-val hot" data-stat="sold">0</div>
    <div class="stat-label">In auction</div>
  </div>
  <div class="stat">
    <div class="stat-val accent" data-stat="price-range">—</div>
    <div class="stat-label">Price range</div>
  </div>
  <div class="stat">
    <div class="stat-val" data-stat="avg-margin">—</div>
    <div class="stat-label">Avg Sylndr margin</div>
  </div>
</section>`;
}

function renderFilterBar(f: FacetData): string {
  const bodyChips = f.bodies
    .map((b) => `<label class="chip"><input type="checkbox" name="body" value="${escapeHtml(b.toLowerCase())}"><span>${escapeHtml(b)}</span></label>`)
    .join("");
  const transChips = f.transmissions
    .map((t) => `<label class="chip"><input type="checkbox" name="trans" value="${escapeHtml(t.toLowerCase())}"><span>${escapeHtml(t)}</span></label>`)
    .join("");
  const statusChips = f.statuses
    .map((s) => `<label class="chip"><input type="checkbox" name="status" value="${escapeHtml(s)}"><span>${escapeHtml(s === "BEING_SOLD" ? "Sold" : s.toLowerCase())}</span></label>`)
    .join("");
  return `<form class="filter-bar" autocomplete="off" onsubmit="return false">
  <div class="fb-row fb-row-top">
    <input class="fb-search" name="q" type="search" placeholder="Search make, model, or code…" />
    <select class="fb-sort" name="sort">
      <option value="listed-desc">Newest listed</option>
      <option value="listed-asc">Oldest listed</option>
      <option value="price-asc">Cheapest first</option>
      <option value="price-desc">Most expensive first</option>
      <option value="margin-desc">Highest Sylndr margin</option>
      <option value="margin-asc">Lowest Sylndr margin</option>
      <option value="km-asc">Lowest km</option>
      <option value="year-desc">Newest year</option>
    </select>
    <button type="button" class="fb-reset" data-action="reset">Reset</button>
  </div>
  <div class="fb-row">
    <span class="fb-label">Body</span>
    <div class="chips" data-group="body">${bodyChips}</div>
  </div>
  <div class="fb-row">
    <span class="fb-label">Trans</span>
    <div class="chips" data-group="trans">${transChips}</div>
  </div>
  <div class="fb-row">
    <span class="fb-label">Status</span>
    <div class="chips" data-group="status">${statusChips}</div>
  </div>
  <div class="fb-row fb-ranges">
    <label class="fb-range">
      <span class="fb-label">Price EGP</span>
      <input type="number" name="minPrice" placeholder="${fmt(f.prices.min)}" min="0" step="50000" />
      <span class="fb-dash">–</span>
      <input type="number" name="maxPrice" placeholder="${fmt(f.prices.max)}" min="0" step="50000" />
    </label>
    <label class="fb-range">
      <span class="fb-label">Max km</span>
      <input type="number" name="maxKm" placeholder="any" min="0" step="10000" />
    </label>
    <label class="fb-range">
      <span class="fb-label">Year</span>
      <input type="number" name="minYear" placeholder="${f.years.min}" min="1990" max="2100" />
      <span class="fb-dash">–</span>
      <input type="number" name="maxYear" placeholder="${f.years.max}" min="1990" max="2100" />
    </label>
  </div>
</form>`;
}

const FILTER_JS = `
(() => {
  const form = document.querySelector('.filter-bar');
  if (!form) return;
  const grid = document.querySelector('main.grid');
  const cards = Array.from(grid.querySelectorAll('.card'));
  const visibleStat = document.querySelector('[data-stat="visible"]');
  const soldStat = document.querySelector('[data-stat="sold"]');
  const priceStat = document.querySelector('[data-stat="price-range"]');
  const marginStat = document.querySelector('[data-stat="avg-margin"]');
  const fmt = (n) => n >= 1e6 ? (n/1e6).toFixed(2)+'M' : n >= 1e3 ? Math.round(n/1e3)+'K' : String(n);

  function readParams() {
    const p = new URLSearchParams(location.hash.slice(1) || location.search.slice(1));
    for (const el of form.elements) {
      if (!el.name) continue;
      if (el.type === 'checkbox') {
        el.checked = (p.getAll(el.name) || []).includes(el.value);
      } else if (p.has(el.name)) {
        el.value = p.get(el.name);
      }
    }
  }
  function writeParams() {
    const p = new URLSearchParams();
    for (const el of form.elements) {
      if (!el.name) continue;
      if (el.type === 'checkbox') {
        if (el.checked) p.append(el.name, el.value);
      } else if (el.value) {
        p.set(el.name, el.value);
      }
    }
    const q = p.toString();
    history.replaceState(null, '', q ? '#' + q : location.pathname);
  }
  function getValues(name) {
    return Array.from(form.querySelectorAll('input[name="' + name + '"]:checked')).map((i) => i.value);
  }
  function num(name, fallback) {
    const v = form.querySelector('[name="' + name + '"]').value;
    return v === '' ? fallback : Number(v);
  }
  function sortKey(card, mode) {
    const d = card.dataset;
    switch (mode) {
      case 'listed-asc': return new Date(d.listed).getTime();
      case 'price-asc': return Number(d.price);
      case 'price-desc': return -Number(d.price);
      case 'margin-desc': return -(parseFloat(d.margin) || 0);
      case 'margin-asc': return parseFloat(d.margin) || 0;
      case 'km-asc': return Number(d.km);
      case 'year-desc': return -Number(d.year);
      default: return -new Date(d.listed).getTime();
    }
  }
  function setPriceRange(pMin, pMax) {
    while (priceStat.firstChild) priceStat.removeChild(priceStat.firstChild);
    if (pMin === Infinity) {
      priceStat.textContent = '—';
    } else {
      priceStat.appendChild(document.createTextNode(fmt(pMin)));
      const unit = document.createElement('span');
      unit.className = 'stat-unit';
      unit.textContent = '– ' + fmt(pMax);
      priceStat.appendChild(unit);
    }
  }
  function apply() {
    const body = getValues('body');
    const trans = getValues('trans');
    const status = getValues('status');
    const q = (form.q.value || '').trim().toLowerCase();
    const minP = num('minPrice', 0);
    const maxP = num('maxPrice', Infinity);
    const maxKm = num('maxKm', Infinity);
    const minY = num('minYear', 0);
    const maxY = num('maxYear', Infinity);
    const sort = form.sort.value;
    let visible = 0, sold = 0, marginSum = 0, marginN = 0, pMin = Infinity, pMax = -Infinity;
    for (const c of cards) {
      const d = c.dataset;
      const ok =
        (!body.length || body.includes(d.body)) &&
        (!trans.length || trans.includes(d.trans)) &&
        (!status.length || status.includes(d.status)) &&
        (!q || d.search.includes(q)) &&
        Number(d.price) >= minP && Number(d.price) <= maxP &&
        Number(d.km) <= maxKm &&
        Number(d.year) >= minY && Number(d.year) <= maxY;
      c.style.display = ok ? '' : 'none';
      if (ok) {
        visible++;
        if (d.status === 'BEING_SOLD') sold++;
        const m = parseFloat(d.margin);
        if (!isNaN(m)) { marginSum += m; marginN++; }
        const pp = Number(d.price);
        if (pp > 0) { if (pp < pMin) pMin = pp; if (pp > pMax) pMax = pp; }
      }
    }
    visibleStat.textContent = visible;
    soldStat.textContent = sold;
    setPriceRange(pMin, pMax);
    marginStat.textContent = marginN ? Math.round(marginSum / marginN) + '%' : '—';
    const visCards = cards.filter((c) => c.style.display !== 'none');
    visCards.sort((a, b) => sortKey(a, sort) - sortKey(b, sort));
    for (const c of visCards) grid.appendChild(c);
    writeParams();
  }
  form.addEventListener('input', apply);
  form.querySelector('[data-action="reset"]').addEventListener('click', () => {
    form.reset();
    history.replaceState(null, '', location.pathname);
    apply();
  });
  readParams();
  apply();
})();
`;

export function renderPage(snapshots: Snapshot[]): string {
  const facets = computeFacets(snapshots);
  const cards = snapshots.length
    ? snapshots.map((s) => renderCard(s)).join("\n")
    : `<div class="empty"><h2>No listings yet</h2><div>The next cron run will seed the watch list.</div></div>`;
  const now = new Date();
  const renderedUtc = `${now.toISOString().slice(0, 16).replace("T", " ")} UTC`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="dark light" />
<title>Sylndr alerts &middot; ${snapshots.length} listings</title>
<meta name="description" content="Browse and filter Sylndr (Egypt) used-car inventory." />
<style>${PAGE_CSS}</style>
</head>
<body>
<div class="wrap">
<header class="hero">
  <div class="brand-row">
    <div class="brand">
      <div class="brand-mark">S</div>
      <div class="brand-text">
        <div class="brand-name">Sylndr alerts</div>
        <div class="brand-tag">personal &middot; auto-refreshed during EST business hours</div>
      </div>
    </div>
    <div class="updated"><span class="pulse"></span>updated ${renderedUtc}</div>
  </div>
  ${renderStatsBar(snapshots.length)}
  ${renderFilterBar(facets)}
</header>
<main class="grid">
${cards}
</main>
<footer>
  <span>${snapshots.length} listings &middot; filter and sort via the bar above</span>
  <span>data <a href="https://sylndr.com" target="_blank" rel="noopener noreferrer">sylndr.com</a> &middot; source <a href="https://github.com/AhmadIbrahiim/sylndr-alert" target="_blank" rel="noopener noreferrer">github</a></span>
</footer>
</div>
<script>${FILTER_JS}</script>
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
  snaps.sort((a, b) => (listedAt(a) < listedAt(b) ? 1 : -1));
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
