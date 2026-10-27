# Issue Review

Экран **Issue Review** после **Session Summary**. Issues готовят на diagnostics — [console-issues.md](./console-issues.md), [network-issues.md](./network-issues.md), [ui-issues.md](./ui-issues.md).

Путь: **Stop and review** → **Review** → вкладки **All** / **UI** / **Console** / **Network** → **Back to summary**.

## REV-001. Include, Exclude и Mark as expected

Приоритет: High  
Тип: Functional  
Цель: Disposition меняет подпись и кнопки **Include** / **Exclude**.

Предусловия

- Diagnostics: **Create console error** → **Stop and review** → **Review** → **Console**.

Шаги

1. У issue нажмите **Exclude**.

   **Ожидаемый результат:** **Exclude** pressed; подпись **Excluded**; у скриншота (если есть) может быть **Excluded from future output**.

2. **Include**.

   **Ожидаемый результат:** **Included**; **Excluded from future output** не показывается.

3. Раскройте **More** → **Mark as expected**.

   **Ожидаемый результат:** подпись **Expected** и badge **Expected**.

4. **Include**.

   **Ожидаемый результат:** **Included**; **Expected** снята.

## REV-002. Фильтры категорий

Приоритет: Medium  
Тип: Functional  
Цель: Вкладки фильтруют список.

Предусловия

- Одна сессия: **Create UI issue**, **Create console error**, **Create fetch 404** → **Stop and review**.

Шаги

1. **Review** → вкладка **Console**.

   **Ожидаемый результат:** только Console issues; UI и Network не в списке.

2. **Network**, затем **All**.

   **Ожидаемый результат:** **Network** — только network; **All** — все три категории.

## REV-003. Bulk actions

Приоритет: Medium  
Тип: Functional  
Цель: **Include all**, **Exclude all**, **Mark all as expected** для текущего фильтра.

Предусловия

- Как REV-002; фильтр **All**.

Шаги

1. Раскройте **Bulk actions** → **Exclude all**.

   **Ожидаемый результат:** у всех видимых issues **Excluded**.

2. **Include all**.

   **Ожидаемый результат:** у всех **Included**.

3. **Mark all as expected**.

   **Ожидаемый результат:** у всех **Expected**.

## REV-004. Actions не попадают в Review

Приоритет: High  
Тип: Functional  
Цель: **Issue Review** показывает только issues, не Actions.

Предусловия

- Automation Exercise; **Start capture** → **Products** (diagnostics не используется).

Шаги

1. **Stop and review** → **Review**.

   **Ожидаемый результат:** **No issues in this category.** или пустой список; **нет** строк click/navigation из **Recent activity**.

2. **Back to summary**.

   **Ожидаемый результат:** **Total actions** больше нуля.
