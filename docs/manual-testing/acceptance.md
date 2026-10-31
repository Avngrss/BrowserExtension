# Приёмка этапа: Generate prompt (Steps for bug ticket)

Памятка, чтобы принять текущий этап на своём компьютере и ничего не забыть. Принимаем кнопку **Generate prompt** на карточке **Potential bug** и экран **Steps for bug ticket**.

## 1. Подготовка (≈10 мин, один раз)

Нужно: Node.js 22+ (`node --version`), Git, Chrome или Edge 114+. Python не нужен.

1. Код:
   - новой папкой: `git clone https://github.com/Avngrss/BrowserExtension.git`, затем `cd BrowserExtension`;
   - если папка уже есть: `git pull`.
2. `npm install`.
3. `npm run build` — появится папка `.output/chrome-mv3`.
4. `chrome://extensions` → **Developer mode** → **Load unpacked** → `.output/chrome-mv3`. Если расширение уже загружено, после каждой сборки нажмите на его карточке кнопку обновления и заново откройте side panel.
5. Во втором терминале: `npm run diagnostics` → откройте `http://127.0.0.1:8765/collector-diagnostics.html`. Терминал не закрывайте, остановка — Ctrl+C.

PowerShell не даёт запустить `npm` — пишите `npm.cmd`.

По желанию: `npm run check` должен пройти без ошибок. Если он ругается на форматирование **всех** файлов, папка склонирована до появления `.gitattributes` (окончания строк CRLF) — склонируйте заново в новую папку.

## 2. Что пройти (≈30 мин)

Перед каждым кейсом — чистая сессия: на **Session Summary** нажмите **Delete session**.

| №   | Кейс                                            | Страница                            | Что принимаем                                         |
| --- | ----------------------------------------------- | ----------------------------------- | ----------------------------------------------------- |
| 1   | [SES-005](./session-management.md), шаги 1b–1g  | diagnostics                         | карточки, Generate prompt, Copy prompt, Exclude, Back |
| 2   | [E2E-002](./end-to-end-scenarios.md)            | diagnostics                         | промпт учитывает решения в Review                     |
| 3   | [E2E-004](./end-to-end-scenarios.md), шаги 1–4a | diagnostics или Automation Exercise | ручной баг с заметкой в промпте                       |
| 4   | [SET-006](./settings-privacy-limits.md)         | diagnostics                         | Extra instructions в Settings попадают в промпт       |
| 5   | [E2E-006](./end-to-end-scenarios.md)            | Automation Exercise                 | тикет из промпта в AI-ассистенте — главная проверка   |

Промпт уходит в сторонний AI-ассистент: проверяйте только на тестовых страницах, без рабочих и личных данных.

## 3. Что записать

- По каждому кейсу: прошёл или нет. Если нет — номер шага, что ожидали, что увидели, скриншот.
- По E2E-006: промпт, ответ AI-ассистента и список того, что в тикете пришлось бы править руками.

С этими результатами выбирается следующий шаг (см. `PROJECT_CONTEXT.md`):

- всё прошло, тикет годный → стабилизация и полный ручной регресс;
- тикет приходится править → сначала одна задача на качество промпта;
- кейс упал → сначала одна задача на исправление.

## Если что-то не так

- **Open an HTTP or HTTPS page tab…** при **Start capture** — активна не та вкладка: кликните по web-странице и повторите.
- У **Generate prompt** подпись **Coming next** и кнопка неактивна — загружена старая сборка: обновите расширение в `chrome://extensions`.
- `npm run diagnostics` пишет **Port 8765 is already in use** — сервер уже запущен в другом терминале.
- `npm warn Unknown env config "devdir"` — не ошибка проекта, см. корневой [README.md](../../README.md).
