import type { SylndrItem } from "./types.ts";
import { retailPrice, sylndrMargin, auctionInfo } from "./types.ts";

const NTFY_BASE = "https://ntfy.sh";
const DASHBOARD_URL = "https://ahmadibrahiim.github.io/sylndr-alert/";

type NtfyKind = "new" | "seed" | "broken";

function fmtPrice(n: number): string {
  if (!n) return "—";
  return new Intl.NumberFormat("en-US").format(n) + " EGP";
}

function listingTitle(item: SylndrItem): string {
  const v = item.vehicle;
  return `${v.carYear?.name ?? ""} ${v.carMake?.name ?? ""} ${v.carModel?.name ?? ""}`.trim();
}

function listingUrl(item: SylndrItem): string {
  return `https://sylndr.com/en/buy-cars/${item.vehicle.id}`;
}

function buildPayload(kind: NtfyKind, payload: { items?: SylndrItem[]; message?: string; seedCount?: number }) {
  if (kind === "seed") {
    return {
      title: "Sylndr alerts seeded",
      message: `Now tracking ${payload.seedCount ?? 0} listings. Future runs will notify when new ones appear.`,
      click: DASHBOARD_URL,
      tags: ["white_check_mark"],
      priority: 3,
    };
  }
  if (kind === "broken") {
    return {
      title: "Sylndr scraper broken",
      message: payload.message ?? "Unknown failure",
      tags: ["warning"],
      priority: 4,
    };
  }
  const items = payload.items ?? [];
  if (items.length === 1) {
    const it = items[0];
    const beingSold = it.auction?.status === "BEING_SOLD";
    const margin = sylndrMargin(it);
    const auction = auctionInfo(it);
    const retail = retailPrice(it);
    const lines = [`${fmtPrice(retail)} EGP · ${it.vehicle.kilometrage ?? "?"} km`];
    if (auction?.winnerAmount && retail > 0) {
      const disc = Math.round((1 - auction.winnerAmount / retail) * 100);
      lines.push(`sold at ${fmtPrice(auction.winnerAmount)} (${disc}% under)`);
    } else if (margin) {
      lines.push(`Sylndr margin: ${margin.pct.toFixed(0)}%`);
    }
    if (auction && auction.bids > 0 && !auction.winnerAmount) {
      lines.push(`${auction.bids} bids · ${auction.bidders} bidders`);
    }
    return {
      title: `${beingSold ? "🔥 Sold" : "New"} Sylndr: ${listingTitle(it)}`,
      message: lines.join(" · "),
      click: listingUrl(it),
      tags: beingSold ? ["fire", "car"] : ["car"],
      priority: beingSold ? 4 : 3,
    };
  }
  // Highlight the 5 most interesting (BEING_SOLD first, then highest margin)
  const ranked = [...items].sort((a, b) => {
    const score = (it: SylndrItem) => {
      const sold = it.auction?.status === "BEING_SOLD" ? 1_000_000 : 0;
      const m = sylndrMargin(it);
      return sold + (m?.pct ?? 0);
    };
    return score(b) - score(a);
  });
  const top = ranked.slice(0, 5);
  const lines = top.map((it) => {
    const sold = it.auction?.status === "BEING_SOLD" ? " 🔥" : "";
    return `• ${listingTitle(it)} — ${fmtPrice(retailPrice(it))}${sold}`;
  });
  if (items.length > top.length) lines.push(`+ ${items.length - top.length} more`);
  return {
    title: `${items.length} new Sylndr listings`,
    message: lines.join("\n"),
    click: DASHBOARD_URL,
    tags: ["car", "bell"],
    priority: 3,
  };
}

export async function sendNtfy(
  kind: NtfyKind,
  payload: { items?: SylndrItem[]; message?: string; seedCount?: number },
): Promise<void> {
  const topic = process.env.NTFY_TOPIC;
  if (!topic) {
    console.log(`[ntfy] NTFY_TOPIC not set — skipping ${kind} notification (dry-run)`);
    return;
  }
  const p = buildPayload(kind, payload);
  const headers: Record<string, string> = {
    "Content-Type": "text/plain; charset=utf-8",
    Title: p.title,
    Tags: (p.tags ?? []).join(","),
    Priority: String(p.priority ?? 3),
  };
  if ("click" in p && p.click) headers.Click = p.click;
  const res = await fetch(`${NTFY_BASE}/${encodeURIComponent(topic)}`, {
    method: "POST",
    headers,
    body: p.message,
  });
  if (!res.ok) {
    throw new Error(`ntfy.sh ${res.status} ${res.statusText}`);
  }
  console.log(`[ntfy] sent ${kind} to topic`);
}
