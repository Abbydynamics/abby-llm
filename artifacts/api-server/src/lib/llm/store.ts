/**
 * Filesystem storage for datasets and model checkpoints.
 * Resolves paths from the workspace root so dev and prod match.
 */

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { type AbbyLMState } from "./model.js";

const workspaceRoot = process.cwd().endsWith(path.join("artifacts", "api-server"))
  ? path.resolve(process.cwd(), "../..")
  : process.cwd();

// In the packaged desktop app the engine writes to a per-user writable
// directory passed via ABBY_DATA_DIR; on Replit it falls back to the repo path.
export const DATA_DIR = process.env["ABBY_DATA_DIR"]
  ? path.resolve(process.env["ABBY_DATA_DIR"])
  : path.resolve(workspaceRoot, "artifacts/api-server/data");
export const DATASETS_DIR = path.join(DATA_DIR, "datasets");
export const MODELS_DIR = path.join(DATA_DIR, "models");

export function ensureDirs(): void {
  for (const d of [DATA_DIR, DATASETS_DIR, MODELS_DIR]) {
    fs.mkdirSync(d, { recursive: true });
  }
}

export interface DatasetMeta {
  id: string;
  name: string;
  type: "code" | "pdf" | "docs" | "web" | "other";
  sizeBytes: number;
  tokens: number;
  createdAt: string;
}

const META_FILE = path.join(DATA_DIR, "datasets.json");

export async function listDatasets(): Promise<DatasetMeta[]> {
  try {
    const raw = await fsp.readFile(META_FILE, "utf8");
    return JSON.parse(raw) as DatasetMeta[];
  } catch {
    return [];
  }
}

export async function saveDatasets(list: DatasetMeta[]): Promise<void> {
  await fsp.writeFile(META_FILE, JSON.stringify(list, null, 2));
}

export async function addDataset(
  meta: DatasetMeta,
  content: string,
): Promise<void> {
  ensureDirs();
  await fsp.writeFile(path.join(DATASETS_DIR, `${meta.id}.txt`), content);
  const list = await listDatasets();
  list.push(meta);
  await saveDatasets(list);
}

export async function readDatasetContent(id: string): Promise<string> {
  return fsp.readFile(path.join(DATASETS_DIR, `${id}.txt`), "utf8");
}

export async function deleteDataset(id: string): Promise<void> {
  try {
    await fsp.unlink(path.join(DATASETS_DIR, `${id}.txt`));
  } catch {
    /* ignore */
  }
  const list = (await listDatasets()).filter((d) => d.id !== id);
  await saveDatasets(list);
}

export async function readAllDatasetText(): Promise<string> {
  const list = await listDatasets();
  const parts: string[] = [];
  for (const d of list) {
    try {
      parts.push(await readDatasetContent(d.id));
    } catch {
      /* skip missing */
    }
  }
  return parts.join("\n\n");
}

// ---- Model checkpoints ----

export async function saveModel(name: string, state: AbbyLMState): Promise<void> {
  ensureDirs();
  await fsp.writeFile(
    path.join(MODELS_DIR, `${name}.json`),
    JSON.stringify(state),
  );
}

export async function loadModel(name: string): Promise<AbbyLMState | null> {
  try {
    const raw = await fsp.readFile(path.join(MODELS_DIR, `${name}.json`), "utf8");
    return JSON.parse(raw) as AbbyLMState;
  } catch {
    return null;
  }
}

export async function listModelNames(): Promise<string[]> {
  ensureDirs();
  const files = await fsp.readdir(MODELS_DIR);
  return files.filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, ""));
}
