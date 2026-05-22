import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fetchAllMatching, FETCH_SCOPE } from "./fetch.ts";
import { diffAndPersist } from "./diff.ts";
import { writeAllDocs } from "./render.ts";
import { analyzeAll } from "./analyze.ts";
import { analyzeAiForItems } from "./analyze-ai.ts";
import { sendEmail } from "./email.ts";
import { sendNtfy } from "./ntfy.ts";

const ROOT = new URL("..", import.meta.url).pathname;
const FAIL_PATH = join(ROOT, "state", "failures.json");

async function readFailures(): Promise<number> {
  if (!existsSync(FAIL_PATH)) return 0;
  const raw = await readFile(FAIL_PATH, "utf-8");
  try {
    return (JSON.parse(raw) as { count: number }).count ?? 0;
  } catch {
    return 0;
  }
}

async function writeFailures(count: number): Promise<void> {
  await mkdir(join(ROOT, "state"), { recursive: true });
  await writeFile(FAIL_PATH, JSON.stringify({ count }) + "\n");
}

async function main(): Promise<void> {
  console.log(`[poll] starting @ ${new Date().toISOString()}`);
  console.log(`[poll] fetch scope: ${JSON.stringify(FETCH_SCOPE)}`);

  let items;
  try {
    items = await fetchAllMatching();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const failures = (await readFailures()) + 1;
    await writeFailures(failures);
    console.error(`[poll] fetch failed (${failures} consecutive): ${msg}`);
    if (failures === 3) {
      await Promise.allSettled([
        sendEmail("broken", { message: msg }).catch((e) =>
          console.error(`[poll] failure-email also failed: ${e}`),
        ),
        sendNtfy("broken", { message: msg }).catch((e) =>
          console.error(`[poll] failure-ntfy also failed: ${e}`),
        ),
      ]);
    }
    process.exit(1);
  }

  await writeFailures(0);
  console.log(`[poll] fetched ${items.length} vehicles`);

  const diff = await diffAndPersist(items);
  console.log(
    `[poll] ${diff.seedRun ? "SEED run" : "steady-state run"}; new=${diff.newItems.length}; totalSeen=${diff.totalSeen}`,
  );

  if (diff.seedRun) {
    await Promise.allSettled([
      sendEmail("seed", { seedCount: items.length }),
      sendNtfy("seed", { seedCount: items.length }),
    ]);
  } else if (diff.newItems.length > 0) {
    await Promise.allSettled([
      sendEmail("new", { items: diff.newItems }),
      sendNtfy("new", { items: diff.newItems }),
    ]);
  } else {
    console.log("[poll] no new listings — no notifications");
  }

  const analyzed = await analyzeAll();
  console.log(`[poll] analyzed ${analyzed} snapshots (heuristic cohort stats)`);

  if (diff.newItems.length > 0) {
    try {
      await analyzeAiForItems(diff.newItems);
    } catch (err) {
      console.error(`[poll] AI analysis failed (continuing): ${err instanceof Error ? err.message : err}`);
    }
  }

  const out = await writeAllDocs();
  console.log(`[poll] rendered docs/index.html (${out.index} listings) + ${out.details} detail pages`);
  console.log(`[poll] done`);
}

main().catch((err) => {
  console.error("[poll] fatal:", err);
  process.exit(1);
});
