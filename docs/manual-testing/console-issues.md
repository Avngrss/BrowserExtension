# Console issues

Console collector на странице Collector diagnostics. Сессия — [session-management.md](./session-management.md). **Review** только после **Stop and review**.

## Подготовка extension

**Settings** → **Capture** → **Capture console errors** включён → **Settings saved.**

## Collector diagnostics

```bash
npm run diagnostics
```

URL: `http://127.0.0.1:8765/collector-diagnostics.html`

Кнопки (Console): **Create console error**, **Create uncaught error**, **Create unhandled rejection**.

Старт: вкладка diagnostics активна → side panel → **Start capture** → **Capturing this tab**.

DevTools (**F12**) → **Console** на вкладке diagnostics (не side panel).

Вне scope: `console.warn`; ошибки из isolated content script **другого** extension.

## CON-001. Два разных console.error

Приоритет: High  
Тип: Functional  
Цель: Два разных `console.error` — две Console issues.

Тестовые данные

- `console.error('BCA manual console error A');`
- `console.error('BCA manual console error B');`

Шаги

1. **Start capture** → **Capturing this tab**. Запишите **Potential issues**.

   **Ожидаемый результат:** **Potential issues** равно **0** (если не было других issues).

2. В DevTools **Console** выполните команду с **error A**.

   **Ожидаемый результат:** **Potential issues** увеличилось на **1**; строка **Console 1**; **Recent activity** — **Console error: BCA manual console error A**.

3. В **Console** выполните команду с **error B**.

   **Ожидаемый результат:** **Potential issues** ещё на **1**; **Console 2**; **Recent activity** — **Console error: BCA manual console error B**.

4. **Stop and review** → **Review** → вкладка **Console**.

   **Ожидаемый результат:** две карточки с заголовками **Console error: BCA manual console error A** и **Console error: BCA manual console error B**.

## CON-002. Повтор console.error и occurrences

Приоритет: High  
Тип: Functional  
Цель: Один текст — одна карточка; счётчик occurrences растёт.

Предусловия

- **Capturing this tab** на diagnostics.

Шаги

1. Запишите **Potential issues**.

   **Ожидаемый результат:** число записано.

2. Два раза **Create console error** на странице.

   **Ожидаемый результат:** **Potential issues** увеличилось на **1** (не на 2); **Console 1**; **Recent activity** — **Console error: Diagnostics console error** и **2 occurrences**.

3. **Stop and review** → **Review** → **Console**.

   **Ожидаемый результат:** одна карточка **Console error: Diagnostics console error**; под заголовком pathname и **`· 2 occurrences`**.

## CON-003. Uncaught error и unhandled rejection

Приоритет: High  
Тип: Functional  
Цель: Uncaught и rejection попадают в Console с заданным текстом.

Тестовые данные

```javascript
setTimeout(() => {
  throw new Error('BCA manual uncaught error');
}, 0);
```

```javascript
Promise.reject(new Error('BCA manual unhandled rejection'));
```

Шаги

1. **Capturing this tab**; запишите **Potential issues**.

   **Ожидаемый результат:** число записано.

2. В **Console** выполните блок с uncaught; подождите 1 с.

   **Ожидаемый результат:** **Potential issues** +1; **Recent activity** — **Uncaught error: BCA manual uncaught error**.

3. В **Console** выполните `Promise.reject(...)`.

   **Ожидаемый результат:** **Potential issues** ещё +1; **Recent activity** — **Unhandled rejection: BCA manual unhandled rejection**.

4. **Stop and review** → **Review** → **Console**.

   **Ожидаемый результат:** карточки **Uncaught error: BCA manual uncaught error** и **Unhandled rejection: BCA manual unhandled rejection**.

## CON-004. До Start, Pause и после Stop

Приоритет: High  
Тип: Functional  
Цель: События до **Start**, на **Pause** и после **Stop** не добавляются; после **Resume** — добавляются.

Предусловия

- Перезагрузите diagnostics; capture не запущен.

Шаги

1. **Create console error** без **Start capture**. Side panel — экран **Start capture**.

   **Ожидаемый результат:** блока **Capture summary** нет.

2. **Start capture** → **Create console error**; запишите **Potential issues**.

   **Ожидаемый результат:** **Potential issues** равно **1**.

3. **Pause** → **Create console error**.

   **Ожидаемый результат:** **Potential issues** по-прежнему **1**.

4. **Resume** → **Create uncaught error**; подождите 1 с.

   **Ожидаемый результат:** **Potential issues** равно **2**.

5. **Stop and review**; на странице **Create unhandled rejection**.

   **Ожидаемый результат:** **Session Summary**; **Console:** равно **2**.

6. **Review** → **Console**.

   **Ожидаемый результат:** **Console error: Diagnostics console error** и **Uncaught error: Diagnostics uncaught error**; **нет** **Unhandled rejection: Diagnostics unhandled rejection**.

## CON-005. Console с другой вкладки

Приоритет: Medium  
Тип: Integration  
Цель: **Create console error** на вкладке B не меняет счётчики сессии на A.

Предусловия

- **Вкладка A:** diagnostics, **Capturing this tab**.

Шаги

1. На **A** запишите **Potential issues** и **Console** в строке категорий (если есть).

   **Ожидаемый результат:** числа записаны.

2. **Вкладка B** с тем же URL → **Create console error** → вернитесь на **A**, side panel.

   **Ожидаемый результат:** **Capturing this tab**; **Potential issues** и **Console** как на шаге 1.

3. На **A** **Create console error**.

   **Ожидаемый результат:** **Potential issues** увеличилось на **1** относительно шага 1.

4. **Stop and review** → **Review** → **Console**.

   **Ожидаемый результат:** одна карточка **Console error: Diagnostics console error**.
