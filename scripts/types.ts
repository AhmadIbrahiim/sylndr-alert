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
   *  Number() coercion. `vehicle.netSylndrOfferPrice` is Sylndr's wholesale
   *  cost (what they paid the seller) — not the buyer-facing price. */
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

export function wholesalePrice(item: SylndrItem): number {
  return item.vehicle.netSylndrOfferPrice ?? 0;
}

export function askingPrice(item: SylndrItem): number {
  return item.vehicle.askingPrice ?? 0;
}

export type Margin = { abs: number; pct: number } | null;
export function sylndrMargin(item: SylndrItem): Margin {
  const retail = retailPrice(item);
  const wholesale = wholesalePrice(item);
  if (retail <= 0 || wholesale <= 0) return null;
  const abs = retail - wholesale;
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

export type SylndrItem = {
  vehicle: SylndrVehicle;
  auction?: SylndrAuction;
  installmentPrice?: number | null;
  vehicleOwner?: SylndrVehicleOwner;
};

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
