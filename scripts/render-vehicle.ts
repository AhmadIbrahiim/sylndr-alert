import type {
  Snapshot,
  SylndrImage,
} from "./types.ts";
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
  partitionedImages,
  vehicleTitle,
  fmtAuctionTypeLabel,
  computeInspectionStats,
  type InspectionStats,
} from "./shared.ts";
import type {
  SylndrInspectionAnswer,
  SylndrInspectionSection,
  SylndrFeatureSection,
  SylndrFeature,
} from "./types.ts";
import type { Analysis, AnalysisBullet, SummaryParts } from "./analyze.ts";
import {
  t,
  tRelative,
  dir,
  altLocaleHref,
  altLocaleLabel,
  assetUrlFromDetail,
  type Locale,
} from "./i18n.ts";

function specRow(key: string, value: string | null | undefined): string {
  if (!value || value === "—" || value === "null") return "";
  return `<div class="v-spec-row">
    <span class="v-spec-key">${escapeHtml(key)}</span>
    <span class="v-spec-val">${escapeHtml(String(value))}</span>
  </div>`;
}

function quickFact(key: string, value: string): string {
  return `<div class="v-quick-row"><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd></div>`;
}

function galleryHtml(images: SylndrImage[], locale: Locale): string {
  if (!images.length) {
    return `<div class="v-gallery"><div class="v-gallery-empty">${escapeHtml(t(locale, "gallery.empty"))}</div></div>`;
  }
  const mainSrc = images[0]!.imageUrl;
  const thumbs = images
    .map(
      (img, i) =>
        `<button type="button" aria-current="${i === 0 ? "true" : "false"}" data-src="${escapeHtml(img.imageUrl)}" data-i="${i}">
          <img src="${escapeHtml(img.imageUrl)}" alt="photo ${i + 1}" loading="lazy" />
        </button>`,
    )
    .join("");
  return `<div class="v-gallery">
    <div class="v-gallery-main">
      <img id="v-gallery-main-img" src="${escapeHtml(mainSrc)}" alt="vehicle photo" />
    </div>
    <div class="v-gallery-thumbs" role="tablist">${thumbs}</div>
  </div>`;
}

const GALLERY_JS = `
(() => {
  const main = document.getElementById('v-gallery-main-img');
  const thumbs = document.querySelectorAll('.v-gallery-thumbs button');
  if (main && thumbs.length) {
    thumbs.forEach((btn) => {
      btn.addEventListener('click', () => {
        thumbs.forEach((b) => b.setAttribute('aria-current', 'false'));
        btn.setAttribute('aria-current', 'true');
        main.src = btn.dataset.src;
      });
    });
  }
  const updatedRoots = document.querySelectorAll('[data-rendered-at]');
  const labels = window.__I18N__ || {};
  function fmtAgo(iso) {
    const t = new Date(iso).getTime();
    if (!Number.isFinite(t)) return labels.justNow || 'just now';
    const dt = Date.now() - t;
    if (dt < 60_000) return labels.justNow || 'just now';
    const m = Math.floor(dt / 60_000);
    if (m < 60) return (labels.mins || '{n}m ago').replace('{n}', m);
    const h = Math.floor(m / 60);
    if (h < 24) return (labels.hours || '{n}h ago').replace('{n}', h);
    const d = Math.floor(h / 24);
    return (labels.days || '{n}d ago').replace('{n}', d);
  }
  function refresh() {
    updatedRoots.forEach((root) => {
      const iso = root.getAttribute('data-rendered-at');
      const txt = root.querySelector('[data-updated-text]');
      if (iso && txt) txt.textContent = fmtAgo(iso);
    });
  }
  refresh();
  setInterval(refresh, 30_000);
})();
`;

/** Translate a bullet by resolving the cohort-kind placeholder if present. */
function renderBullet(locale: Locale, b: AnalysisBullet): { pip: string; text: string; tone: string } {
  const args = { ...(b.textArgs ?? {}) };
  if (typeof args.kind === "string" && args.kind.startsWith("detail.cohort.refSize.kind")) {
    args.kind = t(locale, args.kind as Parameters<typeof t>[1]);
  }
  const pip = t(locale, b.pipKey as Parameters<typeof t>[1], b.pipArgs);
  const text = t(locale, b.textKey as Parameters<typeof t>[1], args);
  return { pip, text, tone: b.tone };
}

function renderSummary(locale: Locale, s: SummaryParts, titleOverride?: string): string {
  const verdict = t(locale, s.verdictKey as Parameters<typeof t>[1]);
  const cohortKind = s.cohortKindKey ? t(locale, s.cohortKindKey as Parameters<typeof t>[1]) : "";
  const cohortLine = s.cohortLineKey
    ? t(locale, s.cohortLineKey as Parameters<typeof t>[1], {
        n: s.args.refSize,
        kind: cohortKind,
      })
    : "";
  const ageSuffix = s.ageSuffixKey ? t(locale, s.ageSuffixKey as Parameters<typeof t>[1]) : "";
  const heatSuffix = s.heatSuffixKey ? t(locale, s.heatSuffixKey as Parameters<typeof t>[1]) : "";
  const marginSuffix = s.marginSuffixKey
    ? t(locale, s.marginSuffixKey as Parameters<typeof t>[1])
    : "";
  return t(locale, "summary.template", {
    verdict,
    year: s.args.year ? `${s.args.year} ` : "",
    title: titleOverride ?? s.args.title,
    cohortLine,
    ageSuffix,
    heatSuffix,
    marginSuffix,
  }).replace(/\s+/g, " ").trim();
}

function renderAnalysisSection(locale: Locale, analysis: Analysis | null, titleOverride?: string): string {
  if (!analysis) {
    return `<section class="v-section">
      <div class="v-section-head">
        <h2 class="v-section-title"><span class="dot"></span>${escapeHtml(t(locale, "detail.section.analysis"))}</h2>
        <span class="v-section-sub">${escapeHtml(t(locale, "detail.section.analysis.subHeuristic"))}</span>
      </div>
      <div class="ai-empty">${escapeHtml(t(locale, "detail.section.analysis.empty"))}</div>
    </section>`;
  }

  const dealBadgeKey =
    analysis.dealTag === "good"
      ? "detail.deal.good"
      : analysis.dealTag === "high"
        ? "detail.deal.high"
        : "detail.deal.fair";
  const dealBadge =
    analysis.dealTag === "good"
      ? `<span class="deal-tag good">${escapeHtml(t(locale, dealBadgeKey))}</span>`
      : analysis.dealTag === "high"
        ? `<span class="deal-tag high">${escapeHtml(t(locale, dealBadgeKey))}</span>`
        : `<span class="deal-tag fair">${escapeHtml(t(locale, dealBadgeKey))}</span>`;

  const bullets = analysis.bullets
    .map((b) => {
      const r = renderBullet(locale, b);
      return `<div class="cohort-bullet">
        <span class="pip ${r.tone === "good" ? "good" : r.tone === "hot" ? "hot" : r.tone === "mid" ? "mid" : ""}">${escapeHtml(r.pip)}</span>
        <span class="cohort-bullet-text">${escapeHtml(r.text)}</span>
      </div>`;
    })
    .join("");

  const refKind = t(
    locale,
    analysis.cohort.refCohort === "model+year"
      ? "detail.cohort.modelYear"
      : "detail.cohort.model",
  );
  const cohortSub = t(locale, "detail.section.analysis.sub.cohort", {
    n: analysis.cohort.refSize,
    kind: refKind,
  });

  return `<section class="v-section">
    <div class="v-section-head">
      <h2 class="v-section-title"><span class="dot"></span>${escapeHtml(t(locale, "detail.section.analysis"))}</h2>
      <span class="v-section-sub">${escapeHtml(cohortSub)}</span>
    </div>
    <div class="cohort">
      <div class="cohort-summary">${escapeHtml(renderSummary(locale, analysis.summary, titleOverride))} ${dealBadge}</div>
      <div class="cohort-bullets">${bullets}</div>
    </div>
  </section>`;
}

function renderAiSection(locale: Locale, aiMarkdown: string | null): string {
  if (!aiMarkdown || !aiMarkdown.trim()) {
    return `<section class="ai-card">
      <div class="ai-card-head">
        <div class="ai-mark">AI</div>
        <h2 class="ai-title">${escapeHtml(t(locale, "detail.section.aiTake"))}</h2>
        <span class="ai-source">${escapeHtml(t(locale, "detail.section.aiTake.queued"))}</span>
      </div>
      <div class="ai-empty">${escapeHtml(t(locale, "detail.section.aiTake.empty"))}</div>
    </section>`;
  }
  return `<section class="ai-card">
    <div class="ai-card-head">
      <div class="ai-mark">AI</div>
      <h2 class="ai-title">${escapeHtml(t(locale, "detail.section.aiTake"))}</h2>
      <span class="ai-source">${escapeHtml(t(locale, "detail.section.aiTake.source"))}</span>
    </div>
    <div class="ai-body">${miniMarkdown(aiMarkdown)}</div>
  </section>`;
}

function miniMarkdown(src: string): string {
  const escaped = escapeHtml(src.trim());
  const blocks = escaped.split(/\n\s*\n/);
  return blocks.map(renderMdBlock).join("");
}

function renderMdBlock(blk: string): string {
  const lines = blk.split(/\n/);
  const firstListIdx = lines.findIndex((l) => /^\s*[-*]\s+/.test(l));
  if (firstListIdx === -1) {
    return `<p>${inline(lines.join(" "))}</p>`;
  }
  if (firstListIdx === 0) {
    const items = lines
      .filter((l) => /^\s*[-*]\s+/.test(l))
      .map((l) => `<li>${inline(l.replace(/^\s*[-*]\s+/, ""))}</li>`)
      .join("");
    return `<ul>${items}</ul>`;
  }
  const intro = lines.slice(0, firstListIdx).join(" ");
  const items = lines
    .slice(firstListIdx)
    .filter((l) => /^\s*[-*]\s+/.test(l))
    .map((l) => `<li>${inline(l.replace(/^\s*[-*]\s+/, ""))}</li>`)
    .join("");
  return `<p>${inline(intro)}</p><ul>${items}</ul>`;
}

function inline(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*(?!\s)([^*]+?)\*(?!\*)/g, "$1<em>$2</em>");
}

// --- inspection rendering ---

function inspectionLabel(answer: SylndrInspectionAnswer, locale: Locale): string {
  return locale === "ar" ? answer.name : (answer.nameEn || answer.name);
}

function inspectionValue(answer: SylndrInspectionAnswer, locale: Locale): string {
  return (locale === "ar" ? answer.value : answer.valueEn || answer.value) ?? "";
}

function inspectionComment(answer: SylndrInspectionAnswer, locale: Locale): string {
  const raw = locale === "ar" ? answer.comment : answer.commentEn || answer.comment;
  if (!raw) return "";
  return raw.trim();
}

function sectionTitle(s: SylndrInspectionSection, locale: Locale): string {
  return locale === "ar" ? s.name : (s.nameEn || s.name);
}

function severityClass(s: "clean" | "minor" | "many"): string {
  return s === "clean" ? "good" : s === "minor" ? "mid" : "hot";
}

function severityLabel(locale: Locale, s: "clean" | "minor" | "many"): string {
  return t(locale, ("inspection.severity." + s) as Parameters<typeof t>[1]);
}

function renderFindingRow(a: SylndrInspectionAnswer, locale: Locale): string {
  const label = inspectionLabel(a, locale);
  const value = inspectionValue(a, locale);
  const comment = inspectionComment(a, locale);
  const tone = a.faulty === true ? "hot" : a.faulty === false ? "good" : "neutral";
  const tagText =
    a.faulty === true
      ? t(locale, "inspection.finding.faulty")
      : a.faulty === false
        ? t(locale, "inspection.finding.ok")
        : "";
  const okClass = a.faulty === false ? " ins-ok" : "";
  return `<div class="ins-finding ${tone}${okClass}">
    <div class="ins-finding-head">
      ${tagText ? `<span class="ins-tag ${tone}">${escapeHtml(tagText)}</span>` : ""}
      <span class="ins-finding-label">${escapeHtml(label)}</span>
    </div>
    ${value ? `<div class="ins-finding-val">${escapeHtml(value)}</div>` : ""}
    ${comment ? `<div class="ins-finding-comment" dir="auto"><span class="ins-finding-comment-key">${escapeHtml(t(locale, "inspection.finding.note"))}</span><span class="ins-finding-comment-text">${escapeHtml(comment)}</span></div>` : ""}
  </div>`;
}

function renderInspectionSectionCard(
  s: SylndrInspectionSection,
  stats: InspectionStats["bySection"][number],
  locale: Locale,
): string {
  const title = sectionTitle(s, locale);
  const sev = severityClass(stats.severity);
  const answers = s.answers ?? [];
  const faultyRows = answers.filter((a) => a.faulty === true).map((a) => renderFindingRow(a, locale)).join("");
  const okRows = answers.filter((a) => a.faulty === false).map((a) => renderFindingRow(a, locale)).join("");
  const neutralRows = answers.filter((a) => a.faulty == null).map((a) => renderFindingRow(a, locale)).join("");
  const totalCounted = stats.total - stats.neutral;
  const flagged = stats.faulty;
  const okCount = stats.ok;
  const okSentence = totalCounted > 0
    ? `${okCount}/${totalCounted}`
    : `${stats.total}`;

  return `<details class="ins-section" ${flagged > 0 ? "open" : ""}>
    <summary class="ins-section-head">
      <span class="ins-section-name">${escapeHtml(title)}</span>
      <span class="ins-section-stats">
        <span class="ins-section-count ${sev}">${flagged} ${escapeHtml(t(locale, "inspection.finding.faulty"))}</span>
        <span class="ins-section-okcount">${okSentence}</span>
        <span class="ins-bar"><span class="ins-bar-fill ${sev}" style="width:${Math.min(100, Math.max(0, 100 - stats.okPct))}%"></span></span>
      </span>
    </summary>
    <div class="ins-section-body">
      ${faultyRows}
      ${neutralRows}
      ${okRows || (faultyRows ? "" : `<div class="ai-empty">${escapeHtml(t(locale, "inspection.section.empty"))}</div>`)}
    </div>
  </details>`;
}

function renderInspectionReport(snap: Snapshot, locale: Locale): string {
  const stats = computeInspectionStats(snap);
  const sections = snap.inspectionReport?.sections ?? [];

  if (!stats || !sections.length) {
    return `<section class="v-section">
      <div class="v-section-head">
        <h2 class="v-section-title"><span class="dot"></span>${escapeHtml(t(locale, "inspection.section"))}</h2>
        <span class="v-section-sub">${escapeHtml(t(locale, "inspection.section.sub"))}</span>
      </div>
      <div class="ai-empty">${escapeHtml(t(locale, "inspection.empty"))}</div>
    </section>`;
  }

  const sev = severityClass(stats.severity);
  const sevLabel = severityLabel(locale, stats.severity);
  const okPct = stats.okPct;
  const orderedSections = [...sections].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0),
  );

  const sectionsHtml = orderedSections
    .map((s) => {
      const sStats = stats.bySection.find((x) => x.nameEn === s.nameEn) ?? stats.bySection[0]!;
      return renderInspectionSectionCard(s, sStats, locale);
    })
    .join("");

  return `<section class="v-section ins-card">
    <div class="v-section-head">
      <h2 class="v-section-title"><span class="dot"></span>${escapeHtml(t(locale, "inspection.section"))}</h2>
      <span class="v-section-sub">${escapeHtml(t(locale, "inspection.section.sub"))}</span>
    </div>

    <div class="ins-overview">
      <div class="ins-overview-head">
        <div class="ins-overview-title">${escapeHtml(t(locale, "inspection.overview.title"))}</div>
        <div class="ins-overview-sev ${sev}">${escapeHtml(sevLabel)}</div>
      </div>
      <div class="ins-health-bar">
        <div class="ins-health-bar-fill ${sev}" style="width:${okPct}%"></div>
        <div class="ins-health-bar-pct">${okPct}%</div>
      </div>
      <div class="ins-overview-stats">
        <span class="ins-overview-stat">${escapeHtml(t(locale, "inspection.overview.points", { ok: stats.ok, total: stats.total - stats.neutral }))}</span>
        <span class="ins-overview-dot"></span>
        <span class="ins-overview-stat ${sev}">${escapeHtml(t(locale, "inspection.overview.flagged", { n: stats.faulty }))}</span>
      </div>
    </div>

    <div class="ins-sections">${sectionsHtml}</div>
  </section>`;
}

// --- features rendering ---

function featureValue(f: SylndrFeature, locale: Locale): string {
  return locale === "ar" ? (f.value_ar || f.value_en) : (f.value_en || f.value_ar);
}

function featureName(f: SylndrFeature, locale: Locale): string {
  return locale === "ar" ? (f.name_ar || f.name_en) : (f.name_en || f.name_ar);
}

function featureSectionTitle(s: SylndrFeatureSection, locale: Locale): string {
  return locale === "ar" ? (s.name_ar || s.name_en) : (s.name_en || s.name_ar);
}

function isYesValue(v: string): boolean {
  const s = v.trim().toLowerCase();
  return s === "yes" || s === "نعم";
}

function isNoValue(v: string): boolean {
  const s = v.trim().toLowerCase();
  return s === "no" || s === "لا";
}

function renderFeatureCell(f: SylndrFeature, locale: Locale): string {
  const name = featureName(f, locale);
  const val = featureValue(f, locale);
  if (isYesValue(val)) {
    return `<div class="feat-cell feat-yes"><span class="feat-icon">✓</span><span class="feat-name">${escapeHtml(name)}</span></div>`;
  }
  if (isNoValue(val)) {
    return `<div class="feat-cell feat-no"><span class="feat-icon">—</span><span class="feat-name">${escapeHtml(name)}</span></div>`;
  }
  return `<div class="feat-cell feat-val"><span class="feat-name">${escapeHtml(name)}</span><span class="feat-value">${escapeHtml(val)}</span></div>`;
}

function renderFeaturesSection(snap: Snapshot, locale: Locale): string {
  const sections = snap.extraInfo?.carFeatures?.sections;
  if (!sections || sections.length === 0) return "";

  const ordered = [...sections].sort((a, b) => a.order - b.order);
  const blocks = ordered.map((s) => {
    const cells = (s.features ?? [])
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((f) => renderFeatureCell(f, locale))
      .join("");
    return `<div class="feat-group">
      <div class="feat-group-title">${escapeHtml(featureSectionTitle(s, locale))}</div>
      <div class="feat-grid">${cells}</div>
    </div>`;
  }).join("");

  return `<section class="v-section">
    <div class="v-section-head">
      <h2 class="v-section-title"><span class="dot"></span>${escapeHtml(t(locale, "features.section"))}</h2>
      <span class="v-section-sub">${escapeHtml(t(locale, "features.section.sub"))}</span>
    </div>
    <div class="feat-groups">${blocks}</div>
  </section>`;
}

function localizedDisplayName(snap: Snapshot, locale: Locale): {
  make: string;
  model: string;
  title: string;
} {
  const arMake = snap.vehicle.carMake?.arName;
  const arModel = snap.vehicle.carModel?.arName;
  const enMake = snap.vehicle.carMake?.name ?? "";
  const enModel = snap.vehicle.carModel?.name ?? "";
  if (locale === "ar") {
    const make = arMake || enMake;
    const model = arModel || enModel;
    return { make, model, title: `${make} ${model}`.trim() || vehicleTitle(snap) };
  }
  return { make: enMake, model: enModel, title: vehicleTitle(snap) };
}

const I18N_JS_KEYS = (locale: Locale) => ({
  justNow: t(locale, "rel.justNow"),
  mins: t(locale, "rel.minutes", { n: "{n}" }),
  hours: t(locale, "rel.hours", { n: "{n}" }),
  days: t(locale, "rel.days", { n: "{n}" }),
});

export function renderVehiclePage(args: {
  snapshot: Snapshot;
  analysis: Analysis | null;
  aiMarkdown: string | null;
  locale: Locale;
}): string {
  const { snapshot: snap, analysis, aiMarkdown, locale } = args;
  const v = snap.vehicle;
  const names = localizedDisplayName(snap, locale);
  const year = v.carYear?.name ?? "";
  const url = sylndrListingUrl(snap);
  const photos = partitionedImages(snap);
  const orderedImages = [
    ...photos.exterior,
    ...photos.interior,
    ...photos.engine,
    ...photos.other,
  ];

  const retail = retailPrice(snap);
  const market = marketPrice(snap);
  const asked = askingPrice(snap);
  const margin = marketPremium(snap);
  const auction = auctionInfo(snap);
  const listedIso = listedAt(snap);
  const listedAbs = fmtAbsolute(listedIso);
  const cssHref = assetUrlFromDetail(locale, "style.css");
  const indexHref = locale === "en" ? "../index.html" : "../../ar/index.html";
  const altHref = altLocaleHref({ page: "detail", current: locale, vehicleId: v.id });
  const altLabel = altLocaleLabel(locale);

  const dealBadge = analysis
    ? analysis.dealTag === "good"
      ? `<span class="v-price-tag" style="background:var(--good-soft);color:var(--good)">${escapeHtml(t(locale, "detail.deal.good"))}</span>`
      : analysis.dealTag === "high"
        ? `<span class="v-price-tag" style="background:var(--hot-soft);color:var(--hot)">${escapeHtml(t(locale, "detail.deal.high"))}</span>`
        : `<span class="v-price-tag" style="background:rgba(127,127,127,.10);color:var(--muted)">${escapeHtml(t(locale, "detail.deal.fair"))}</span>`
    : "";

  const ladderRows: string[] = [];
  if (asked > 0) {
    ladderRows.push(
      `<div class="v-ladder-row">
        <span class="v-ladder-key">${escapeHtml(t(locale, "detail.ladder.asking"))} <span class="v-ladder-note">${escapeHtml(t(locale, "detail.ladder.asking.note"))}</span></span>
        <span class="v-ladder-val">${escapeHtml(fmtPrice(asked))} ${escapeHtml(t(locale, "card.egp"))}</span>
      </div>`,
    );
  }
  if (market > 0) {
    ladderRows.push(
      `<div class="v-ladder-row">
        <span class="v-ladder-key">${escapeHtml(t(locale, "detail.ladder.market"))} <span class="v-ladder-note">${escapeHtml(t(locale, "detail.ladder.market.note"))}</span></span>
        <span class="v-ladder-val">${escapeHtml(fmtPrice(market))} ${escapeHtml(t(locale, "card.egp"))}</span>
      </div>`,
    );
  }
  if (retail > 0) {
    ladderRows.push(
      `<div class="v-ladder-row accent">
        <span class="v-ladder-key">${escapeHtml(t(locale, "detail.ladder.retail"))} <span class="v-ladder-note">${escapeHtml(t(locale, "detail.ladder.retail.note"))}</span></span>
        <span class="v-ladder-val accent">${escapeHtml(fmtPrice(retail))} ${escapeHtml(t(locale, "card.egp"))}</span>
      </div>`,
    );
  }
  if (auction?.winnerAmount) {
    ladderRows.push(
      `<div class="v-ladder-row hot">
        <span class="v-ladder-key">${escapeHtml(t(locale, "detail.ladder.winning"))} <span class="v-ladder-note">${escapeHtml(t(locale, "detail.ladder.winning.note"))}</span></span>
        <span class="v-ladder-val hot">${escapeHtml(fmtPrice(auction.winnerAmount))} ${escapeHtml(t(locale, "card.egp"))}</span>
      </div>`,
    );
  }

  const premiumViz =
    margin && market > 0 && retail > 0
      ? `<div class="margin-viz">
          <div class="margin-bar">
            <div class="margin-marker" style="left:${Math.min(100, Math.max(0, margin.pct))}%"></div>
          </div>
          <div class="margin-labels">
            <span>${escapeHtml(t(locale, "detail.premium.atMarket"))}</span>
            <span style="color:var(--fg);font-weight:700">${escapeHtml(t(locale, margin.pct < 0 ? "detail.premium.labelUnder" : "detail.premium.label", { pct: Math.abs(margin.pct).toFixed(1), abs: fmtPriceShort(Math.abs(margin.abs)) }))}</span>
            <span>${escapeHtml(t(locale, "detail.premium.bigPremium"))}</span>
          </div>
        </div>`
      : "";

  const specRows = [
    specRow(t(locale, "detail.spec.make"), names.make),
    specRow(t(locale, "detail.spec.model"), names.model),
    specRow(t(locale, "detail.spec.year"), year),
    specRow(t(locale, "detail.spec.body"), v.bodyStyle),
    specRow(t(locale, "detail.spec.transmission"), v.transmission),
    specRow(t(locale, "detail.spec.color"), v.color),
    specRow(t(locale, "detail.spec.kilometrage"), v.kilometrage ? `${fmtKm(v.kilometrage)} ${t(locale, "card.km")}` : null),
    specRow(t(locale, "detail.spec.status"), v.currentStatus),
    specRow(t(locale, "detail.spec.reference"), v.salesforceName),
    specRow(t(locale, "detail.spec.owner"), snap.vehicleOwner?.name ?? null),
    specRow(t(locale, "detail.spec.firstSeen"), fmtAbsolute(snap.firstSeen)),
    specRow(t(locale, "detail.spec.listed"), listedAbs),
  ].filter(Boolean).join("");

  const statusLabel =
    auction?.status === "BEING_SOLD"
      ? t(locale, "filter.status.beingSold")
      : auction?.status === "PUBLISHED"
        ? t(locale, "filter.status.published")
        : auction?.status === "SOLD"
          ? t(locale, "filter.status.sold")
          : (auction?.status ?? "").toLowerCase().replace("_", " ");

  const auctionTiles = auction
    ? `<div class="v-auction">
        <div class="v-auc-tile"><span class="v-auc-key">${escapeHtml(t(locale, "detail.auction.status"))}</span><span class="v-auc-val ${auction.isLive ? "hot" : ""}">${escapeHtml(statusLabel)}</span></div>
        <div class="v-auc-tile"><span class="v-auc-key">${escapeHtml(t(locale, "detail.auction.type"))}</span><span class="v-auc-val">${escapeHtml(fmtAuctionTypeLabel(auction.type))}</span></div>
        <div class="v-auc-tile"><span class="v-auc-key">${escapeHtml(t(locale, "detail.auction.bids"))}</span><span class="v-auc-val ${auction.bids > 0 ? "accent" : ""}">${fmt(auction.bids)}</span></div>
        <div class="v-auc-tile"><span class="v-auc-key">${escapeHtml(t(locale, "detail.auction.bidders"))}</span><span class="v-auc-val">${fmt(auction.bidders)}</span></div>
        ${auction.startsAt ? `<div class="v-auc-tile"><span class="v-auc-key">${escapeHtml(t(locale, "detail.auction.starts"))}</span><span class="v-auc-val" style="font-size:13px">${escapeHtml(fmtAbsolute(auction.startsAt))}</span></div>` : ""}
        ${auction.endsAt ? `<div class="v-auc-tile"><span class="v-auc-key">${escapeHtml(t(locale, "detail.auction.ends"))}</span><span class="v-auc-val" style="font-size:13px">${escapeHtml(fmtAbsolute(auction.endsAt))}</span></div>` : ""}
      </div>`
    : `<div class="ai-empty">${escapeHtml(t(locale, "detail.section.auction.empty"))}</div>`;

  const quickFacts = [
    quickFact(t(locale, "detail.quick.km"), v.kilometrage ? `${fmtKm(v.kilometrage)} ${t(locale, "card.km")}` : "—"),
    quickFact(t(locale, "detail.quick.body"), v.bodyStyle ?? "—"),
    quickFact(t(locale, "detail.quick.transmission"), v.transmission ?? "—"),
    quickFact(t(locale, "detail.quick.color"), v.color ?? "—"),
  ].join("");

  const i18nJs = JSON.stringify(I18N_JS_KEYS(locale));

  return `<!doctype html>
<html lang="${locale}" dir="${dir(locale)}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="dark light" />
<title>${escapeHtml(t(locale, "page.title.detail", { year, title: names.title }))}</title>
<meta name="description" content="${escapeHtml(`${year} ${names.title}`)}" />
<link rel="alternate" hreflang="${locale === "en" ? "ar" : "en"}" href="${escapeHtml(altHref)}" />
<link rel="stylesheet" href="${escapeHtml(cssHref)}" />
</head>
<body>
<div class="wrap">
  <header class="hero">
    <div class="brand-row">
      <a class="brand" href="${escapeHtml(indexHref)}">
        <div class="brand-mark">S</div>
        <div class="brand-text">
          <div class="brand-name">${escapeHtml(t(locale, "brand.name"))}</div>
          <div class="brand-tag">${escapeHtml(t(locale, "brand.tag.detail"))}</div>
        </div>
      </a>
      <div class="brand-right">
        <a class="lang-toggle" href="${escapeHtml(altHref)}" aria-label="${escapeHtml(altLabel)}">${escapeHtml(altLabel)}</a>
        <div class="updated" data-rendered-at="${escapeHtml(new Date().toISOString())}">
          <span class="pulse"></span>
          <span>${escapeHtml(t(locale, "header.updated.rendered"))} <span data-updated-text>${escapeHtml(t(locale, "rel.justNow"))}</span></span>
        </div>
      </div>
    </div>
    <div class="crumbs">
      <a href="${escapeHtml(indexHref)}">${escapeHtml(t(locale, "detail.crumb.all"))}</a>
      <span class="sep">/</span>
      <span>${escapeHtml(names.make)}</span>
      <span class="sep">/</span>
      <span>${escapeHtml(names.model)}</span>
      <span class="sep">/</span>
      <span>${escapeHtml(year)}</span>
    </div>
  </header>

  <section class="v-hero">
    ${galleryHtml(orderedImages, locale)}
    <div class="v-info">
      <div class="v-year">${escapeHtml(year)}</div>
      <h1 class="v-title">${escapeHtml(names.title)}</h1>
      ${v.salesforceName ? `<p class="v-subtitle">${escapeHtml(t(locale, "detail.spec.reference"))} ${escapeHtml(v.salesforceName)}</p>` : ""}
      <div class="v-price-block">
        <span class="v-price-num">${escapeHtml(fmtPrice(retail))}</span>
        <span class="v-price-unit">${escapeHtml(t(locale, "card.egp"))}</span>
        ${dealBadge}
      </div>
      <dl class="v-quick">${quickFacts}</dl>
      <div class="v-actions">
        <a class="v-cta" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t(locale, "detail.viewSylndr"))}</a>
        <a class="v-cta-ghost" href="${escapeHtml(indexHref)}">${escapeHtml(t(locale, "detail.backToGrid"))}</a>
      </div>
    </div>
  </section>

  <div class="v-grid">
    <section class="v-section">
      <div class="v-section-head">
        <h2 class="v-section-title"><span class="dot"></span>${escapeHtml(t(locale, "detail.section.priceLadder"))}</h2>
        <span class="v-section-sub">${escapeHtml(t(locale, "detail.section.priceLadder.sub"))}</span>
      </div>
      <div class="v-ladder">${ladderRows.join("")}</div>
      ${premiumViz}
    </section>

    ${renderAnalysisSection(locale, analysis, names.title)}
  </div>

  <div class="v-grid">
    <section class="v-section">
      <div class="v-section-head">
        <h2 class="v-section-title"><span class="dot"></span>${escapeHtml(t(locale, "detail.section.auction"))}</h2>
        <span class="v-section-sub">${escapeHtml(t(locale, "detail.section.auction.sub"))}</span>
      </div>
      ${auctionTiles}
    </section>

    <section class="v-section">
      <div class="v-section-head">
        <h2 class="v-section-title"><span class="dot"></span>${escapeHtml(t(locale, "detail.section.specs"))}</h2>
        <span class="v-section-sub">${escapeHtml(t(locale, "detail.section.specs.sub"))}</span>
      </div>
      <div class="v-spec">${specRows}</div>
    </section>
  </div>

  <div class="v-grid full">
    ${renderInspectionReport(snap, locale)}
  </div>

  <div class="v-grid full">
    ${renderFeaturesSection(snap, locale)}
  </div>

  <div class="v-grid full">
    ${renderAiSection(locale, aiMarkdown)}
  </div>

  <footer>
    <span>${escapeHtml(t(locale, "footer.vehicleId", { id: v.id }))}</span>
    <span>${escapeHtml(t(locale, "footer.data"))} <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">sylndr.com</a> &middot; ${escapeHtml(t(locale, "footer.source"))} <a href="https://github.com/AhmadIbrahiim/sylndr-alert" target="_blank" rel="noopener noreferrer">github</a></span>
  </footer>
</div>
<script>window.__I18N__ = ${i18nJs};${GALLERY_JS}</script>
</body>
</html>
`;
}
