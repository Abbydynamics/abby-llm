// Bundles the Electron main + preload processes to CJS with esbuild.
import { build } from "esbuild";
import { rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const outdir = path.join(dir, "..", "dist-electron");

// Чистим прошлую сборку, чтобы не тащить устаревшие .js рядом с .cjs.
rmSync(outdir, { recursive: true, force: true });

await build({
  entryPoints: [
    path.join(dir, "main.ts"),
    path.join(dir, "preload.ts"),
  ],
  outdir,
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  outExtension: { ".js": ".cjs" },
  // electron и node-llama-cpp — нативные зависимости, не бандлим.
  external: ["electron", "node-llama-cpp"],
  sourcemap: false,
  logLevel: "info",
});

console.log("Electron main/preload bundled →", outdir);
