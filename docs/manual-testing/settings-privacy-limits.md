# Settings, privacy, limits

Страница **Settings** (Options). Открытие: **Settings** в side panel или **Options** в меню иконки extension.

## SET-001. Capture console errors

Приоритет: High  
Тип: Functional  
Цель: Выключенный **Capture console errors** блокирует новые Console issues.

Шаги

1. **Settings** → **Capture** → выключите **Capture console errors** → **Settings saved.**

   **Ожидаемый результат:** notice **Settings saved.**

2. Diagnostics ([console-issues.md](./console-issues.md)): **Delete session** → **Start capture** → **Create console error**.

   **Ожидаемый результат:** **Potential issues** не увеличилось из‑за Console; после **Stop and review** → **Review** → **Console** — **No issues in this category.**

3. Включите **Capture console errors** → **Settings saved.** → снова **Create console error** при capture.

   **Ожидаемый результат:** **Potential issues** +1; после stop в **Review** есть **Console error: Diagnostics console error**.

## SET-002. Issue notifications

Приоритет: Medium  
Тип: Functional  
Цель: Системное уведомление зависит от **Show notifications for new issues**.

Предусловия

- ОС разрешает уведомления Chrome.

Шаги

1. **Settings** → **Issue notifications**: **Show notifications for new issues** и **UI issue notifications** включены → **Settings saved.**

   **Ожидаемый результат:** **Settings saved.**

2. Diagnostics, **Start capture**, **Create UI issue** (вкладка на переднем плане).

   **Ожидаемый результат:** системное уведомление Chrome от extension.

3. Выключите **Show notifications for new issues** → **Settings saved.** Удалите alert на странице, снова **Create UI issue**.

   **Ожидаемый результат:** нового уведомления **нет**; в side panel **Potential issues** всё равно растёт.

## SET-003. Screenshot для Console issues

Приоритет: Medium  
Тип: Functional  
Цель: Включённый **Console issues** в **Screenshot evidence** даёт thumbnail.

Шаги

1. **Screenshot evidence** → включите **Console issues**, **Network issues** выключите → **Settings saved.**

   **Ожидаемый результат:** **Settings saved.**

2. Diagnostics, новая сессия, **Create console error**, подождите 5 с, **Stop and review** → **Review** → **Console**.

   **Ожидаемый результат:** **Issue screenshot thumbnail** или **Capturing screenshot…**, затем thumbnail.

## SET-004. Privacy toggles persist

Приоритет: Medium  
Тип: Privacy  
Цель: **Redact sensitive URL parameters** сохраняется после закрытия Options.

Шаги

1. **Privacy** → переключите **Redact sensitive URL parameters** → **Settings saved.**

   **Ожидаемый результат:** **Settings saved.**

2. Закройте вкладку Options, снова **Settings**.

   **Ожидаемый результат:** toggle в том же положении.

3. **Never store text field values** и **Protect password and private fields** — включены и **disabled** (read-only).

   **Ожидаемый результат:** переключить их нельзя.

## SET-005. Невалидный Maximum Actions

Приоритет: Medium  
Тип: Negative  
Цель: Значение ниже 10 не сохраняется.

Шаги

1. **Limits** → **Maximum Actions per session** = **5** → Tab.

   **Ожидаемый результат:** alert **Maximum Actions per session must be between 10 and 1000.**; **Settings saved.** **не** появляется.

2. Введите **100** → Tab.

   **Ожидаемый результат:** alert исчез; **Settings saved.**

## SET-006. Extra prompt instructions

Кейс снят: **Bug ticket prompt** скрыт в Settings, пока тикет пишет расширение, а не LLM.

## SET-007. Advanced UI issue rules

Приоритет: High  
Тип: Functional  
Цель: Правило по CSS selector, валидация, Edit, Enabled, Delete.

Тестовые данные

- Name: `BCA manual rule`; selector: `#bca-manual-ui-flag`

Шаги

1. Раскройте **Advanced UI issue rules** → **Add rule**: **Name**, **CSS selector** `#bca-manual-ui-flag`, **Severity** **Error**, **Enabled** → **Add rule**.

   **Ожидаемый результат:** правило в списке.

2. Diagnostics, **Start capture**; в **Console**:

   ```javascript
   const el = document.createElement('div');
   el.id = 'bca-manual-ui-flag';
   el.textContent = 'BCA custom rule hit';
   document.body.appendChild(el);
   ```

   **Ожидаемый результат:** **Stop and review** → **UI** — **UI error: BCA custom rule hit**.

3. **Settings** → **Add rule**: Name `Bad`, selector `##not-valid` → **Add rule**.

   **Ожидаемый результат:** **Enter a valid CSS selector.**; правило не добавлено.

4. **Edit** у правила из шага 1 → Name `BCA manual rule edited` → **Save changes**.

   **Ожидаемый результат:** имя обновилось в списке.

5. Снимите **Enabled** у правила → повторите шаг 2 на новой сессии.

   **Ожидаемый результат:** issue **BCA custom rule hit** **не** появляется, пока правило выключено.

6. **Delete** у правила.

   **Ожидаемый результат:** правила нет; форма **Add rule** доступна.
