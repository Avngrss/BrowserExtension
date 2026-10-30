# Network issues

Network collector на Collector diagnostics. Сессия — [session-management.md](./session-management.md). Проверка issues — после **Stop and review** → **Review** → вкладка **Network**.

## Подготовка extension

**Settings** → **Capture** → **Capture network failures** включён → **Settings saved.**

## Collector diagnostics

```bash
npm run diagnostics
```

URL: `http://127.0.0.1:8765/collector-diagnostics.html`

Кнопки (Network): **Create fetch 404**, **Create XHR error**.

DevTools → **Console** на вкладке diagnostics для команд `fetch(...)`.

## NET-001. Fetch 404

Приоритет: High  
Тип: Functional  
Цель: Неуспешный fetch попадает в Network issues.

Предусловия

- **Capturing this tab** на diagnostics.

Шаги

1. Запишите **Potential issues**.

   **Ожидаемый результат:** число записано.

2. **Create fetch 404** на странице.

   **Ожидаемый результат:** **Potential issues** увеличилось на **1**; в **Recent activity** строка вида **Fetch failed: GET /diagnostics-missing · 404**.

3. **Stop and review** → **Review** → **Network**.

   **Ожидаемый результат:** одна карточка с текстом **Fetch failed: GET /diagnostics-missing · 404**.

## NET-002. XHR error

Приоритет: High  
Тип: Functional  
Цель: Ошибка XHR попадает в Network.

Шаги

1. При **Capturing this tab** нажмите **Create XHR error**.

   **Ожидаемый результат:** в **Recent activity** строка **XHR failed: GET /diagnostics-missing · 404** (или с **404** и `/diagnostics-missing`).

2. **Stop and review** → **Review** → **Network**.

   **Ожидаемый результат:** отдельная карточка с текстом **XHR failed: …** (не дубликат NET-001 по заголовку **Fetch** vs **XHR**).

## NET-003. Failed fetch без ответа

Приоритет: High  
Тип: Functional  
Цель: Сбой соединения без HTTP-ответа попадает в Network.

Тестовые данные

- `fetch('http://127.0.0.1:1/bca-unreachable')`

Шаги

1. При capture в **Console** выполните команду fetch.

   **Ожидаемый результат:** **Potential issues** увеличилось на **1**; в **Recent activity** **Fetch failed:** с **Network failure** (без **200**).

2. **Stop and review** → **Network**.

   **Ожидаемый результат:** карточка Network issue с **Network failure** в описании.

## NET-004. Успешный fetch не создаёт issue

Приоритет: Medium  
Тип: Negative  
Цель: Ответ 200 не увеличивает Network issues.

Шаги

1. При capture запишите **Potential issues** и **Network** в строке категорий.

   **Ожидаемый результат:** числа записаны.

2. В **Console**: `fetch('http://127.0.0.1:8765/collector-diagnostics.html')`.

   **Ожидаемый результат:** **Potential issues** и **Network** не изменились.

## NET-005. Повтор fetch 404 и Pause

Приоритет: High  
Тип: Functional  
Цель: Повтор даёт одну карточку с occurrences; на **Pause** новый fetch не учитывается.

Шаги

1. **Capturing this tab**; три раза **Create fetch 404**.

   **Ожидаемый результат:** **Potential issues** увеличилось на **1** (не на 3); **Recent activity** с **3 occurrences** для того же fetch.

2. **Pause** → **Create fetch 404**.

   **Ожидаемый результат:** **Potential issues** не изменилось.

3. **Resume** → один раз **Create fetch 404**.

   **Ожидаемый результат:** **Potential issues** по-прежнему одно уникальное Network issue; occurrences в **Recent activity** выросли.

4. **Stop and review** → **Create fetch 404** на странице.

   **Ожидаемый результат:** **Network:** на Summary не выросло относительно конца шага 3.

5. **Review** → **Network**.

   **Ожидаемый результат:** одна карточка **Fetch failed: GET /diagnostics-missing · 404** с **`· N occurrences`** где N больше 1.

## NET-006. Query token в URL

Приоритет: High  
Тип: Privacy  
Цель: Секрет в query не показывается полностью в issue.

Тестовые данные

- `fetch('http://127.0.0.1:8765/diagnostics-missing?token=BCA_SECRET_TOKEN_999')`

Шаги

1. При capture выполните fetch в **Console**.

   **Ожидаемый результат:** **Potential issues** +1.

2. **Stop and review** → **Review** → **Network**.

   **Ожидаемый результат:** в тексте issue **нет** полной строки `BCA_SECRET_TOKEN_999` (параметр скрыт или обрезан, как в UI).
