import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Filters } from "./types.ts";
import { fetchAllMatching } from "./fetch.ts";
import { diffAndPersist } from "./diff.ts";
import { writeDocsIndex } from "./render.ts";
import { sendEmail } from "./email.ts";
import { sendNtfy } from "./ntfy.ts";

const ROOT = new URL("..", import.meta.url).pathname;
const FILTERS_PATH = join(ROOT, "filters.json");
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
  const filters = JSON.parse(await readFile(FILTERS_PATH, "utf-8")) as Filters;
  console.log(`[poll] starting @ ${new Date().toISOString()}`);
  console.log(`[poll] filters: ${JSON.stringify(filters)}`);

  let items;
  try {
    items = await fetchAllMatching(filters);
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

  const n = await writeDocsIndex();
  console.log(`[poll] rendered docs/index.html with ${n} snapshots`);
  console.log(`[poll] done`);
}

main().catch((err) => {
  console.error("[poll] fatal:", err);
  process.exit(1);
});
