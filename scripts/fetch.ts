import type { Filters, SylndrItem, SylndrResponse } from "./types.ts";

const API_URL = "https://sylndr.com/api/market/vehicles";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36";
const PAGE_TIMEOUT_MS = 30_000;
const MAX_PAGES = 100;
const PAGE_SIZE = 20;
const PAGE_DELAY_MS = 250;
const RETRY = 3;
const RETRY_BACKOFF_MS = 1500;

/** The broadcast-broad fetch scope: every listing currently for sale on
 *  Sylndr. Filter narrowing is done client-side in the dashboard. */
export const FETCH_SCOPE: Filters = {
  size: PAGE_SIZE,
  auctionStatuses: ["PUBLISHED", "BEING_SOLD"],
};

async function fetchPage(filters: Filters, page: number): Promise<SylndrResponse> {
  const body = { ...filters, page };
  let lastErr: unknown;
  for (let attempt = 1; attempt <= RETRY; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PAGE_TIMEOUT_MS);
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          accept: "*/*",
          "content-type": "application/json",
          origin: "https://sylndr.com",
          referer: "https://sylndr.com/",
          "user-agent": UA,
          "x-client-source": "Retail",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`Sylndr API ${res.status} ${res.statusText}`);
      return (await res.json()) as SylndrResponse;
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      if (attempt < RETRY) {
        await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS * attempt));
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export async function fetchAllMatching(filters: Filters = FETCH_SCOPE): Promise<SylndrItem[]> {
  const all: SylndrItem[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await fetchPage(filters, page);
    all.push(...res.items);
    if (!res.hasNextPage || res.items.length === 0) break;
    if (PAGE_DELAY_MS > 0) {
      await new Promise((r) => setTimeout(r, PAGE_DELAY_MS));
    }
  }
  return all;
}

if (import.meta.main) {
  const items = await fetchAllMatching();
  console.log(`fetched ${items.length} vehicles (scope=all PUBLISHED/BEING_SOLD)`);
}
