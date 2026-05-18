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
  endsAt?: string | null;
  publishedAt?: string | null;
} | null;

export type SylndrItem = {
  vehicle: SylndrVehicle;
  auction?: SylndrAuction;
  installmentPrice?: number | null;
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
