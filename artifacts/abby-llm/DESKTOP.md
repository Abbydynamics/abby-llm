# Abby LLM — десктоп-приложение (Electron)

Abby собирается в настоящее десктоп-приложение для Windows, macOS и Linux с
устанавливаемым инсталлятором (`.exe`, `.dmg`, `.AppImage`).

## Архитектура

- **Electron** (`electron/main.ts`, `electron/preload.ts`) — главный процесс и
  безопасный мост. `contextIsolation: true`, `nodeIntegration: false`,
  `sandbox: true`. Рендерер общается с Node только через типизированный
  `contextBridge` (никакого прямого доступа к Node API).
- В продакшене главный процесс запускает встроенный сервер Abby (Express + сам
  языковой движок) как дочерний процесс. Сервер отдаёт и `/api`, и собранный
  React-фронтенд, поэтому приложение полностью работает **офлайн**.
- Данные обучения и чекпоинты пишутся в пользовательскую папку
  (`userData/abby-data`), а не внутрь установки.

## Что доступно в десктоп-версии

- Перетаскивание файлов в окно (как в вебе).
- Кнопка **«Выбрать папку с диска»** — нативный диалог выбора папки; Abby
  обойдёт её и проиндексирует текст/код-файлы (через IPC, безопасно).

## Сборка установщика

> Установщик нужно собирать на целевой ОС: `.exe` — на Windows, `.dmg` — на
> macOS. Electron не умеет надёжно кросс-компилировать инсталляторы.

```bash
# из корня монорепозитория

# 1. поставить зависимости (один раз)
pnpm install

# 2. собрать установщик под свою ОС
pnpm --filter @workspace/abby-llm run dist:win     # Windows → Abby-LLM-Setup-1.0.0.exe
pnpm --filter @workspace/abby-llm run dist:mac     # macOS   → .dmg
pnpm --filter @workspace/abby-llm run dist:linux   # Linux   → .AppImage
```

Готовый установщик появится в `artifacts/abby-llm/release/`.

Команда `dist:*` сама делает три шага (можно запускать по отдельности):

```bash
pnpm --filter @workspace/abby-llm run build:web       # фронтенд → dist/public
pnpm --filter @workspace/abby-llm run build:server    # сервер   → server-dist
pnpm --filter @workspace/abby-llm run build:electron  # main/preload → dist-electron
```

## Запуск в режиме разработки

```bash
# терминал 1 — фронтенд (Vite) и API уже крутятся как воркфлоу в Replit;
# локально можно так:
pnpm --filter @workspace/abby-llm run build:electron
pnpm --filter @workspace/abby-llm run electron:dev
```

`electron:dev` грузит `http://localhost:5173` (Vite). Поменять адрес можно через
`ABBY_DEV_URL`.
