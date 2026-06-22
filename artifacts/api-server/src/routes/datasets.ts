import { Router, type IRouter } from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";
import fsp from "node:fs/promises";
import path from "node:path";
import {
  addDataset,
  listDatasets,
  deleteDataset,
  type DatasetMeta,
} from "../lib/llm/store.js";
import { tokenize } from "../lib/llm/tokenizer.js";

const TEXT_EXTS = new Set([
  "txt", "md", "json", "csv", "log", "html", "htm", "xml", "yml", "yaml",
  "js", "ts", "tsx", "jsx", "py", "go", "rs", "java", "c", "h", "cpp", "css",
]);

const router: IRouter = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB per file in-app
});

function classify(filename: string): DatasetMeta["type"] {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  if (["js", "ts", "tsx", "jsx", "py", "go", "rs", "java", "c", "cpp", "json"].includes(ext))
    return "code";
  if (ext === "pdf") return "pdf";
  if (["md", "txt", "doc", "docx", "rtf"].includes(ext)) return "docs";
  if (["html", "htm", "xml"].includes(ext)) return "web";
  return "other";
}

router.get("/datasets", async (_req, res): Promise<void> => {
  res.json({ datasets: await listDatasets() });
});

router.post(
  "/datasets/upload",
  upload.array("files", 50),
  async (req, res): Promise<void> => {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (files.length === 0) {
      res.status(400).json({ error: "No files uploaded" });
      return;
    }

    const created: DatasetMeta[] = [];
    for (const file of files) {
      const content = file.buffer.toString("utf8");
      const tokens = tokenize(content);
      const meta: DatasetMeta = {
        id: randomUUID(),
        name: file.originalname,
        type: classify(file.originalname),
        sizeBytes: file.size,
        tokens: tokens.length,
        createdAt: new Date().toISOString(),
      };
      await addDataset(meta, content);
      created.push(meta);
      req.log.info({ name: meta.name, tokens: meta.tokens }, "Dataset added");
    }

    res.status(201).json({ datasets: created });
  },
);

/**
 * Desktop-only: ingest text/code files from a local folder path chosen via the
 * native file dialog. Walks the directory (bounded) so the renderer never has
 * to stream large files through the browser.
 */
router.post("/datasets/ingest-path", async (req, res): Promise<void> => {
  // Hard gate: this route reads from the server filesystem, so it is only
  // available in the packaged desktop app (where the server runs locally on the
  // user's own machine). In web/API mode it must never be reachable.
  if (process.env.ABBY_DESKTOP !== "1") {
    res.status(403).json({ error: "Path ingest is only available in the desktop app" });
    return;
  }

  const target = typeof req.body?.path === "string" ? req.body.path : "";
  if (!target) {
    res.status(400).json({ error: "path is required" });
    return;
  }

  const MAX_FILES = 500;
  const MAX_FILE_BYTES = 20 * 1024 * 1024;
  const collected: string[] = [];

  async function walk(dir: string): Promise<void> {
    if (collected.length >= MAX_FILES) return;
    let entries;
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (collected.length >= MAX_FILES) break;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
        await walk(full);
      } else {
        const ext = entry.name.toLowerCase().split(".").pop() ?? "";
        if (TEXT_EXTS.has(ext)) collected.push(full);
      }
    }
  }

  const stat = await fsp.stat(target).catch(() => null);
  if (!stat) {
    res.status(400).json({ error: "Path not found" });
    return;
  }
  if (stat.isDirectory()) {
    await walk(target);
  } else {
    // Single-file target must pass the same allowlist as files found by walk().
    const ext = path.basename(target).toLowerCase().split(".").pop() ?? "";
    if (!TEXT_EXTS.has(ext)) {
      res.status(400).json({ error: "Unsupported file type" });
      return;
    }
    collected.push(target);
  }

  const created: DatasetMeta[] = [];
  for (const file of collected) {
    try {
      const stats = await fsp.stat(file);
      if (stats.size > MAX_FILE_BYTES) continue;
      const content = await fsp.readFile(file, "utf8");
      const tokens = tokenize(content);
      if (tokens.length === 0) continue;
      const meta: DatasetMeta = {
        id: randomUUID(),
        name: path.basename(file),
        type: classify(file),
        sizeBytes: stats.size,
        tokens: tokens.length,
        createdAt: new Date().toISOString(),
      };
      await addDataset(meta, content);
      created.push(meta);
    } catch {
      /* skip unreadable files */
    }
  }

  req.log.info({ count: created.length, from: target }, "Ingested local path");
  res.status(201).json({ datasets: created });
});

router.post("/datasets/text", async (req, res): Promise<void> => {
  const { name, content } = req.body ?? {};
  if (typeof content !== "string" || content.trim().length === 0) {
    res.status(400).json({ error: "content is required" });
    return;
  }
  const tokens = tokenize(content);
  const meta: DatasetMeta = {
    id: randomUUID(),
    name: typeof name === "string" && name ? name : "pasted-text.txt",
    type: "docs",
    sizeBytes: Buffer.byteLength(content),
    tokens: tokens.length,
    createdAt: new Date().toISOString(),
  };
  await addDataset(meta, content);
  res.status(201).json({ dataset: meta });
});

router.delete("/datasets/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  await deleteDataset(raw);
  res.sendStatus(204);
});

export default router;
