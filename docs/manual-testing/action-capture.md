# Action capture

Сбор **Actions** на Automation Exercise. Сессия — [session-management.md](./session-management.md). Actions **не** показываются в **Issue Review**.

Предусловия для всех кейсов (если не указано иное): `https://automationexercise.com/`; в **Settings** → **Capture** включён **Capture actions**; **Start capture** → **Capturing this tab**.

## ACT-001. Клик по ссылке Products

Приоритет: High  
Тип: Functional  
Цель: Клик по пункту меню попадает в Actions с читаемым текстом.

Шаги

1. Запишите **Actions** в **Capture summary**.

   **Ожидаемый результат:** число записано.

2. На web-странице один раз **Products** в шапке.

   **Ожидаемый результат:** **Actions** увеличилось ровно на один; в **Recent activity** строка про click или navigation без HTML и селекторов.

## ACT-002. Поле Name на Contact us

Приоритет: High  
Тип: Privacy  
Цель: Текст поля не попадает в описание action.

Тестовые данные

- Меню **Contact us**; имя `BCA manual contact name`.

Шаги

1. **Contact us**; запишите **Actions**.

   **Ожидаемый результат:** число записано.

2. Заполните **Name**, Tab на следующее поле.

   **Ожидаемый результат:** в **Recent activity** у последней записи **нет** `BCA manual contact name`.

## ACT-003. Пароль на Signup

Приоритет: High  
Тип: Privacy  
Цель: Пароль не попадает в **Recent activity**.

Тестовые данные

- **Signup / Login** → **Signup**; пароль `TestPasswordOnly123`.

Шаги

1. Введите email и пароль, Tab с поля пароля.

   **Ожидаемый результат:** в **Recent activity** **нет** `TestPasswordOnly123`.

## ACT-004. Submit формы Signup

Приоритет: Medium  
Тип: Functional  
Цель: Submit фиксируется без значений полей.

Шаги

1. На **Signup** заполните обязательные поля выдуманными данными → **Create Account**.

   **Ожидаемый результат:** в **Recent activity** запись про submit или form; **нет** email и пароля в тексте.

## ACT-005. Maximum Actions per session

Приоритет: Medium  
Тип: Functional  
Цель: Лимит останавливает рост **Actions** в новой сессии.

Предусловия

- **Settings** → **Limits** → **Maximum Actions per session** = **10** → **Settings saved.**; **Delete session** или замена сессии → **Start capture**.

Шаги

1. Многократно **Products** и **Cart** (больше десяти раз).

   **Ожидаемый результат:** **Actions** в **Capture summary** не больше **10**; panel отвечает без зависания.
