import { Resend } from "resend";
import type { SylndrItem } from "./types.ts";
import { retailPrice } from "./types.ts";

const FROM = "Sylndr Alert <onboarding@resend.dev>";

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function pickPhoto(item: SylndrItem): string | null {
  const imgs = item.vehicle.images ?? [];
  const ext = imgs.find((i) => i.imageType === "EXTERIOR");
  return ext?.imageUrl ?? imgs[0]?.imageUrl ?? null;
}

function slug(s: string | null | undefined): string {
  if (!s) return "x";
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "x";
}

function listingUrl(item: SylndrItem): string {
  const make = slug(item.vehicle.carMake?.name);
  const model = slug(item.vehicle.carModel?.name);
  return `https://sylndr.com/en/car-details/used-cars/${make}/${model}/${item.vehicle.id}`;
}

function fmtRelative(iso: string): string {
  const dt = Date.now() - new Date(iso).getTime();
  const min = Math.floor(dt / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return `${Math.floor(day / 30)}mo ago`;
}

const EMAIL_BG = "#f6f5f1";
const CARD_BG = "#ffffff";
const FG = "#1a1a1d";
const FG_SOFT = "#444";
const MUTED = "#76767f";
const BORDER = "#e8e5df";
const ACCENT = "#d4501c";
const HOT = "#c83245";

function emailCard(item: SylndrItem): string {
  const v = item.vehicle;
  const year = v.carYear?.name ?? "";
  const title = `${v.carMake?.name ?? ""} ${v.carModel?.name ?? ""}`.trim() || "Unknown";
  const photo = pickPhoto(item);
  const url = listingUrl(item);
  const beingSold = item.auction?.status === "BEING_SOLD";
  const priceN = retailPrice(item);
  const price = priceN > 0 ? `${fmt(priceN)} EGP` : "—";
  const km = v.kilometrage ? `${fmt(Number(v.kilometrage))} km` : "—";
  const body = v.bodyStyle ?? "—";
  const trans = v.transmission ?? "—";

  const hotRibbon = beingSold
    ? `<span style="display:inline-block;background:${HOT};color:#fff;font-size:10px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;padding:3px 8px;border-radius:999px;margin-left:8px;vertical-align:middle">&#128293; in auction</span>`
    : "";

  const photoBlock = photo
    ? `<a href="${escapeHtml(url)}" style="display:block;background:#eee8de;text-decoration:none"><img src="${escapeHtml(photo)}" alt="${escapeHtml(title)}" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;border-radius:14px 14px 0 0" /></a>`
    : `<div style="height:200px;display:flex;align-items:center;justify-content:center;color:${MUTED};font-family:monospace;font-size:12px;background:#eee8de;border-radius:14px 14px 0 0">no photo</div>`;

  return `
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:0 0 16px;background:${CARD_BG};border:1px solid ${BORDER};border-radius:14px;overflow:hidden;border-collapse:separate;${beingSold ? `border-color:rgba(200,50,69,.3);` : ""}">
  <tr><td style="padding:0">${photoBlock}</td></tr>
  <tr>
    <td style="padding:16px 20px 18px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
      <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:${MUTED};letter-spacing:.04em;font-weight:600;margin-bottom:4px">
        ${escapeHtml(year)}${hotRibbon}
      </div>
      <a href="${escapeHtml(url)}" style="display:block;font-size:17px;font-weight:650;color:${FG};text-decoration:none;letter-spacing:-0.005em;margin-bottom:6px">${escapeHtml(title)}</a>
      <div style="font-size:24px;font-weight:700;color:${ACCENT};letter-spacing:-0.02em;line-height:1.1;margin-bottom:10px;font-variant-numeric:tabular-nums">
        ${escapeHtml(price)}<span style="font-size:12px;color:${MUTED};font-weight:600;letter-spacing:.04em;margin-left:4px">EGP</span>
      </div>
      <div style="font-size:13px;color:${FG_SOFT};font-variant-numeric:tabular-nums">
        <span>${escapeHtml(km)}</span>
        <span style="color:${MUTED};margin:0 6px">&middot;</span>
        <span>${escapeHtml(body)}</span>
        <span style="color:${MUTED};margin:0 6px">&middot;</span>
        <span>${escapeHtml(trans)}</span>
      </div>
      <div style="font-size:11px;color:${MUTED};font-family:ui-monospace,SFMono-Regular,Menlo,monospace;margin-top:8px">
        listed ${escapeHtml(fmtRelative(item.auction?.publishedAt ?? new Date().toISOString()))}
      </div>
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top:14px">
        <tr><td style="border-radius:10px;background:${ACCENT}">
          <a href="${escapeHtml(url)}" style="display:inline-block;padding:9px 16px;font-size:13px;font-weight:600;color:#fff;text-decoration:none;border-radius:10px;letter-spacing:.01em">View on Sylndr &rarr;</a>
        </td></tr>
      </table>
    </td>
  </tr>
</table>`;
}

function wrapEmail(opts: { title: string; subtitle: string; body: string }): string {
  return `<!doctype html>
<html><head><meta charset="utf-8" /><meta name="color-scheme" content="light only" /><title>${escapeHtml(opts.title)}</title></head>
<body style="margin:0;padding:0;background:${EMAIL_BG};color:${FG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;-webkit-font-smoothing:antialiased">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:${EMAIL_BG};padding:32px 16px">
  <tr><td align="center">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;width:100%">
      <tr><td style="padding:0 4px 20px">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0">
          <tr>
            <td valign="middle" style="padding-right:12px">
              <div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,${ACCENT} 0%,#a83e15 100%);text-align:center;font:700 18px/36px -apple-system,sans-serif;color:#fff">S</div>
            </td>
            <td valign="middle">
              <div style="font-size:18px;font-weight:700;color:${FG};letter-spacing:-0.01em;line-height:1.15">Sylndr alerts</div>
              <div style="font-size:12px;color:${MUTED};font-family:ui-monospace,SFMono-Regular,Menlo,monospace;line-height:1.15">${escapeHtml(opts.subtitle)}</div>
            </td>
          </tr>
        </table>
      </td></tr>
      <tr><td style="padding:0 4px 8px;font-size:14px;color:${FG_SOFT}">${opts.title}</td></tr>
      <tr><td>${opts.body}</td></tr>
      <tr><td align="center" style="padding:24px 4px 4px;color:${MUTED};font-size:11px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;border-top:1px solid ${BORDER};margin-top:24px">
        auto-generated by sylndr-alert
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

export function renderDigest(items: SylndrItem[]): { subject: string; html: string } {
  const cards = items.map(emailCard).join("\n");
  const subject =
    items.length === 1
      ? `New Sylndr listing: ${items[0].vehicle.carMake?.name ?? ""} ${items[0].vehicle.carModel?.name ?? ""}`.trim()
      : `${items.length} new Sylndr listings`;
  const title = `<strong style="color:${FG}">${items.length}</strong> new ${items.length === 1 ? "listing" : "listings"} matched your filter`;
  const subtitle = `${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`;
  return {
    subject,
    html: wrapEmail({ title, subtitle, body: cards }),
  };
}

type SendKind = "new" | "seed" | "broken";

export async function sendEmail(
  kind: SendKind,
  payload: { items?: SylndrItem[]; message?: string; seedCount?: number },
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.EMAIL_TO;
  if (!apiKey || !to) {
    console.log(`[email] RESEND_API_KEY or EMAIL_TO not set — skipping ${kind} email (dry-run)`);
    return;
  }
  const resend = new Resend(apiKey);

  let subject: string;
  let html: string;
  if (kind === "new") {
    const digest = renderDigest(payload.items ?? []);
    subject = digest.subject;
    html = digest.html;
  } else if (kind === "seed") {
    subject = `Sylndr alerts seeded (${payload.seedCount ?? 0} listings)`;
    const body = `<div style="background:${CARD_BG};border:1px solid ${BORDER};border-radius:14px;padding:20px 22px;font-size:14px;color:${FG_SOFT};line-height:1.55">
      Now watching <strong style="color:${FG};font-weight:650">${payload.seedCount ?? 0}</strong> listings.
      Future runs will email you when new ones appear.
    </div>`;
    html = wrapEmail({
      title: `Setup complete &mdash; you'll get an email when something new shows up.`,
      subtitle: new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC",
      body,
    });
  } else {
    subject = `Sylndr alert: scraper broken`;
    const safeMsg = escapeHtml(payload.message ?? "Unknown failure");
    const body = `<div style="background:${CARD_BG};border:1px solid ${BORDER};border-radius:14px;padding:20px 22px;font-size:14px;color:${FG_SOFT};line-height:1.55">
      The Sylndr scraper failed on 3 consecutive runs.
      <pre style="margin-top:12px;padding:12px;background:#1a1a1d;color:#f5f5f7;border-radius:8px;font-size:12px;overflow-x:auto;white-space:pre-wrap">${safeMsg}</pre>
    </div>`;
    html = wrapEmail({
      title: "Scraper failed 3 times in a row.",
      subtitle: new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC",
      body,
    });
  }

  const { error } = await resend.emails.send({ from: FROM, to, subject, html });
  if (error) {
    throw new Error(`Resend error: ${JSON.stringify(error)}`);
  }
  console.log(`[email] sent ${kind} to ${to}`);
}
