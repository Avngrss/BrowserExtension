# Демо: Bug Capture Assistant

Chrome-расширение для ручного тестирования. В магазине Chrome его пока нет — ставим локально из этой репы.

Нужны: **Git**, **Node.js 22+**, **Chrome или Edge 114+**.

## Установка

```bash
git clone https://github.com/Avngrss/BrowserExtension.git
cd BrowserExtension
npm install
npm run build
```

1. Откройте `chrome://extensions`.
2. Включите **Developer mode**.
3. **Load unpacked** → папка `.output/chrome-mv3`.
4. Нажмите иконку **Bug Capture Assistant** на панели — откроется side panel.

После `git pull` снова `npm run build`, на карточке расширения нажмите обновление и заново откройте side panel.

Если `npm` в PowerShell не находится, пишите `npm.cmd`.

## Как пользоваться

1. Откройте любой сайт
2. В side panel нажмите **Start capture**.
3. Тестируйте как обычно: клики, формы, переходы.
4. **Stop and review**.
5. На карточке бага: **Create ticket** → **Copy ticket**.

**Settings** для демо трогать не нужно.

## Что оно ловит само

| Тип         | Как появляется                                                                                          |
| ----------- | ------------------------------------------------------------------------------------------------------- |
| **Console** | Ошибка JavaScript в DevTools                                                                            |
| **Network** | Упавший запрос: HTTP 4xx/5xx, timeout, «Failed to fetch»                                                |
| **UI**      | На странице **видимый** элемент по CSS-селектору из Settings. Это не «кривая вёрстка» и не скриншот-AI. |

UI по умолчанию смотрит на:

- `[role="alert"]` — баннер/алерт
- `[aria-invalid="true"]` — поле с ошибкой валидации
- `[data-testid="error-message"]` и `[data-qa="error-message"]`

Скрытый элемент не считается. Свой селектор добавляют только если ошибки сайта живут в другой разметке (**Settings → Advanced UI issue rules**).

## Фидбек

В репозитории: **Issues** → **New issue**.

Напишите свободным текстом:

- какой сайт и что делали;
- что ожидали и что увидели;
- скриншот side panel / тикета, если есть.

Ссылка: [github.com/Avngrss/BrowserExtension/issues](https://github.com/Avngrss/BrowserExtension/issues)
