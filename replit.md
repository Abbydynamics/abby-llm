# Abby LLM

Abby LLM — десктоп-приложение (Electron) и веб-приложение в стиле IDE, внутри
которого работает **собственная языковая модель** пользователя. Никаких Ollama,
OpenAI или внешних API — модель реально обучается на загруженных файлах и
генерирует ответы на твоём железе.

## Run & Operate

- `pnpm --filter @workspace/abby-llm run dev` — фронтенд Abby (Vite)
- `pnpm --filter @workspace/api-server run dev` — API + языковой движок (порт из PORT)
- `pnpm --filter @workspace/abby-llm run typecheck` — типчек фронтенда + Electron
- `pnpm --filter @workspace/api-server run typecheck` — типчек бэкенда
- `pnpm --filter @workspace/abby-llm run dist:win|dist:mac|dist:linux` — собрать установщик
- Сборка установщика складывает результат в `artifacts/abby-llm/release/`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Фронтенд: React + Vite + TailwindCSS, Monaco Editor, Lucide, Recharts
- Десктоп: Electron (contextIsolation, preload + contextBridge, IPC, без nodeIntegration)
- API: Express 5; языковой движок — чистый TypeScript, без внешних зависимостей
- Хранилище данных/чекпоинтов: файловая система (не Postgres)

## Where things live

- `artifacts/abby-llm/src/` — UI (компоненты, hooks/useAbby.tsx — глобальное
  состояние, lib/api.ts — клиент к /api)
- `artifacts/abby-llm/electron/` — main.ts, preload.ts, build.mjs (esbuild)
- `artifacts/abby-llm/electron-builder.yml` — конфиг установщиков
- `artifacts/abby-llm/training/train_abby.py` — PyTorch-трейнер для 67 ТБ (GPU)
- `artifacts/abby-llm/TRAINING.md`, `DESKTOP.md` — документация
- `artifacts/api-server/src/lib/llm/` — модель: tokenizer.ts, model.ts (n-gram),
  store.ts (ФС-хранилище), engine.ts (цикл обучения, синглтон)
- `artifacts/api-server/src/routes/` — datasets, training, chat, models, health

## Architecture decisions

- **Встроенная модель — настоящая n-gram** (интерполяция триграмм/биграмм/униграмм
  со сглаживанием). Выбрана потому, что реально обучается и работает в Node без
  GPU. Для 67 ТБ есть отдельный PyTorch-GPT трейнер (`training/train_abby.py`).
- **Десктоп = единый локальный сервер.** В проде Electron запускает собранный
  api-server дочерним процессом; тот отдаёт и `/api`, и статический фронтенд,
  поэтому относительные вызовы `/api` работают без изменений и приложение
  полностью офлайн.
- **api-server двурежимный через env:** `ABBY_DATA_DIR` (куда писать данные) и
  `ABBY_PUBLIC_DIR` (отдавать ли статику). На Replit обе не заданы — поведение
  как у обычного веб-API.
- Фронтенд опрашивает `/api/training/status` каждую 1с во время обучения и 5с в
  простое.

## Product

IDE-подобный интерфейс: слева иконочная навигация и переключаемая панель
(Explorer / Datasets / Models / Training / Git / Settings), по центру редактор
Monaco с вкладками, снизу терминал и три дашборда (Training Progress / Dataset
Overview / Abby Brain), справа чат-панель Abby. Пользователь перетаскивает файлы
в окно (или выбирает папку с диска в десктопе), запускает обучение и общается с
моделью — всё на реальных данных и метриках.

## User preferences

- Язык интерфейса и комментариев — русский.
- Принципиально: своя модель, без Ollama/внешних API.

## Gotchas

- `build`/`build:web` требуют env `PORT` и `BASE_PATH`; для десктопа они заданы
  в скрипте `build:web` (BASE_PATH=/). Проверяй артефакт через `typecheck`.
- Установщик собирается под целевую ОС: `.exe` — только на Windows.
- При смене формата ответов API синхронизируй типы в `src/lib/api.ts`.

## Pointers

- См. `pnpm-workspace` skill — структура воркспейса и TypeScript-настройки
- См. `TRAINING.md` — как обучать; `DESKTOP.md` — как собирать установщик
