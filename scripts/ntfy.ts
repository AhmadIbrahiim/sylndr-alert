import type { SylndrItem } from "./types.ts";
import { retailPrice } from "./types.ts";

const NTFY_BASE = "https://ntfy.sh";

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
      message: `Now watching ${payload.seedCount ?? 0} listings. Future runs will notify when new ones appear.`,
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
    return {
      title: `New Sylndr listing: ${listingTitle(it)}`,
      message: `${fmtPrice(retailPrice(it))} · ${it.vehicle.kilometrage ?? "?"} km${beingSold ? " · 🔥 in auction" : ""}`,
      click: listingUrl(it),
      tags: beingSold ? ["fire", "car"] : ["car"],
      priority: beingSold ? 4 : 3,
    };
  }
  const lines = items
    .slice(0, 10)
    .map((it) => `• ${listingTitle(it)} — ${fmtPrice(retailPrice(it))}`);
  if (items.length > 10) lines.push(`...and ${items.length - 10} more`);
  return {
    title: `${items.length} new Sylndr listings`,
    message: lines.join("\n"),
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
