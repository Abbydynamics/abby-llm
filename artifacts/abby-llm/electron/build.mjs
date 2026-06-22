// Bundles the Electron main + preload processes to CJS with esbuild.
import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const outdir = path.join(dir, "..", "dist-electron");

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
  external: ["electron"],
  sourcemap: false,
  logLevel: "info",
});

console.log("Electron main/preload bundled →", outdir);
