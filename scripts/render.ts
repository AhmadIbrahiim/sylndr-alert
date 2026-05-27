import { readdir, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Snapshot } from "./types.ts";
import {
  retailPrice,
  marketPrice,
  askingPrice,
  marketPremium,
  auctionInfo,
  sylndrListingUrl,
} from "./types.ts";
import {
  fmt,
  fmtPrice,
  fmtPriceShort,
  fmtKm,
  fmtAbsolute,
  escapeHtml,
  listedAt,
  pickPhoto,
  marginTier,
  fmtAuctionTypeLabel,
  vehicleTitle,
  computeInspectionStats,
} from "./shared.ts";
import { SHARED_CSS } from "./styles.ts";
import { renderVehiclePage } from "./render-vehicle.ts";
import { loadAnalysis, analyzeSnapshot } from "./analyze.ts";
import type { Analysis } from "./analyze.ts";
import { loadBidHistory, bidTrend, type BidHistory } from "./bid-history.ts";
import { renderBidCardChip } from "./render-bids.ts";
import {
  t,
  tRelative,
  tPlural,
  dir,
  altLocaleHref,
  altLocaleLabel,
  assetUrlFromIndex,
  detailUrl,
  LOCALES,
  type Locale,
} from "./i18n.ts";

const ROOT = new URL("..", import.meta.url).pathname;
const SNAPSHOT_DIR = join(ROOT, "snapshots");
const DOCS_DIR = join(ROOT, "docs");
const DOCS_ASSETS_DIR = join(DOCS_DIR, "assets");
const DOCS_STYLE = join(DOCS_ASSETS_DIR, "style.css");
const POLL_WORKFLOW_URL = "https://github.com/AhmadIbrahiim/sylndr-alert/actions/workflows/poll.yml";

function docsDirFor(locale: Locale): string {
  return locale === "en" ? DOCS_DIR : join(DOCS_DIR, "ar");
}

function vehicleDirFor(locale: Locale): string {
  return join(docsDirFor(locale), "v");
}

type FacetData = {
  bodies: string[];
  transmissions: string[];
  statuses: string[];
  years: { min: number; max: number };
  prices: { min: number; max: number };
};

function uniqueSorted<T>(arr: T[]): T[] {
  return [...new Set(arr)].filter((x) => x != null && x !== "").sort() as T[];
}

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

function localizedTitle(snap: Snapshot, locale: Locale): string {
  if (locale === "ar") {
    const m = snap.vehicle.carMake?.arName || snap.vehicle.carMake?.name || "";
    const mo = snap.vehicle.carModel?.arName || snap.vehicle.carModel?.name || "";
    const out = `${m} ${mo}`.trim();
    return out || vehicleTitle(snap);
  }
  return vehicleTitle(snap);
}

function localizedStatus(locale: Locale, status: string): string {
  if (status === "BEING_SOLD") return t(locale, "filter.status.beingSold");
  if (status === "SOLD") return t(locale, "filter.status.sold");
  if (status === "PUBLISHED") return t(locale, "filter.status.published");
  return status.toLowerCase();
}

export function renderCard(
  snap: Snapshot,
  analysis: Analysis | null,
  bidHistory: BidHistory | null,
  locale: Locale,
): string {
  const v = snap.vehicle;
  const year = v.carYear?.name ?? "";
  const make = v.carMake?.name ?? "";
  const model = v.carModel?.name ?? "";
  const title = localizedTitle(snap, locale);
  const photo = pickPhoto(snap);
  const sylndrUrl = sylndrListingUrl(snap);
  const dUrl = detailUrl(locale, v.id);
  const beingSold = snap.auction?.status === "BEING_SOLD";
  const retail = retailPrice(snap);
  const market = marketPrice(snap);
  const asked = askingPrice(snap);
  const margin = marketPremium(snap);
  const auction = auctionInfo(snap);
  const price = fmtPrice(retail);
  const km = fmtKm(v.kilometrage);
  const body = v.bodyStyle ?? "—";
  const trans = v.transmission ?? "—";
  const listedIso = listedAt(snap);
  const listedRel = tRelative(locale, listedIso);
  const listedAbs = fmtAbsolute(listedIso);

  const photoTag = photo
    ? `<img src="${escapeHtml(photo)}" alt="${escapeHtml(title)}" loading="lazy" />`
    : `<div class="no-photo">${escapeHtml(t(locale, "card.noPhoto"))}</div>`;

  const dealTag =
    analysis?.dealTag === "good"
      ? `<span class="deal-tag good">${escapeHtml(t(locale, "card.badge.lookFair"))}</span>`
      : analysis?.dealTag === "high"
        ? `<span class="deal-tag high">${escapeHtml(t(locale, "card.badge.trendsPricey"))}</span>`
        : "";

  const badge = beingSold
    ? `<span class="badge badge-hot">${t(locale, "card.badge.sold")}</span>`
    : dealTag || "";

  const yearN = Number(year) || 0;
  const kmN = Number(v.kilometrage) || 0;

  const winningBidAmount = auction?.winnerAmount ?? null;
  const winningDiscount =
    winningBidAmount && retail > 0 ? Math.round((1 - winningBidAmount / retail) * 100) : null;

  const ladderRows: string[] = [];

  if (market > 0 && margin) {
    ladderRows.push(
      `<div class="pl-row" title="${escapeHtml(t(locale, "card.priceLadder.market.tooltip", { amount: fmt(market) }))}">
        <dt>${escapeHtml(t(locale, "card.priceLadder.market"))}</dt>
        <dd><span class="pl-val">${escapeHtml(fmtPriceShort(market))}</span><span class="pl-tag pl-margin-${marginTier(margin.pct)}">${escapeHtml(t(locale, "card.priceLadder.premium", { pct: margin.pct.toFixed(0) }))}</span></dd>
      </div>`,
    );
  }

  if (asked > 0 && asked !== market) {
    ladderRows.push(
      `<div class="pl-row" title="${escapeHtml(t(locale, "card.priceLadder.asking.tooltip"))}">
        <dt>${escapeHtml(t(locale, "card.priceLadder.asking"))}</dt>
        <dd>${escapeHtml(fmtPriceShort(asked))}</dd>
      </div>`,
    );
  }

  if (winningBidAmount && winningDiscount != null) {
    ladderRows.push(
      `<div class="pl-row pl-sold" title="${escapeHtml(t(locale, "card.priceLadder.auction.tooltip"))}">
        <dt>${escapeHtml(t(locale, "card.priceLadder.auction"))}</dt>
        <dd><span class="pl-val">${escapeHtml(fmtPriceShort(winningBidAmount))}</span><span class="pl-tag pl-discount">${escapeHtml(t(locale, "card.priceLadder.under", { pct: winningDiscount }))}</span></dd>
      </div>`,
    );
  }

  const priceLadder = ladderRows.length
    ? `<dl class="price-ladder">${ladderRows.join("")}</dl>`
    : "";

  const bidsText = tPlural(locale, "card.bid.one", "card.bid.many", auction?.bids ?? 0);
  const biddersFragment =
    auction && auction.bidders > 0
      ? ` <span class="bidders">&middot; ${escapeHtml(tPlural(locale, "card.bidder.one", "card.bidder.many", auction.bidders))}</span>`
      : "";

  const auctionStrip = auction
    ? `<div class="auction-strip">
        <span class="auction-type">${escapeHtml(fmtAuctionTypeLabel(auction.type))}</span>
        <span class="meta-dot"></span>
        <span class="auction-bids${auction.bids > 0 ? " has-bids" : ""}">${escapeHtml(bidsText)}${biddersFragment}</span>
      </div>`
    : "";

  const bidChip = renderBidCardChip(bidTrend(bidHistory), locale);

  const ownerName = snap.vehicleOwner?.name?.trim() ?? "";
  const search = `${title} ${vehicleTitle(snap)} ${v.salesforceName ?? ""} ${ownerName}`.toLowerCase();

  const inspection = computeInspectionStats(snap);
  const condition = inspection ? inspection.severity : "none";
  const flagged = inspection ? inspection.faulty : -1;
  const inspectionStrip = inspection
    ? `<div class="ins-chip ins-chip-${condition}" title="${escapeHtml(t(locale, "inspection.chip.tooltip", { ok: inspection.ok, total: inspection.total - inspection.neutral }))}">
        <span class="ins-chip-icon" aria-hidden="true">⚙</span>
        <span class="ins-chip-count">${inspection.faulty}</span>
        <span class="ins-chip-label">${escapeHtml(t(locale, "inspection.chip.flagged"))}</span>
      </div>`
    : "";

  const cardClasses =
    "card" +
    (beingSold ? " card-hot" : "") +
    (!beingSold && analysis?.dealTag === "good" ? " card-good" : "");

  return `<article class="${cardClasses}"
    data-make="${escapeHtml((make || "").toLowerCase())}"
    data-model="${escapeHtml((model || "").toLowerCase())}"
    data-year="${yearN}"
    data-km="${kmN}"
    data-price="${retail}"
    data-body="${escapeHtml((body || "").toLowerCase())}"
    data-trans="${escapeHtml((trans || "").toLowerCase())}"
    data-status="${escapeHtml(auction?.status ?? "")}"
    data-margin="${margin ? margin.pct.toFixed(1) : ""}"
    data-deal="${analysis?.dealTag ?? ""}"
    data-condition="${condition}"
    data-flagged="${flagged}"
    data-listed="${escapeHtml(listedIso)}"
    data-search="${escapeHtml(search)}">
  <a class="thumb" href="${escapeHtml(sylndrUrl)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(t(locale, "card.sylndr.aria", { title }))}">
    ${photoTag}
    ${beingSold ? '<span class="thumb-ribbon">&#128293;</span>' : ""}
    <span class="thumb-link">${escapeHtml(t(locale, "card.sylndrLink"))}</span>
  </a>
  <div class="body">
    <div class="row-top">
      <div class="year">${escapeHtml(year)}</div>
      ${badge}
    </div>
    <a class="title" href="${escapeHtml(dUrl)}">${escapeHtml(title)}</a>
    <div class="price"><span class="price-num">${escapeHtml(price)}</span><span class="price-unit">${escapeHtml(t(locale, "card.egp"))}</span></div>
    ${priceLadder}
    <div class="meta">
      <span class="meta-item">${escapeHtml(km)} <span class="meta-unit">${escapeHtml(t(locale, "card.km"))}</span></span>
      <span class="meta-dot"></span>
      <span class="meta-item">${escapeHtml(body)}</span>
      <span class="meta-dot"></span>
      <span class="meta-item">${escapeHtml(trans)}</span>
    </div>
    ${auctionStrip}
    ${bidChip}
    ${inspectionStrip}
    <div class="stamp">
      <span title="${escapeHtml(listedAbs)}">${escapeHtml(t(locale, "card.listed", { when: listedRel }))}</span>
      ${v.salesforceName ? `<span class="ref">${escapeHtml(v.salesforceName)}</span>` : ""}
    </div>
    ${ownerName ? `<div class="owner" title="${escapeHtml(t(locale, "card.owner"))}"><span class="owner-key">${escapeHtml(t(locale, "card.owner"))}</span><span class="owner-name" dir="auto">${escapeHtml(ownerName)}</span></div>` : ""}
  </div>
</article>`;
}

function renderStatsBar(total: number, locale: Locale): string {
  return `<section class="stats">
  <div class="stat">
    <div class="stat-val"><span data-stat="visible">${fmt(total)}</span><span class="stat-unit">/ ${fmt(total)}</span></div>
    <div class="stat-label">${escapeHtml(t(locale, "stat.showing"))}</div>
  </div>
  <div class="stat">
    <div class="stat-val hot" data-stat="sold">0</div>
    <div class="stat-label">${escapeHtml(t(locale, "stat.inAuction"))}</div>
  </div>
  <div class="stat">
    <div class="stat-val accent" data-stat="price-range">—</div>
    <div class="stat-label">${escapeHtml(t(locale, "stat.priceRange"))}</div>
  </div>
  <div class="stat">
    <div class="stat-val good" data-stat="avg-margin">—</div>
    <div class="stat-label">${escapeHtml(t(locale, "stat.avgMargin"))}</div>
  </div>
</section>`;
}

function renderFeaturedCard(
  snap: Snapshot,
  tag: { labelKey: Parameters<typeof t>[1]; tone: "hot" | "good" | "default" },
  locale: Locale,
): string {
  const photo = pickPhoto(snap);
  const title = localizedTitle(snap, locale);
  const year = snap.vehicle.carYear?.name ?? "";
  const km = fmtKm(snap.vehicle.kilometrage);
  const retail = retailPrice(snap);
  const url = detailUrl(locale, snap.vehicle.id);
  const photoTag = photo
    ? `<img src="${escapeHtml(photo)}" alt="${escapeHtml(title)}" loading="lazy" />`
    : `<div class="no-photo">${escapeHtml(t(locale, "card.noPhoto"))}</div>`;
  const cls = tag.tone === "hot" ? "fc-tag-hot" : tag.tone === "good" ? "fc-tag-good" : "";
  return `<a class="featured-card" href="${escapeHtml(url)}">
    <div class="fc-thumb">${photoTag}</div>
    <span class="fc-tag ${cls}">${escapeHtml(t(locale, tag.labelKey))}</span>
    <div class="fc-title">${escapeHtml(`${year} ${title}`.trim())}</div>
    <div class="fc-meta">
      <span>${escapeHtml(km)} ${escapeHtml(t(locale, "card.km"))}</span>
      <span class="fc-price">${escapeHtml(fmtPriceShort(retail))} ${escapeHtml(t(locale, "card.egp"))}</span>
    </div>
  </a>`;
}

function renderFeaturedRow(
  snapshots: Snapshot[],
  analyses: Map<string, Analysis | null>,
  locale: Locale,
): string {
  if (snapshots.length === 0) return "";

  const live = snapshots.filter((s) => s.auction?.status === "BEING_SOLD");
  const recent = [...snapshots].sort((a, b) => (listedAt(a) < listedAt(b) ? 1 : -1)).slice(0, 12);
  const goodDeals = snapshots.filter((s) => analyses.get(s.vehicle.id)?.dealTag === "good");
  const highMargin = snapshots
    .map((s) => ({ s, m: marketPremium(s) }))
    .filter((x) => x.m && x.m.pct >= 30)
    .sort((a, b) => (b.m!.pct - a.m!.pct))
    .slice(0, 8)
    .map((x) => x.s);

  type Pick = { snap: Snapshot; tag: { labelKey: Parameters<typeof t>[1]; tone: "hot" | "good" | "default" } };
  const seen = new Set<string>();
  const picks: Pick[] = [];

  for (const s of live.slice(0, 4)) {
    if (seen.has(s.vehicle.id)) continue;
    seen.add(s.vehicle.id);
    picks.push({ snap: s, tag: { labelKey: "featured.tag.inAuction", tone: "hot" } });
  }
  for (const s of goodDeals.slice(0, 6)) {
    if (seen.has(s.vehicle.id)) continue;
    seen.add(s.vehicle.id);
    picks.push({ snap: s, tag: { labelKey: "featured.tag.fair", tone: "good" } });
  }
  for (const s of recent.slice(0, 6)) {
    if (seen.has(s.vehicle.id)) continue;
    seen.add(s.vehicle.id);
    picks.push({ snap: s, tag: { labelKey: "featured.tag.fresh", tone: "default" } });
  }
  for (const s of highMargin) {
    if (seen.has(s.vehicle.id)) continue;
    if (picks.length >= 12) break;
    seen.add(s.vehicle.id);
    picks.push({ snap: s, tag: { labelKey: "featured.tag.highMargin", tone: "default" } });
  }

  if (!picks.length) return "";

  const cards = picks.map((p) => renderFeaturedCard(p.snap, p.tag, locale)).join("");

  return `<section class="featured">
    <div class="featured-head">
      <div class="featured-title"><span class="featured-pip"></span>${escapeHtml(t(locale, "featured.title"))}</div>
      <div class="featured-sub">${escapeHtml(t(locale, "featured.sub", { n: picks.length, total: snapshots.length }))}</div>
    </div>
    <div class="featured-strip">${cards}</div>
  </section>`;
}

function renderFilterBar(f: FacetData, locale: Locale): string {
  const bodyChips = f.bodies
    .map((b) => `<label class="chip"><input type="checkbox" name="body" value="${escapeHtml(b.toLowerCase())}"><span>${escapeHtml(b)}</span></label>`)
    .join("");
  const transChips = f.transmissions
    .map((tx) => `<label class="chip"><input type="checkbox" name="trans" value="${escapeHtml(tx.toLowerCase())}"><span>${escapeHtml(tx)}</span></label>`)
    .join("");
  const statusChips = f.statuses
    .map(
      (s) => `<label class="chip"><input type="checkbox" name="status" value="${escapeHtml(s)}"><span>${escapeHtml(localizedStatus(locale, s))}</span></label>`,
    )
    .join("");
  const dealChips = (["good", "fair", "high"] as const)
    .map(
      (d) => `<label class="chip"><input type="checkbox" name="deal" value="${d}"><span>${escapeHtml(t(locale, `filter.deal.${d}` as Parameters<typeof t>[1]))}</span></label>`,
    )
    .join("");
  const conditionChips = (["clean", "minor", "many", "none"] as const)
    .map(
      (c) => `<label class="chip"><input type="checkbox" name="condition" value="${c}"><span>${escapeHtml(t(locale, `filter.condition.${c}` as Parameters<typeof t>[1]))}</span></label>`,
    )
    .join("");
  return `<form class="filter-bar" autocomplete="off" onsubmit="return false">
  <div class="fb-row fb-row-top">
    <input class="fb-search" name="q" type="search" placeholder="${escapeHtml(t(locale, "filter.search"))}" />
    <select class="fb-sort" name="sort">
      <option value="listed-desc">${escapeHtml(t(locale, "filter.sort.listedDesc"))}</option>
      <option value="listed-asc">${escapeHtml(t(locale, "filter.sort.listedAsc"))}</option>
      <option value="price-asc">${escapeHtml(t(locale, "filter.sort.priceAsc"))}</option>
      <option value="price-desc">${escapeHtml(t(locale, "filter.sort.priceDesc"))}</option>
      <option value="margin-desc">${escapeHtml(t(locale, "filter.sort.marginDesc"))}</option>
      <option value="margin-asc">${escapeHtml(t(locale, "filter.sort.marginAsc"))}</option>
      <option value="km-asc">${escapeHtml(t(locale, "filter.sort.kmAsc"))}</option>
      <option value="year-desc">${escapeHtml(t(locale, "filter.sort.yearDesc"))}</option>
    </select>
    <button type="button" class="fb-reset" data-action="reset">${escapeHtml(t(locale, "filter.reset"))}</button>
  </div>
  <div class="fb-row">
    <span class="fb-label">${escapeHtml(t(locale, "filter.label.body"))}</span>
    <div class="chips" data-group="body">${bodyChips}</div>
  </div>
  <div class="fb-row">
    <span class="fb-label">${escapeHtml(t(locale, "filter.label.trans"))}</span>
    <div class="chips" data-group="trans">${transChips}</div>
  </div>
  <div class="fb-row">
    <span class="fb-label">${escapeHtml(t(locale, "filter.label.status"))}</span>
    <div class="chips" data-group="status">${statusChips}</div>
  </div>
  <div class="fb-row">
    <span class="fb-label">${escapeHtml(t(locale, "filter.label.deal"))}</span>
    <div class="chips" data-group="deal">${dealChips}</div>
  </div>
  <div class="fb-row">
    <span class="fb-label">${escapeHtml(t(locale, "filter.label.condition"))}</span>
    <div class="chips" data-group="condition">${conditionChips}</div>
  </div>
  <div class="fb-row fb-ranges">
    <label class="fb-range">
      <span class="fb-label">${escapeHtml(t(locale, "filter.label.price"))}</span>
      <input type="number" name="minPrice" placeholder="${fmt(f.prices.min)}" min="0" step="50000" />
      <span class="fb-dash">–</span>
      <input type="number" name="maxPrice" placeholder="${fmt(f.prices.max)}" min="0" step="50000" />
    </label>
    <label class="fb-range">
      <span class="fb-label">${escapeHtml(t(locale, "filter.label.maxKm"))}</span>
      <input type="number" name="maxKm" placeholder="${escapeHtml(t(locale, "filter.placeholder.any"))}" min="0" step="10000" />
    </label>
    <label class="fb-range">
      <span class="fb-label">${escapeHtml(t(locale, "filter.label.maxFlagged"))}</span>
      <input type="number" name="maxFlagged" placeholder="${escapeHtml(t(locale, "filter.placeholder.any"))}" min="0" step="1" />
    </label>
    <label class="fb-range">
      <span class="fb-label">${escapeHtml(t(locale, "filter.label.year"))}</span>
      <input type="number" name="minYear" placeholder="${f.years.min}" min="1990" max="2100" />
      <span class="fb-dash">–</span>
      <input type="number" name="maxYear" placeholder="${f.years.max}" min="1990" max="2100" />
    </label>
  </div>
</form>`;
}

function filterJs(locale: Locale): string {
  const labels = {
    justNow: t(locale, "header.updated.justNow"),
    min: t(locale, "header.updated.ago.minute", { n: "{n}" }),
    mins: t(locale, "header.updated.ago.minutes", { n: "{n}" }),
    hour: t(locale, "header.updated.ago.hour", { n: "{n}" }),
    hours: t(locale, "header.updated.ago.hours", { n: "{n}" }),
    day: t(locale, "header.updated.ago.day", { n: "{n}" }),
    days: t(locale, "header.updated.ago.days", { n: "{n}" }),
  };
  return `
window.__I18N__ = ${JSON.stringify(labels)};
(() => {
  const PAGE_SIZE = 30;
  const form = document.querySelector('.filter-bar');
  if (!form) return;
  const grid = document.querySelector('main.grid');
  const cards = Array.from(grid.querySelectorAll('.card'));
  const visibleStat = document.querySelector('[data-stat="visible"]');
  const soldStat = document.querySelector('[data-stat="sold"]');
  const priceStat = document.querySelector('[data-stat="price-range"]');
  const marginStat = document.querySelector('[data-stat="avg-margin"]');
  const labels = window.__I18N__ || {};
  const fmt = (n) => n >= 1e6 ? (n/1e6).toFixed(2)+'M' : n >= 1e3 ? Math.round(n/1e3)+'K' : String(n);
  const updatedRoot = document.querySelector('.updated[data-rendered-at]');
  const updatedText = updatedRoot ? updatedRoot.querySelector('[data-updated-text]') : null;

  let filteredCards = [];
  let renderedCount = 0;
  let loading = false;

  function pick(tplOne, tplMany, n) {
    return (n === 1 ? (tplOne || tplMany) : tplMany).replace('{n}', n);
  }

  function fmtUpdatedAgo(iso) {
    const ts = new Date(iso).getTime();
    if (!Number.isFinite(ts)) return labels.justNow || 'just now';
    const dt = Date.now() - ts;
    if (dt < 60000) return labels.justNow || 'just now';
    const m = Math.floor(dt / 60000);
    if (m < 60) return pick(labels.min, labels.mins, m);
    const h = Math.floor(m / 60);
    if (h < 24) return pick(labels.hour, labels.hours, h);
    const d = Math.floor(h / 24);
    return pick(labels.day, labels.days, d);
  }

  function refreshUpdatedLabel() {
    if (!updatedRoot || !updatedText) return;
    const iso = updatedRoot.getAttribute('data-rendered-at');
    if (!iso) return;
    updatedText.textContent = '(' + fmtUpdatedAgo(iso) + ')';
  }

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

  function showBatch() {
    const end = Math.min(renderedCount + PAGE_SIZE, filteredCards.length);
    for (let i = renderedCount; i < end; i++) {
      filteredCards[i].style.display = '';
      grid.appendChild(filteredCards[i]);
    }
    renderedCount = end;
    updateLoadMoreVisibility();
  }

  function updateLoadMoreVisibility() {
    const sentinel = document.getElementById('load-more-sentinel');
    if (!sentinel) return;
    sentinel.style.display = renderedCount < filteredCards.length ? '' : 'none';
  }

  function apply() {
    const body = getValues('body');
    const trans = getValues('trans');
    const status = getValues('status');
    const deal = getValues('deal');
    const condition = getValues('condition');
    const q = (form.q.value || '').trim().toLowerCase();
    const minP = num('minPrice', 0);
    const maxP = num('maxPrice', Infinity);
    const maxKm = num('maxKm', Infinity);
    const maxFlagged = num('maxFlagged', Infinity);
    const minY = num('minYear', 0);
    const maxY = num('maxYear', Infinity);
    const sort = form.sort.value;
    let visible = 0, sold = 0, marginSum = 0, marginN = 0, pMin = Infinity, pMax = -Infinity;
    filteredCards = [];
    for (const c of cards) {
      const d = c.dataset;
      const flaggedN = Number(d.flagged);
      const flaggedHas = flaggedN >= 0;
      const ok =
        (!body.length || body.includes(d.body)) &&
        (!trans.length || trans.includes(d.trans)) &&
        (!status.length || status.includes(d.status)) &&
        (!deal.length || deal.includes(d.deal)) &&
        (!condition.length || condition.includes(d.condition)) &&
        (!q || d.search.includes(q)) &&
        Number(d.price) >= minP && Number(d.price) <= maxP &&
        Number(d.km) <= maxKm &&
        (maxFlagged === Infinity || (flaggedHas && flaggedN <= maxFlagged)) &&
        Number(d.year) >= minY && Number(d.year) <= maxY;
      c.style.display = 'none';
      if (ok) {
        visible++;
        filteredCards.push(c);
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
    filteredCards.sort((a, b) => sortKey(a, sort) - sortKey(b, sort));
    for (const c of filteredCards) grid.appendChild(c);
    renderedCount = 0;
    showBatch();
    writeParams();
  }

  // Infinite scroll using IntersectionObserver
  const sentinel = document.createElement('div');
  sentinel.id = 'load-more-sentinel';
  sentinel.style.height = '1px';
  sentinel.style.width = '100%';
  grid.parentNode.insertBefore(sentinel, grid.nextSibling);

  const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && !loading && renderedCount < filteredCards.length) {
      loading = true;
      showBatch();
      loading = false;
    }
  }, { rootMargin: '200px' });
  observer.observe(sentinel);

  form.addEventListener('input', apply);
  form.querySelector('[data-action="reset"]').addEventListener('click', () => {
    form.reset();
    history.replaceState(null, '', location.pathname);
    apply();
  });
  refreshUpdatedLabel();
  setInterval(refreshUpdatedLabel, 30000);
  readParams();
  apply();
})();
`;
}

export function renderPage(
  snapshots: Snapshot[],
  analyses: Map<string, Analysis | null>,
  bidHistories: Map<string, BidHistory | null>,
  locale: Locale,
): string {
  const facets = computeFacets(snapshots);
  const cards = snapshots.length
    ? snapshots
        .map((s) =>
          renderCard(s, analyses.get(s.vehicle.id) ?? null, bidHistories.get(s.vehicle.id) ?? null, locale),
        )
        .join("\n")
    : `<div class="empty"><h2>${escapeHtml(t(locale, "empty.title"))}</h2><div>${escapeHtml(t(locale, "empty.sub"))}</div></div>`;
  const now = new Date();
  const renderedIso = now.toISOString();
  const cssHref = assetUrlFromIndex(locale, "style.css");

  const liveCount = snapshots.filter((s) => s.auction?.status === "BEING_SOLD").length;
  const goodCount = snapshots.filter((s) => analyses.get(s.vehicle.id)?.dealTag === "good").length;
  const altHref = altLocaleHref({ page: "index", current: locale });
  const altLabel = altLocaleLabel(locale);

  return `<!doctype html>
<html lang="${locale}" dir="${dir(locale)}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="dark light" />
<title>${escapeHtml(t(locale, "page.title.index", { n: snapshots.length }))}</title>
<meta name="description" content="${escapeHtml(t(locale, "page.description.index"))}" />
<link rel="alternate" hreflang="${locale === "en" ? "ar" : "en"}" href="${escapeHtml(altHref)}" />
<link rel="stylesheet" href="${escapeHtml(cssHref)}" />
</head>
<body>
<div class="wrap">
<header class="hero">
  <div class="brand-row">
    <a class="brand" href="./index.html">
      <div class="brand-mark">S</div>
      <div class="brand-text">
        <div class="brand-name">${escapeHtml(t(locale, "brand.name"))}</div>
        <div class="brand-tag">${escapeHtml(t(locale, "brand.tag.index"))}</div>
      </div>
    </a>
    <div class="brand-right">
      <a class="workflow-trigger" href="${POLL_WORKFLOW_URL}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(t(locale, "header.updateData.aria"))}">${escapeHtml(t(locale, "header.updateData"))}</a>
      <a class="lang-toggle" href="${escapeHtml(altHref)}" aria-label="${escapeHtml(altLabel)}">${escapeHtml(altLabel)}</a>
      <div class="updated" data-rendered-at="${renderedIso}"><span class="pulse"></span><span data-updated-text>(${escapeHtml(t(locale, "header.updated.justNow"))})</span></div>
    </div>
  </div>
  <h1 class="hero-title">${escapeHtml(t(locale, "hero.title.part1"))} <span class="accent">${escapeHtml(t(locale, "hero.title.accent"))}</span>.</h1>
  <p class="hero-sub">
    ${t(locale, "hero.sub", { total: fmt(snapshots.length), live: fmt(liveCount), good: fmt(goodCount) })}
  </p>
  ${renderStatsBar(snapshots.length, locale)}
  ${renderFeaturedRow(snapshots, analyses, locale)}
  ${renderFilterBar(facets, locale)}
</header>
<main class="grid">
${cards}
</main>
<footer>
  <span>${escapeHtml(t(locale, "footer.listings", { n: snapshots.length }))}</span>
  <span>${escapeHtml(t(locale, "footer.data"))} <a href="https://sylndr.com" target="_blank" rel="noopener noreferrer">sylndr.com</a> &middot; ${escapeHtml(t(locale, "footer.source"))} <a href="https://github.com/AhmadIbrahiim/sylndr-alert" target="_blank" rel="noopener noreferrer">github</a></span>
</footer>
</div>
<script>${filterJs(locale)}</script>
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
    if (f.endsWith(".analysis.json")) continue;
    if (f.endsWith(".bids.json")) continue;
    const raw = await Bun.file(join(SNAPSHOT_DIR, f)).text();
    snaps.push(JSON.parse(raw) as Snapshot);
  }
  snaps.sort((a, b) => (listedAt(a) < listedAt(b) ? 1 : -1));
  return snaps;
}

async function loadAiMarkdown(id: string): Promise<string | null> {
  const path = join(SNAPSHOT_DIR, `${id}.analysis.md`);
  try {
    return await Bun.file(path).text();
  } catch {
    return null;
  }
}

async function loadOrComputeAnalysis(snap: Snapshot, all: Snapshot[]): Promise<Analysis | null> {
  const stored = await loadAnalysis(snap.vehicle.id);
  if (stored) return stored;
  try {
    return analyzeSnapshot(snap, all);
  } catch {
    return null;
  }
}

export async function writeAllDocs(): Promise<{ index: number; details: number; locales: number }> {
  const snaps = await loadAllSnapshots();
  await mkdir(DOCS_DIR, { recursive: true });
  await mkdir(DOCS_ASSETS_DIR, { recursive: true });
  await writeFile(DOCS_STYLE, SHARED_CSS.trim() + "\n");

  const analyses = new Map<string, Analysis | null>();
  const bidHistories = new Map<string, BidHistory | null>();
  for (const snap of snaps) {
    analyses.set(snap.vehicle.id, await loadOrComputeAnalysis(snap, snaps));
    bidHistories.set(snap.vehicle.id, await loadBidHistory(snap.vehicle.id));
  }

  let totalDetails = 0;

  for (const locale of LOCALES) {
    const localeDocsDir = docsDirFor(locale);
    const localeVehicleDir = vehicleDirFor(locale);
    await mkdir(localeDocsDir, { recursive: true });
    await mkdir(localeVehicleDir, { recursive: true });

    const indexHtml = renderPage(snaps, analyses, bidHistories, locale);
    await writeFile(join(localeDocsDir, "index.html"), indexHtml);

    for (const snap of snaps) {
      const id = snap.vehicle.id;
      const analysis = analyses.get(id) ?? null;
      const bidHistory = bidHistories.get(id) ?? null;
      const ai = await loadAiMarkdown(id);
      const html = renderVehiclePage({ snapshot: snap, analysis, aiMarkdown: ai, bidHistory, locale });
      await writeFile(join(localeVehicleDir, `${id}.html`), html);
      totalDetails++;
    }
  }

  return { index: snaps.length, details: totalDetails, locales: LOCALES.length };
}

/** Backwards-compat: kept so any external caller (or older poll.ts) keeps working. */
export async function writeDocsIndex(): Promise<number> {
  const { index } = await writeAllDocs();
  return index;
}

if (import.meta.main) {
  const out = await writeAllDocs();
  console.log(`rendered ${out.locales} locales × (1 index + ${out.details / out.locales} detail pages) = ${out.details + out.locales} files`);
}
