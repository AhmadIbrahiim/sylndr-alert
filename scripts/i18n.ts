/**
 * Tiny i18n. Two locales: en + ar (easy, conversational Egyptian Arabic).
 * Args are interpolated via {key}. Plurals use {count|singular|plural}.
 */

export type Locale = "en" | "ar";
export const LOCALES: readonly Locale[] = ["en", "ar"] as const;
export const DEFAULT_LOCALE: Locale = "en";

export function isRtl(l: Locale): boolean {
  return l === "ar";
}

export function dir(l: Locale): "ltr" | "rtl" {
  return isRtl(l) ? "rtl" : "ltr";
}

type Args = Record<string, string | number>;

const STRINGS = {
  // brand + header
  "brand.name": { en: "Sylndr alerts", ar: "تنبيهات سيلندر" },
  "brand.tag.index": { en: "personal · auto-refreshed during EST business hours", ar: "أداة شخصية · بتتحدّث أوقات الشغل بالقاهرة" },
  "brand.tag.detail": { en: "personal · vehicle detail", ar: "أداة شخصية · تفاصيل العربية" },
  "header.lang.en": { en: "EN", ar: "EN" },
  "header.lang.ar": { en: "AR", ar: "AR" },
  "header.lang.switch": { en: "العربية", ar: "English" },
  "header.updated.justNow": { en: "Updated just now", ar: "اتحدّث لسه" },
  "header.updated.rendered": { en: "rendered", ar: "اتجدّد" },
  "header.updated.ago.justNow": { en: "just now", ar: "دلوقتي" },
  "header.updated.ago.minute": { en: "{n} minute ago", ar: "من {n} دقيقة" },
  "header.updated.ago.minutes": { en: "{n} minutes ago", ar: "من {n} دقيقة" },
  "header.updated.ago.hour": { en: "{n} hour ago", ar: "من {n} ساعة" },
  "header.updated.ago.hours": { en: "{n} hours ago", ar: "من {n} ساعات" },
  "header.updated.ago.day": { en: "{n} day ago", ar: "من {n} يوم" },
  "header.updated.ago.days": { en: "{n} days ago", ar: "من {n} أيام" },

  // hero
  "hero.title.part1": { en: "Every Sylndr listing,", ar: "كل عربيات سيلندر،" },
  "hero.title.accent": { en: "scored and watchable", ar: "متقيّمة وسهل تتابعها" },
  "hero.sub": {
    en: "<strong>{total}</strong> live cars, <strong>{live}</strong> currently in auction, <strong>{good}</strong> tagged as fair vs cohort. Click any title for a detailed breakdown with price ladder, auction state, and analysis.",
    ar: "<strong>{total}</strong> عربية معروضة، <strong>{live}</strong> دلوقتي في المزاد، و <strong>{good}</strong> اتقيّموا إن سعرهم منطقي. دوس على اسم أي عربية تشوف تفاصيل السعر، المزاد، والتحليل.",
  },

  // stats
  "stat.showing": { en: "Showing", ar: "بنعرض" },
  "stat.inAuction": { en: "In auction", ar: "في المزاد" },
  "stat.priceRange": { en: "Price range", ar: "مدى السعر" },
  "stat.avgMargin": { en: "Avg Sylndr margin", ar: "هامش سيلندر" },

  // featured
  "featured.title": { en: "Featured picks", ar: "مختارات مميّزة" },
  "featured.sub": { en: "{n} of {total}", ar: "{n} من {total}" },
  "featured.tag.inAuction": { en: "in auction", ar: "في المزاد" },
  "featured.tag.fair": { en: "looks fair", ar: "سعرها معقول" },
  "featured.tag.fresh": { en: "fresh", ar: "جديدة" },
  "featured.tag.highMargin": { en: "high margin", ar: "هامش مرتفع" },

  // filter bar
  "filter.search": { en: "Search make, model, code, or owner…", ar: "ابحث بالماركة، الموديل، الكود، أو اسم البائع…" },
  "filter.sort.listedDesc": { en: "Newest listed", ar: "الأحدث عرضًا" },
  "filter.sort.listedAsc": { en: "Oldest listed", ar: "الأقدم عرضًا" },
  "filter.sort.priceAsc": { en: "Cheapest first", ar: "الأرخص الأول" },
  "filter.sort.priceDesc": { en: "Most expensive first", ar: "الأغلى الأول" },
  "filter.sort.marginDesc": { en: "Highest Sylndr margin", ar: "أعلى هامش لسيلندر" },
  "filter.sort.marginAsc": { en: "Lowest Sylndr margin", ar: "أقل هامش لسيلندر" },
  "filter.sort.kmAsc": { en: "Lowest km", ar: "أقل كيلومترات" },
  "filter.sort.yearDesc": { en: "Newest year", ar: "أحدث سنة" },
  "filter.reset": { en: "Reset", ar: "مسح الفلاتر" },
  "filter.label.body": { en: "Body", ar: "النوع" },
  "filter.label.trans": { en: "Trans", ar: "الفتيس" },
  "filter.label.status": { en: "Status", ar: "الحالة" },
  "filter.label.deal": { en: "Deal", ar: "العرض" },
  "filter.label.price": { en: "Price EGP", ar: "السعر جنيه" },
  "filter.label.maxKm": { en: "Max km", ar: "أقصى كم" },
  "filter.label.year": { en: "Year", ar: "السنة" },
  "filter.placeholder.any": { en: "any", ar: "أي" },
  "filter.status.sold": { en: "Sold", ar: "اتباعت" },
  "filter.status.published": { en: "published", ar: "معروضة" },
  "filter.status.beingSold": { en: "in auction", ar: "في المزاد" },
  "filter.deal.good": { en: "Looks fair", ar: "سعرها معقول" },
  "filter.deal.fair": { en: "Middle", ar: "متوسط" },
  "filter.deal.high": { en: "Trends pricey", ar: "سعرها عالي" },

  // card
  "card.km": { en: "km", ar: "كم" },
  "card.egp": { en: "EGP", ar: "جنيه" },
  "card.bid.one": { en: "{n} bid", ar: "{n} مزايدة" },
  "card.bid.many": { en: "{n} bids", ar: "{n} مزايدات" },
  "card.bidder.one": { en: "{n} bidder", ar: "{n} مزايد" },
  "card.bidder.many": { en: "{n} bidders", ar: "{n} مزايدين" },
  "card.listed": { en: "listed {when}", ar: "اتعرضت {when}" },
  "card.owner": { en: "owner", ar: "البائع" },
  "card.sylndrLink": { en: "sylndr ↗", ar: "افتح سيلندر ↗" },
  "card.sylndr.aria": { en: "{title} on Sylndr", ar: "{title} على سيلندر" },
  "card.priceLadder.sylndr": { en: "Sylndr price", ar: "سعر سيلندر" },
  "card.priceLadder.sylndr.tooltip": { en: "Sylndr offered the seller {amount} EGP", ar: "سيلندر دفعت للبائع {amount} جنيه" },
  "card.priceLadder.margin": { en: "{pct}% margin", ar: "هامش {pct}%" },
  "card.priceLadder.asking": { en: "Asking", ar: "سعر البائع" },
  "card.priceLadder.asking.tooltip": { en: "What the seller originally asked for", ar: "السعر اللي البائع طلبه أول مرة" },
  "card.priceLadder.auction": { en: "Auction price", ar: "سعر المزاد" },
  "card.priceLadder.auction.tooltip": { en: "Winning bid amount accepted by Sylndr — sale in progress", ar: "أعلى مزايدة قبلتها سيلندر — البيع جاري" },
  "card.priceLadder.under": { en: "{pct}% under", ar: "أقل بـ {pct}%" },
  "card.badge.sold": { en: "&#128293; sold", ar: "&#128293; اتباعت" },
  "card.badge.lookFair": { en: "looks fair", ar: "سعرها معقول" },
  "card.badge.trendsPricey": { en: "trends pricey", ar: "سعرها عالي" },

  // relative time (used in card listed + detail "rendered")
  "rel.justNow": { en: "just now", ar: "دلوقتي" },
  "rel.minutes": { en: "{n}m ago", ar: "من {n}د" },
  "rel.hours": { en: "{n}h ago", ar: "من {n}س" },
  "rel.days": { en: "{n}d ago", ar: "من {n} يوم" },
  "rel.months": { en: "{n}mo ago", ar: "من {n} شهر" },

  // detail page
  "detail.crumb.all": { en: "All listings", ar: "كل العربيات" },
  "detail.viewSylndr": { en: "View on Sylndr →", ar: "افتح على سيلندر ←" },
  "detail.backToGrid": { en: "Back to grid", ar: "ارجع للقائمة" },
  "detail.quick.km": { en: "KM", ar: "كم" },
  "detail.quick.body": { en: "Body", ar: "النوع" },
  "detail.quick.transmission": { en: "Transmission", ar: "الفتيس" },
  "detail.quick.color": { en: "Color", ar: "اللون" },
  "detail.section.priceLadder": { en: "Price ladder", ar: "سلم الأسعار" },
  "detail.section.priceLadder.sub": { en: "EGP, from API", ar: "جنيه، من الـ API" },
  "detail.section.analysis": { en: "Analysis", ar: "التحليل" },
  "detail.section.analysis.sub.cohort": { en: "cohort: {n} {kind}", ar: "مقارنة مع {n} {kind}" },
  "detail.section.analysis.subHeuristic": { en: "heuristic", ar: "تحليل آلي" },
  "detail.section.analysis.empty": { en: "No analysis yet — runs on next poll.", ar: "لسه ما اتحلّلتش — هتتحلّل في الجولة الجاية." },
  "detail.section.auction": { en: "Auction", ar: "المزاد" },
  "detail.section.auction.sub": { en: "live state from API", ar: "حالة المزاد دلوقتي" },
  "detail.section.auction.empty": { en: "No auction data for this listing.", ar: "مفيش بيانات مزاد للعربية دي." },
  "detail.section.specs": { en: "Specs", ar: "المواصفات" },
  "detail.section.specs.sub": { en: "raw fields", ar: "البيانات الخام" },
  "detail.section.aiTake": { en: "AI take", ar: "رأي الذكاء الاصطناعي" },
  "detail.section.aiTake.queued": { en: "queued", ar: "في الانتظار" },
  "detail.section.aiTake.source": { en: "github models", ar: "غيت‌هاب موديلز" },
  "detail.section.aiTake.empty": { en: "AI analysis hasn't run for this listing yet. Will populate on the next poll once GitHub Models is wired up.", ar: "تحليل الذكاء الاصطناعي لسه ما اشتغلش على العربية دي. هيتعمل لما الجولة الجاية تشتغل." },
  "detail.ladder.asking": { en: "Asking price", ar: "سعر البائع" },
  "detail.ladder.asking.note": { en: "what the seller asked", ar: "اللي البائع طلبه" },
  "detail.ladder.wholesale": { en: "Sylndr wholesale", ar: "سعر سيلندر للبائع" },
  "detail.ladder.wholesale.note": { en: "what Sylndr offered the seller", ar: "اللي سيلندر دفعته للبائع" },
  "detail.ladder.retail": { en: "Retail (you pay)", ar: "السعر اللي هتدفعه" },
  "detail.ladder.retail.note": { en: "consumer-facing price", ar: "السعر المعروض على الموقع" },
  "detail.ladder.winning": { en: "Winning bid", ar: "أعلى مزايدة" },
  "detail.ladder.winning.note": { en: "sale in progress", ar: "البيع جاري" },
  "detail.margin.thin": { en: "0% (thin)", ar: "٠٪ (هامش ضعيف)" },
  "detail.margin.fat": { en: "50%+ (fat)", ar: "٥٠٪+ (هامش كبير)" },
  "detail.margin.label": { en: "{pct}% margin · {abs} EGP", ar: "هامش {pct}٪ · {abs} جنيه" },
  "detail.auction.status": { en: "Status", ar: "الحالة" },
  "detail.auction.type": { en: "Type", ar: "النوع" },
  "detail.auction.bids": { en: "Bids", ar: "المزايدات" },
  "detail.auction.bidders": { en: "Bidders", ar: "عدد المزايدين" },
  "detail.auction.starts": { en: "Starts", ar: "بدأ" },
  "detail.auction.ends": { en: "Ends", ar: "ينتهي" },
  "detail.spec.make": { en: "Make", ar: "الماركة" },
  "detail.spec.model": { en: "Model", ar: "الموديل" },
  "detail.spec.year": { en: "Year", ar: "السنة" },
  "detail.spec.body": { en: "Body", ar: "النوع" },
  "detail.spec.transmission": { en: "Transmission", ar: "الفتيس" },
  "detail.spec.color": { en: "Color", ar: "اللون" },
  "detail.spec.kilometrage": { en: "Kilometrage", ar: "الكيلومترات" },
  "detail.spec.status": { en: "Status", ar: "الحالة" },
  "detail.spec.reference": { en: "Reference", ar: "كود العربية" },
  "detail.spec.owner": { en: "Owner", ar: "البائع" },
  "detail.spec.firstSeen": { en: "First seen", ar: "ظهرت أول مرة" },
  "detail.spec.listed": { en: "Listed", ar: "اتعرضت" },
  "detail.cohort.model": { en: "model", ar: "موديل" },
  "detail.cohort.modelYear": { en: "model + year", ar: "موديل + سنة" },
  "detail.cohort.refSize.kind.model": { en: "same-model listings", ar: "عربية بنفس الموديل" },
  "detail.cohort.refSize.kind.modelYear": { en: "same-year listings", ar: "عربية بنفس السنة" },

  // analysis bullet pip labels
  "bullet.pip.deal": { en: "deal", ar: "صفقة" },
  "bullet.pip.high": { en: "high", ar: "غالي" },
  "bullet.pip.mid": { en: "mid", ar: "متوسط" },
  "bullet.pip.value": { en: "value", ar: "قيمة" },
  "bullet.pip.pricey": { en: "pricey", ar: "غالي" },
  "bullet.pip.lowKm": { en: "low-km", ar: "كم قليلة" },
  "bullet.pip.highKm": { en: "high-km", ar: "كم عالية" },
  "bullet.pip.km": { en: "km", ar: "كم" },
  "bullet.pip.hot": { en: "hot", ar: "نشط" },
  "bullet.pip.warm": { en: "warm", ar: "متوسط" },
  "bullet.pip.cold": { en: "cold", ar: "هادي" },
  "bullet.pip.fresh": { en: "fresh", ar: "جديدة" },
  "bullet.pip.daysListed": { en: "{n}d", ar: "{n} يوم" },
  "bullet.pip.marginPct": { en: "{pct}%", ar: "{pct}٪" },

  // analysis bullet text
  "bullet.priceCheaper": {
    en: "Cheaper than {pct}% of the {n} {kind} listings.",
    ar: "أرخص من {pct}٪ من {n} {kind}.",
  },
  "bullet.ppkmBetter": {
    en: "Better EGP-per-km than {pct}% of the cohort ({ppkm} EGP/km).",
    ar: "نسبة جنيه-للكيلو أحسن من {pct}٪ من العربيات المماثلة ({ppkm} جنيه/كم).",
  },
  "bullet.kmLower": {
    en: "Lower kilometrage than {pct}% of the cohort.",
    ar: "كيلومتراتها أقل من {pct}٪ من العربيات المماثلة.",
  },
  "bullet.marginLow": {
    en: "Sylndr's margin is thin — listing price is close to wholesale.",
    ar: "هامش سيلندر ضعيف — السعر المعروض قريب من سعر الجملة.",
  },
  "bullet.marginHigh": {
    en: "Sylndr is taking a fat margin on this one — room to push back on auction.",
    ar: "سيلندر شايلة هامش كبير على العربية دي — في مجال للمفاوضة في المزاد.",
  },
  "bullet.marginMid": {
    en: "Sylndr's margin is in the normal band.",
    ar: "هامش سيلندر في المعدل الطبيعي.",
  },
  "bullet.auctionHot": {
    en: "Auction is heating up — multiple bidders or already being sold.",
    ar: "المزاد سخن — في كذا مزايد أو بدأ يتباع فعلاً.",
  },
  "bullet.auctionWarm": {
    en: "Some auction activity — at least one bid logged.",
    ar: "في حركة على المزاد — على الأقل مزايدة واحدة.",
  },
  "bullet.auctionCold": {
    en: "Quiet auction — no bids yet.",
    ar: "المزاد هادي — مفيش مزايدات لحد دلوقتي.",
  },
  "bullet.listedOld": {
    en: "Listed {n} days ago — has been sitting around.",
    ar: "معروضة من {n} يوم — قاعدة من زمان.",
  },
  "bullet.listedFresh": {
    en: "Listed in the last 24 hours.",
    ar: "اتعرضت خلال آخر ٢٤ ساعة.",
  },

  // summary verdict
  "summary.verdict.good": { en: "Looks like a fair-to-good deal", ar: "السعر يبان منطقي وعرض كويس" },
  "summary.verdict.high": { en: "Trends expensive", ar: "السعر يميل للارتفاع" },
  "summary.verdict.fair": { en: "Sits in the middle of the pack", ar: "في وسط العربيات المماثلة" },
  "summary.cohortLine.yes": { en: "vs {n} {kind} listings", ar: "بمقارنة مع {n} {kind}" },
  "summary.cohortLine.none": { en: "no cohort yet", ar: "مفيش مقارنات لحد دلوقتي" },
  "summary.suffix.ageFresh": { en: ", listed within the day", ar: "، اتعرضت في آخر يوم" },
  "summary.suffix.ageOld": { en: ", has been listed for over a month", ar: "، قاعدة معروضة من أكتر من شهر" },
  "summary.suffix.heatHot": { en: ", auction is active", ar: "، المزاد نشط" },
  "summary.suffix.marginLow": { en: ", thin Sylndr margin", ar: "، هامش سيلندر ضعيف" },
  "summary.suffix.marginHigh": { en: ", generous Sylndr margin", ar: "، هامش سيلندر كبير" },
  "summary.template": {
    en: "{verdict} for the {year}{title} {cohortLine}{ageSuffix}{heatSuffix}{marginSuffix}.",
    ar: "{verdict} لعربية {year}{title} {cohortLine}{ageSuffix}{heatSuffix}{marginSuffix}.",
  },

  // deal tag on detail page
  "detail.deal.good": { en: "looks fair", ar: "سعرها معقول" },
  "detail.deal.high": { en: "trends pricey", ar: "سعرها عالي" },
  "detail.deal.fair": { en: "middle of pack", ar: "متوسطة" },

  // gallery + misc
  "gallery.empty": { en: "no photos", ar: "مفيش صور" },
  "card.noPhoto": { en: "no photo", ar: "مفيش صورة" },

  // footer
  "footer.listings": { en: "{n} listings · filter and sort via the bar above", ar: "{n} عربية · استخدم الفلاتر فوق للترتيب والبحث" },
  "footer.data": { en: "data", ar: "البيانات من" },
  "footer.source": { en: "source", ar: "المصدر" },
  "footer.vehicleId": { en: "vehicle id {id}", ar: "كود العربية {id}" },

  // empty state
  "empty.title": { en: "No listings yet", ar: "مفيش عربيات لحد دلوقتي" },
  "empty.sub": { en: "The next cron run will seed the watch list.", ar: "الجولة الجاية هتجيب قائمة العربيات." },

  // page title
  "page.title.index": { en: "Sylndr alerts · {n} listings", ar: "تنبيهات سيلندر · {n} عربية" },
  "page.title.detail": { en: "{year} {title} · Sylndr alerts", ar: "{year} {title} · تنبيهات سيلندر" },
  "page.description.index": { en: "Browse and filter Sylndr (Egypt) used-car inventory with cohort analysis on every listing.", ar: "تصفّح وفلتر عربيات سيلندر (مصر) مع تحليل ومقارنة لكل عربية." },

  // INSPECTION REPORT
  "inspection.section": { en: "Inspection report", ar: "تقرير الفحص" },
  "inspection.section.sub": { en: "from Sylndr's inspection team", ar: "من فريق الفحص الفنّي لسيلندر" },
  "inspection.empty": { en: "No inspection report on this listing yet.", ar: "لسه مفيش تقرير فحص للعربية دي." },
  "inspection.overview.title": { en: "Overall condition", ar: "الحالة العامة" },
  "inspection.overview.points": { en: "{ok} of {total} points clean", ar: "{ok} من {total} نقطة سليمة" },
  "inspection.overview.flagged": { en: "{n} flagged", ar: "{n} ملاحظة" },
  "inspection.severity.clean": { en: "clean", ar: "نظيفة" },
  "inspection.severity.minor": { en: "minor issues", ar: "ملاحظات بسيطة" },
  "inspection.severity.many": { en: "many issues", ar: "ملاحظات كتيرة" },
  "inspection.findings.title": { en: "Inspector findings", ar: "ملاحظات الفاحص" },
  "inspection.findings.toggle.show": { en: "Show OK items", ar: "اعرض النقاط السليمة" },
  "inspection.findings.toggle.hide": { en: "Hide OK items", ar: "اخفي النقاط السليمة" },
  "inspection.finding.faulty": { en: "issue", ar: "ملاحظة" },
  "inspection.finding.ok": { en: "ok", ar: "سليم" },
  "inspection.finding.note": { en: "Inspector note", ar: "ملاحظة الفاحص" },
  "inspection.section.empty": { en: "Nothing flagged in this section.", ar: "مفيش ملاحظات في القسم ده." },

  // CAR FEATURES
  "features.section": { en: "Car features", ar: "مميّزات العربية" },
  "features.section.sub": { en: "spec sheet", ar: "ورقة المواصفات" },
  "features.yes": { en: "Yes", ar: "نعم" },
  "features.no": { en: "No", ar: "لا" },
} as const satisfies Record<string, Record<Locale, string>>;

export type StringKey = keyof typeof STRINGS;

function interp(template: string, args?: Args): string {
  if (!args) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) => {
    const v = args[k];
    return v == null ? "" : String(v);
  });
}

export function t(locale: Locale, key: StringKey, args?: Args): string {
  const row = STRINGS[key];
  const tpl = row?.[locale] ?? row?.en ?? key;
  return interp(tpl, args);
}

/** Plural picker. count picks 'one' vs 'many'. */
export function tPlural(locale: Locale, oneKey: StringKey, manyKey: StringKey, n: number): string {
  return t(locale, n === 1 ? oneKey : manyKey, { n });
}

/** Relative time, locale-aware. */
export function tRelative(locale: Locale, iso: string): string {
  const t0 = new Date(iso).getTime();
  const dt = Date.now() - t0;
  const min = Math.floor(dt / 60_000);
  if (min < 1) return t(locale, "rel.justNow");
  if (min < 60) return t(locale, "rel.minutes", { n: min });
  const hr = Math.floor(min / 60);
  if (hr < 24) return t(locale, "rel.hours", { n: hr });
  const day = Math.floor(hr / 24);
  if (day < 30) return t(locale, "rel.days", { n: day });
  const mo = Math.floor(day / 30);
  return t(locale, "rel.months", { n: mo });
}

/** Per-locale paths from the index page. */
export function detailUrl(locale: Locale, id: string): string {
  return `v/${id}.html`;
}

/** Per-locale paths from a detail page back to the index. */
export function indexUrlFromDetail(): string {
  return "../index.html";
}

/** Per-locale paths from the index to the shared stylesheet. */
export function assetUrlFromIndex(locale: Locale, file: string): string {
  return locale === "en" ? `assets/${file}` : `../assets/${file}`;
}

/** Per-locale paths from a detail page to the shared stylesheet. */
export function assetUrlFromDetail(locale: Locale, file: string): string {
  return locale === "en" ? `../assets/${file}` : `../../assets/${file}`;
}

/** Link to the alternate locale from any page. */
export function altLocaleHref(args: {
  page: "index" | "detail";
  current: Locale;
  vehicleId?: string;
}): string {
  const { page, current, vehicleId } = args;
  const other: Locale = current === "en" ? "ar" : "en";
  if (page === "index") {
    if (current === "en" && other === "ar") return "ar/index.html";
    if (current === "ar" && other === "en") return "../index.html";
  } else {
    if (!vehicleId) return current === "en" ? "../index.html" : "../../index.html";
    if (current === "en" && other === "ar") return `../ar/v/${vehicleId}.html`;
    if (current === "ar" && other === "en") return `../../v/${vehicleId}.html`;
  }
  return "#";
}

/** Locale-aware label for the alternate-language toggle. Shows the target language's name. */
export function altLocaleLabel(current: Locale): string {
  return current === "en" ? "العربية" : "English";
}
