# End-to-end scenarios

Сквозные сценарии. Детали collectors — в тематических файлах; сессия — [session-management.md](./session-management.md).

## E2E-001. Capture и пустой Review на Automation Exercise

Приоритет: High  
Тип: E2E  
Цель: Обычный сайт: actions есть, issues нет.

Предусловия

- Automation Exercise; чистая сессия.

Шаги

1. **Start capture** → **Products** → **Cart** → **Contact us** (форма открыта, submit **не** нажимать).

   **Ожидаемый результат:** **Actions** не меньше **3**; **Potential issues** **0** (если страница без ошибок).

2. **Stop and review** → **Review**.

   **Ожидаемый результат:** **No issues in this category.** или пустой список.

3. **Back to summary**.

   **Ожидаемый результат:** **Total actions** не меньше **3**.

## E2E-002. Issues на diagnostics и Review

Приоритет: High  
Тип: E2E  
Цель: Одна сессия с UI, Console и Network, disposition в Review и их учёт в промпте.

Предусловия

- Сервер diagnostics запущен ([console-issues.md](./console-issues.md)).

Шаги

1. Diagnostics: **Start capture** → **Create UI issue**, **Create console error**, **Create fetch 404** подряд, между нажатиями меньше 3 с (вкладка активна).

   **Ожидаемый результат:** **Potential issues** равно **3**; строка категорий содержит **UI**, **Console**, **Network**.

2. **Stop and review** → **Review** → **Exclude** у Network, **More** → **Mark as expected** у Console, UI **Include**.

   **Ожидаемый результат:** dispositions соответствуют выбору; UI issue с thumbnail (если скриншоты UI включены по умолчанию).

3. **Back to summary** → **Create ticket** на карточке **Potential bug 1**.

   **Ожидаемый результат:** до нажатия — одна карточка (**1 potential bug captured**). Экран **Bug ticket**; в тикете **Diagnostics UI issue**; **Diagnostics console error** нет (expected). Строки с **/diagnostics-missing** нет.

## E2E-003. Capture на diagnostics, работа на Automation Exercise

Приоритет: High  
Тип: E2E  
Цель: Capture остаётся на diagnostics, пока активна другая вкладка.

Шаги

1. Diagnostics: **Start capture**. Новая вкладка Automation Exercise → сделайте её активной.

   **Ожидаемый результат:** side panel на Automation Exercise: **Capture is running in another tab** и **Go to captured tab**.

2. **Products** на Automation Exercise.

   **Ожидаемый результат:** **Go to captured tab** → **Actions** на diagnostics **не** выросло из‑за клика на Automation Exercise.

3. **Go to captured tab** → **Create console error** → **Stop and review**.

   **Ожидаемый результат:** **Console:** **1**; **Review** → **Console** — **Console error: Diagnostics console error**.

## E2E-004. Capture bug now

Кейс снят: **Capture bug now** убран из UI. Баги создаются автоматически с issues.

## E2E-005. Privacy на форме Signup

Приоритет: High  
Тип: E2E  
Цель: Пароль и email не попадают в **Recent activity**; privacy toggles read-only.

Шаги

1. Automation Exercise: **Start capture** → **Signup / Login** → **Signup** → email `bca-e2e@test.example`, password `BcaPrivacyPwd1` → **Create Account** (или submit формы).

   **Ожидаемый результат:** в **Recent activity** **нет** `BcaPrivacyPwd1` и email.

2. **Stop and review** → **Review**.

   **Ожидаемый результат:** **нет** UI issue с паролем в тексте.

3. **Settings** → **Privacy**: **Never store text field values** и **Protect password and private fields** включены и disabled.

   **Ожидаемый результат:** изменить нельзя.

## E2E-006. Тикет из промпта на реальном сайте

Приоритет: High  
Тип: E2E  
Цель: **Create ticket** с реального сайта даёт черновик, который можно копировать, без введённых данных.

Предусловия

- Automation Exercise; чистая сессия.
- Открыт любой AI-ассистент (ChatGPT, Claude и т. п.). Промпт уходит в сторонний сервис — только тестовые данные.

Тестовые данные

- Email: `bca-prompt@test.example`, сообщение: `BCA prompt check`.
- Заметка (баг условный, нужен для проверки промпта): `No confirmation after filling the form. Expected: a success message.`

Шаги

1. **Start capture** → **Contact us** → заполните **Name**, **Email**, **Subject** и **Your Message Here**. **Submit** не нажимайте.

   **Ожидаемый результат:** **Actions** выросло; в **Recent activity** нет `bca-prompt@test.example` и `BCA prompt check`.

2. **Stop and review**. Если карточек нет — на diagnostics **Create UI issue** и повторите.

   **Ожидаемый результат:** есть хотя бы одна карточка **Potential bug**.

3. **Create ticket** на этой карточке.

   **Ожидаемый результат:** экран **Bug ticket**; Title / Description / Steps / Actual / Expected / Severity / Priority / Labels / Environment; в шагах — ваши действия в том же порядке, не больше 5; в тексте нет `bca-prompt@test.example` и `BCA prompt check`.

4. **Copy ticket**.

   **Ожидаемый результат:** notice **Ticket copied.** Тикет как у QA: короткий **Title** (`[Feature] …`), живой **Description**, **Steps to Reproduce**, **Actual Result**, **Expected Result**, **Severity**, **Priority**, **Labels**, **Environment**. Шаги совпадают с вашими действиями, новых нет; догадок о причине нет. Секции **Evidence** нет.

5. Сравните тикет с тем, что вы завели бы сами.

   **Ожидаемый результат:** записан список того, что пришлось бы править руками (лишнее, недостающее, неточные шаги), или «править нечего». Этот список — вход для следующей задачи по качеству промпта.
