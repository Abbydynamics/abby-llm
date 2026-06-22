---
name: Abby LLM desktop + model architecture
description: How the Electron desktop build and the in-app language model fit together.
---

## Desktop packaging
The Electron main process (artifacts/abby-llm/electron/main.ts) in production
forks the bundled api-server (server-dist/index.mjs) and that single Express
process serves BOTH `/api` AND the static React frontend (dist/public). So the
renderer loads one local origin (http://127.0.0.1:47615/) and all relative
`/api` calls work unchanged — no proxy, fully offline.

**Why:** avoids a second static server and keeps the frontend's existing
absolute `/api/...` fetch calls working without per-environment base URLs.

**How to apply:** api-server is dual-mode via env, set only by Electron:
- `ABBY_DATA_DIR` → where the engine writes datasets/checkpoints (userData dir).
- `ABBY_PUBLIC_DIR` → if set + exists, app.ts serves static + SPA fallback.
On Replit neither is set, so api-server behaves as a plain web API. Never make
these required.

## In-app model is real, not mock
The engine (artifacts/api-server/src/lib/llm) is a genuine interpolated n-gram
LM (trigram/bigram/unigram + smoothing) that trains on uploaded files in Node
without a GPU. The 67TB path is a separate real PyTorch GPT trainer at
artifacts/abby-llm/training/train_abby.py — that one needs the user's GPU.

## Installer build
`pnpm --filter @workspace/abby-llm run dist:win|mac|linux`. electron-builder
needs `executableName` set (scoped pkg name @workspace/abby-llm breaks AppImage
filenames). Linux AppImage build verified working in-sandbox (~136MB). Windows
.exe must be built on Windows.
