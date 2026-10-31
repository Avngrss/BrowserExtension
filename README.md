# Bug Capture Assistant

Browser extension (Manifest V3) for capturing testing sessions: user **Actions**, **UI**, **Console**, and **Network** issues on the monitored tab, optional **screenshot evidence**, **Issue Review**, and **Settings** (privacy, limits, UI rules).

**Демо (как поставить и попробовать, по-русски):** [docs/demo-ru.md](./docs/demo-ru.md)

## Stack

- WXT 0.21, React 19, TypeScript 5.9, Tailwind CSS 4
- Vitest 5, Playwright 1.64 (extension E2E)
- Chrome / Edge 114+ (side panel)

Prerequisites: Node.js 22+, npm 11+.

## Installation

```bash
npm install
```

`postinstall` builds the generated console bridge (`public/content-scripts/console-bridge.js`, gitignored) and runs `wxt prepare`, so `npm run typecheck` works on a fresh clone. It does not download Playwright browsers.

## Commands

| Command               | Purpose                                                |
| --------------------- | ------------------------------------------------------ |
| `npm run dev`         | WXT dev server + Chrome with extension                 |
| `npm run build`       | Production build → `.output/chrome-mv3`                |
| `npm run check`       | typecheck, lint, format, unit tests, build             |
| `npm run test:run`    | Vitest once                                            |
| `npm run test:e2e`    | **Build + Playwright tests only** (no browser install) |
| `npm run typecheck`   | `tsc --noEmit`                                         |
| `npm run diagnostics` | Collector diagnostics page for manual QA on port 8765  |

Load unpacked: `.output/chrome-mv3` via `chrome://extensions` (Developer mode).

## Manual QA

**[docs/manual-testing/README.md](./docs/manual-testing/README.md)** — ручной набор тестов (Russian): smoke checklist, session, collectors, screenshots, Review, Settings, E2E.

**[docs/manual-testing/acceptance.md](./docs/manual-testing/acceptance.md)** — приёмка текущего этапа на своём компьютере: подготовка с нуля, какие кейсы пройти, что записать.

## Automated E2E (Playwright)

`npm run test:e2e` does **not** run `playwright install`. Install Chromium **once** after cloning (or when Playwright version / browser binary is missing):

```bash
npx playwright install chromium
```

### Установка браузера для Playwright (рус.)

- Выполните **`npx playwright install chromium` один раз** после первого `npm install` в этом репозитории.
- Повторяйте только если изменилась версия `@playwright/test` или Playwright сообщает, что executable отсутствует (`Executable doesn't exist`).
- Бинарники хранятся в **общем кэше Playwright** (не в репозитории); **не** нужно ставить браузер перед каждым `npm run test:e2e`.
- `npm run check` **не** скачивает браузеры.

**Troubleshooting — `Executable doesn't exist`:** выполните `npx playwright install chromium` (или полный `npx playwright install`).

### npm `devdir` warning

При `npm install` / `npm run` может появиться:

```text
npm warn Unknown env config "devdir"
```

Это не ошибка проекта. Проверка источника (вручную):

```bash
npm config get devdir
npm config list
```

PowerShell:

```powershell
Get-ChildItem Env:npm_config_devdir
```

Если `devdir` не используется, удалите сами: `npm config delete devdir` (глобальную конфигурацию из репозитория **не** меняем автоматически).

## Verification

```bash
npm run typecheck
npm run lint
npm run format:check
npm run test:run
npm run build
npm run check
```

Optional (requires Playwright Chromium already installed):

```bash
npm run test:e2e
```
