import type { BidTrend } from "./bid-history.ts";
import { fmt, sparklineSvg, escapeHtml } from "./shared.ts";
import { t, fmtBidSpan, type Locale } from "./i18n.ts";

/** One-sentence status line describing the trend's state. */
function statusLine(trend: BidTrend, locale: Locale): string {
  const span = fmtBidSpan(locale, trend.staleHours);
  switch (trend.state) {
    case "new":
      return t(locale, "bidtrend.new");
    case "cold":
      return t(locale, "bidtrend.cold", { span });
    case "active":
      return t(locale, "bidtrend.active", { span });
    case "stale":
      return t(locale, "bidtrend.stale", { span });
  }
}

/**
 * Full bid-history block for the vehicle detail page: current tally, a wide
 * sparkline of the bid count across polls, and a state-colored status line.
 * `trend` is null when no history has accrued yet (e.g. the seed poll).
 */
export function renderBidHistoryBlock(trend: BidTrend | null, locale: Locale): string {
  if (!trend) {
    return `<div class="ai-empty">${escapeHtml(t(locale, "bidhist.empty"))}</div>`;
  }
  const spark = sparklineSvg(trend.values, { w: 280, h: 52, cls: `spark spark-${trend.state}` });
  const unit = t(locale, "bidhist.unit", { n: fmt(trend.currentBidders) });
  // The window line is redundant once tracking has barely begun.
  const foot =
    trend.state === "new"
      ? ""
      : `<div class="bidhist-foot">${escapeHtml(t(locale, "bidhist.window", { span: fmtBidSpan(locale, trend.windowHours) }))}</div>`;
  return `<div class="bidhist bidhist-${trend.state}">
    <div class="bidhist-head">
      <div class="bidhist-now">
        <span class="bidhist-num">${fmt(trend.current)}</span>
        <span class="bidhist-unit">${escapeHtml(unit)}</span>
      </div>
      <span class="bidhist-status"><span class="bidhist-pip"></span>${escapeHtml(statusLine(trend, locale))}</span>
    </div>
    <div class="bidhist-chart">${spark}</div>
    ${foot}
  </div>`;
}

/** Short note for the compact card chip. */
function cardNote(trend: BidTrend, locale: Locale): string {
  const span = fmtBidSpan(locale, trend.staleHours);
  switch (trend.state) {
    case "new":
      return t(locale, "bidhist.card.new");
    case "active":
      return t(locale, "bidhist.card.active", { n: Math.max(0, trend.recentGain) });
    case "cold":
      return t(locale, "bidhist.card.quiet", { span });
    case "stale":
      return t(locale, "bidhist.card.flat", { span });
  }
}

/**
 * Compact momentum chip for an index card: bid count, a mini sparkline, and a
 * short staleness/gain note. Renders nothing when there's no history yet.
 */
export function renderBidCardChip(trend: BidTrend | null, locale: Locale): string {
  if (!trend) return "";
  const spark = sparklineSvg(trend.values, { w: 46, h: 16, cls: "spark spark-mini" });
  const full = statusLine(trend, locale);
  return `<div class="bid-chip bid-chip-${trend.state}" title="${escapeHtml(full)}">
    <span class="bid-chip-num">${fmt(trend.current)}</span>
    ${spark}
    <span class="bid-chip-note">${escapeHtml(cardNote(trend, locale))}</span>
  </div>`;
}
