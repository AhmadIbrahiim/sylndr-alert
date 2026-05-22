export type Filters = {
  size: number;
  maxKilometrage?: number;
  minKilometrage?: number;
  minPrice?: number;
  maxPrice?: number;
  transmissions?: string[];
  bodyStyles?: string[];
  minEmi?: number | null;
  maxEmi?: number | null;
  auctionStatuses?: string[];
};

export type SylndrImage = { imageUrl: string; imageType: string };

export type SylndrVehicle = {
  id: string;
  salesforceName: string | null;
  netSylndrOfferPrice: number;
  askingPrice: number;
  bodyStyle: string | null;
  carMake: { name: string; arName?: string } | null;
  carModel: { name: string; arName?: string } | null;
  carYear: { name: string } | null;
  color: string | null;
  transmission: string | null;
  kilometrage: string | null;
  currentStatus: string | null;
  images: SylndrImage[];
};

export type SylndrAuction = {
  id?: string;
  status?: string;
  type?: string;
  startsAt?: string | null;
  endsAt?: string | null;
  publishedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  /** Despite the name, this is the consumer-facing retail price displayed on
   *  Sylndr's listing page (e.g. "850000.00"). It is a string and may need
   *  Number() coercion. `vehicle.netSylndrOfferPrice` is Sylndr's *market
   *  price estimate* (what they think the car is worth on the open market),
   *  NOT what they paid the seller. */
  maxPriceLimit?: string | null;
  initialPrice?: string | null;
  incrementValue?: string | null;
  winnerSubmissionAmount?: string | null;
  totalSubmissions?: number | null;
  totalUniqueSubmitters?: number | null;
  category?: string | null;
} | null;

export function retailPrice(item: SylndrItem): number {
  const s = item.auction?.maxPriceLimit;
  if (s) {
    const n = Number(s);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return item.vehicle.netSylndrOfferPrice ?? 0;
}

/** Sylndr's market price estimate — what they think the car is worth on the
 *  open market. NOT what they paid the seller. */
export function marketPrice(item: SylndrItem): number {
  return item.vehicle.netSylndrOfferPrice ?? 0;
}

export function askingPrice(item: SylndrItem): number {
  return item.vehicle.askingPrice ?? 0;
}

/** Premium (or discount) of Sylndr's retail price vs their market-price estimate.
 *  abs = retail - market; pct = abs / retail * 100.
 *  Positive pct = retail above market (buyer pays a premium).
 *  Negative pct = retail below market (priced below open-market value). */
export type MarketPremium = { abs: number; pct: number } | null;
export function marketPremium(item: SylndrItem): MarketPremium {
  const retail = retailPrice(item);
  const market = marketPrice(item);
  if (retail <= 0 || market <= 0) return null;
  const abs = retail - market;
  return { abs, pct: (abs / retail) * 100 };
}

export type AuctionInfo = {
  status: string;
  type: string | null;
  bids: number;
  bidders: number;
  startsAt: string | null;
  endsAt: string | null;
  winnerAmount: number | null;
  isLive: boolean;
};
export function auctionInfo(item: SylndrItem): AuctionInfo | null {
  const a = item.auction;
  if (!a) return null;
  const winner = a.winnerSubmissionAmount ? Number(a.winnerSubmissionAmount) : null;
  return {
    status: a.status ?? "UNKNOWN",
    type: a.type ?? null,
    bids: a.totalSubmissions ?? 0,
    bidders: a.totalUniqueSubmitters ?? 0,
    startsAt: a.startsAt ?? null,
    endsAt: a.endsAt ?? null,
    winnerAmount: Number.isFinite(winner as number) ? (winner as number) : null,
    isLive: a.status === "BEING_SOLD",
  };
}

export type SylndrVehicleOwner = {
  name?: string | null;
} | null;

export type SylndrInspectionAnswer = {
  id?: string;
  name: string;                 // Arabic question label
  nameEn: string | null;        // English question label
  value: string | null;         // Arabic answer
  valueEn: string | null;       // English answer
  comment: string | null;       // Arabic inspector free-text
  commentEn: string | null;     // English inspector free-text
  faulty: boolean | null;       // true = issue, false = ok, null = neutral/info
  answerType?: string | null;
  questionOrder?: number | null;
  originalSection?: string | null;
  hasAttachment?: boolean | null;
};

export type SylndrInspectionSection = {
  name: string;                 // Arabic section title
  nameEn: string;               // English section title
  order: number;
  answers: SylndrInspectionAnswer[];
};

export type SylndrInspectionReport = {
  sections: SylndrInspectionSection[];
} | null;

export type SylndrFeature = {
  name_en: string;
  name_ar: string;
  value_en: string;
  value_ar: string;
  order: number;
};

export type SylndrFeatureSection = {
  name_en: string;
  name_ar: string;
  order: number;
  features: SylndrFeature[];
};

export type SylndrCarFeatures = {
  sections: SylndrFeatureSection[];
} | null;

export type SylndrExtraInfo = {
  carFeatures?: SylndrCarFeatures;
} | null;

export type SylndrItem = {
  vehicle: SylndrVehicle;
  auction?: SylndrAuction;
  installmentPrice?: number | null;
  vehicleOwner?: SylndrVehicleOwner;
  inspectionReport?: SylndrInspectionReport;
  extraInfo?: SylndrExtraInfo;
};

function slug(s: string | null | undefined): string {
  if (!s) return "x";
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "x";
}

export function sylndrListingUrl(item: SylndrItem): string {
  const make = slug(item.vehicle.carMake?.name);
  const model = slug(item.vehicle.carModel?.name);
  return `https://sylndr.com/ar/car-details/used-cars/${make}/${model}/${item.vehicle.id}`;
}

export type SylndrResponse = {
  items: SylndrItem[];
  total: number;
  page: number;
  size: number;
  totalPages: number;
  hasNextPage: boolean;
};

export type Snapshot = SylndrItem & {
  firstSeen: string;
};
