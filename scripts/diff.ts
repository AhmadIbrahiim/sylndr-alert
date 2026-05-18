import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Snapshot, SylndrItem } from "./types.ts";

const ROOT = new URL("..", import.meta.url).pathname;
const SEEN_PATH = join(ROOT, "state", "seen.json");
const SNAPSHOT_DIR = join(ROOT, "snapshots");

export type DiffResult = {
  seedRun: boolean;
  newItems: SylndrItem[];
  totalSeen: number;
};

export async function loadSeen(): Promise<Set<string> | null> {
  if (!existsSync(SEEN_PATH)) return null;
  const raw = await Bun.file(SEEN_PATH).text();
  const ids = JSON.parse(raw) as string[];
  return new Set(ids);
}

export async function saveSeen(seen: Set<string>): Promise<void> {
  await mkdir(dirname(SEEN_PATH), { recursive: true });
  const sorted = [...seen].sort();
  await writeFile(SEEN_PATH, JSON.stringify(sorted, null, 2) + "\n");
}

export async function writeSnapshot(item: SylndrItem, firstSeen: string): Promise<void> {
  await mkdir(SNAPSHOT_DIR, { recursive: true });
  const snap: Snapshot = { ...item, firstSeen };
  const path = join(SNAPSHOT_DIR, `${item.vehicle.id}.json`);
  await writeFile(path, JSON.stringify(snap, null, 2) + "\n");
}

export async function diffAndPersist(items: SylndrItem[]): Promise<DiffResult> {
  const existing = await loadSeen();
  const seedRun = existing === null;
  const seen = existing ?? new Set<string>();
  const now = new Date().toISOString();

  const newItems: SylndrItem[] = [];
  for (const item of items) {
    const id = item.vehicle.id;
    if (!seen.has(id)) {
      seen.add(id);
      await writeSnapshot(item, now);
      if (!seedRun) newItems.push(item);
    }
  }
  await saveSeen(seen);
  return { seedRun, newItems, totalSeen: seen.size };
}
