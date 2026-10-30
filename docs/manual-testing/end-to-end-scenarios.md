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

3. **Back to summary** → **Generate prompt** на карточке **Potential bug 1**.

   **Ожидаемый результат:** до нажатия — одна карточка (**1 potential bug captured**, **3 related issues**). Экран **Steps for bug ticket**; в **Observed problems** строки **UI error: Diagnostics UI issue** и **Console error: Diagnostics console error [Expected]**; строки с **/diagnostics-missing** нет; в правилах есть **Problems marked [Expected] were confirmed as expected behavior by the tester. Do not report them as defects.**

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

Приоритет: High  
Тип: E2E  
Цель: Ручной захват нескольких багов до Summary и замены сессии.

Предусловия

- Automation Exercise или diagnostics; **Start capture** → минимум один action (**Products** или **Create action event**).

Шаги

1. Side panel → **Capture bug now**.

   **Ожидаемый результат:** форма **What went wrong?** (заметка необязательна), **Save bug**, **Cancel**.

2. Введите заметку → **Save bug**.

   **Ожидаемый результат:** **Bug captured**; **Continue capture**; **Stop and review**.

3. **Continue capture** → снова **Capture bug now** → **Save bug** без заметки.

   **Ожидаемый результат:** диалога замены нет; снова **Bug captured**.

4. **Stop and review** (кнопка в блоке **Bug captured** или основная).

   **Ожидаемый результат:** **2 potential bugs captured**; две карточки **Captured manually**; у первой **Factual description** — текст заметки, у второй — первый недавний issue или **Captured manually on <путь>.** (без догадок о причине); у каждой relevant Actions не больше 5 и без **Clicked a button.**; **1 screenshot**, если захват шёл во время записи; **Generate prompt** активна. Нет **Report scope**, **Bug context** и **Bug report preview**.

4a. **Generate prompt** на карточке с заметкой.

**Ожидаемый результат:** экран **Steps for bug ticket**; в **Generated prompt** строка **Detection: Captured manually by the tester** и текст заметки после **Tester note:**. **Back to summary** возвращает на **Session Summary**.

5. **Start new capture** → подтвердите без F5 на web-странице.

   **Ожидаемый результат:** **Capturing this tab**; карточек **Potential bug** **нет**; новый **Products** даёт одну запись в **Actions**.

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
Цель: Промпт **Steps for bug ticket** с реального сайта даёт в AI-ассистенте тикет, который не нужно переписывать, и не содержит введённых данных.

Предусловия

- Automation Exercise; чистая сессия.
- Открыт любой AI-ассистент (ChatGPT, Claude и т. п.). Промпт уходит в сторонний сервис — только тестовые данные.

Тестовые данные

- Email: `bca-prompt@test.example`, сообщение: `BCA prompt check`.
- Заметка (баг условный, нужен для проверки промпта): `No confirmation after filling the form. Expected: a success message.`

Шаги

1. **Start capture** → **Contact us** → заполните **Name**, **Email**, **Subject** и **Your Message Here**. **Submit** не нажимайте.

   **Ожидаемый результат:** **Actions** выросло; в **Recent activity** нет `bca-prompt@test.example` и `BCA prompt check`.

2. **Capture bug now** → заметка из тестовых данных → **Save bug** → **Stop and review**.

   **Ожидаемый результат:** карточка **Captured manually**, в **Factual description** — текст заметки. Если сайт сам выдал ошибки, рядом будут автоматические карточки; для кейса берите карточку **Captured manually**.

3. **Generate prompt** на этой карточке.

   **Ожидаемый результат:** **Detection: Captured manually by the tester**; после **Tester note:** — заметка; **Page URL** — страница Contact us; в шагах — ваши действия в том же порядке, не больше 5; в тексте нет `bca-prompt@test.example` и `BCA prompt check`.

4. Клик по полю → Ctrl+C → вставьте промпт в AI-ассистент.

   **Ожидаемый результат:** тикет с разделами **Title**, **Steps to reproduce**, **Actual result**, **Expected result**, **Environment**, **Evidence**. Шаги совпадают с вашими действиями, новых нет; **Expected result** взят из заметки; догадок о причине нет; где данных нет — **Not captured**.

5. Сравните тикет с тем, что вы завели бы сами.

   **Ожидаемый результат:** записан список того, что пришлось бы править руками (лишнее, недостающее, неточные шаги), или «править нечего». Этот список — вход для следующей задачи по качеству промпта.
