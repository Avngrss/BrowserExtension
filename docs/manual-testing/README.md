# Ручной набор тестов Bug Capture Assistant

Документы в этой папке — для **ручного QA** без чтения исходного кода. Подписи кнопок и экранов в шагах совпадают с **English** текстом в продукте.

**Не описываем (не реализовано):** Export, Prompt Builder, LLM, webhook, Jira, YouTrack, история прошлых сессий. На **Session Summary** кнопка **Generate prompt** неактивна, подпись **Coming next**.

## Сборка и загрузка extension

1. В корне репозитория: `npm run build`.
2. В Chrome: `chrome://extensions` → **Developer mode** → **Load unpacked** → папка `.output/chrome-mv3`.
3. Side panel: иконка **Bug Capture Assistant** на панели инструментов.
4. **Settings** (Options): кнопка **Settings** в шапке side panel или пункт **Options** в меню иконки extension.

## Два типа страниц

### Automation Exercise (обычные сценарии)

URL: `https://automationexercise.com/`

Сессия, Actions, формы, navigation, **Settings**, **Session Summary**, **Review**, smoke и E2E.

Подготовка чистой сессии — в [session-management.md](./session-management.md) (общая подготовка).

### Collector diagnostics (технические collectors)

Локальная страница с кнопками для предсказуемых Console, Network, UI и скриншотов. Команда запуска сервера и URL указаны **в начале каждого тематического файла**, где diagnostics обязателен. Не является общим предусловием всего набора.

## Формат кейсов

`<ID>. Название` → **Приоритет**, **Тип**, **Цель** → **Предусловия** → при необходимости **Тестовые данные** → **Шаги** (действие → **Ожидаемый результат:**).

Эталон оформления: [session-management.md](./session-management.md).

## Проверка issues (общий порядок)

1. **Start capture** на нужной вкладке → дождаться **Capturing this tab**.
2. Вызвать событие на web-странице.
3. При необходимости смотреть **Capture summary** (**Potential issues**, строка **Console** / **UI** / **Network**, **Recent activity**).
4. **Stop and review** → **Session Summary**.
5. **Review** → вкладка категории (**Console**, **Network**, **UI**, **All**).
6. **Back to summary** — возврат с экрана **Issue Review**.

**Review** во время активного capture в side panel **нет**.

## Порядок прогона

1. [smoke-checklist.md](./smoke-checklist.md)
2. [session-management.md](./session-management.md)
3. [action-capture.md](./action-capture.md), [console-issues.md](./console-issues.md), [network-issues.md](./network-issues.md), [ui-issues.md](./ui-issues.md)
4. [screenshot-evidence.md](./screenshot-evidence.md), [issue-review.md](./issue-review.md), [settings-privacy-limits.md](./settings-privacy-limits.md)
5. [end-to-end-scenarios.md](./end-to-end-scenarios.md)

Автотесты Playwright: корневой [README.md](../../README.md).

## Файлы

- [smoke-checklist.md](./smoke-checklist.md) — один критический путь
- [session-management.md](./session-management.md) — сессия и вкладки
- [action-capture.md](./action-capture.md) — Actions
- [console-issues.md](./console-issues.md) — Console
- [network-issues.md](./network-issues.md) — Network
- [ui-issues.md](./ui-issues.md) — UI
- [screenshot-evidence.md](./screenshot-evidence.md) — скриншоты
- [issue-review.md](./issue-review.md) — **Issue Review**
- [settings-privacy-limits.md](./settings-privacy-limits.md) — **Settings**
- [end-to-end-scenarios.md](./end-to-end-scenarios.md) — E2E
