# Session management

Управление **текущей сессией** в side panel: старт, пауза, остановка, замена, удаление, вкладки, восстановление. Collectors, **Review**, **Settings** и скриншоты здесь не проверяются.

## Общая подготовка

1. `npm run build` → **Load unpacked** → `.output/chrome-mv3` на `chrome://extensions` (**Developer mode**).
2. Откройте `https://automationexercise.com/`, сделайте вкладку **активной**.
3. Side panel: иконка **Bug Capture Assistant** на toolbar.
4. Если видите **Session Summary** или старые записи в **Recent activity**: **Delete session** → подтвердите **Delete session** в **Delete this session?**, либо **Start new capture** → подтвердите **Start new capture** в **Replace current session?**. Должна остаться кнопка **Start capture**.

См. также [README.md](./README.md).

## SES-001. Side panel и Start capture

Приоритет: High  
Тип: Functional  
Цель: Открыть side panel с toolbar и начать capture на активной вкладке.

Предусловия

- Общая подготовка выполнена; side panel закрыт; активна Automation Exercise.

Шаги

1. На toolbar нажмите иконку **Bug Capture Assistant**.

   **Ожидаемый результат:** side panel с **Bug Capture Assistant** и **Settings**; popup extension не открылся.

2. Убедитесь, что активна Automation Exercise. Нажмите **Start capture**.

   **Ожидаемый результат:** кратко **Starting capture…**, затем **Capturing this tab**; **Capturing** с hostname сайта; **Page title:** как у вкладки; **Page:** с путём; кнопки **Pause** и **Stop and review**.

3. Наведите курсор на иконку extension.

   **Ожидаемый результат:** badge **REC**.

## SES-002. Pause и Resume

Приоритет: High  
Тип: Functional  
Цель: На **Capture paused** Actions не растут; после **Resume** снова растут.

Предусловия

- **Capturing this tab** на Automation Exercise; side panel открыт.

Шаги

1. В **Capture summary** запишите **Actions**.

   **Ожидаемый результат:** число записано.

2. Нажмите **Pause**.

   **Ожидаемый результат:** **Capture paused**; badge **II**.

3. На web-странице один раз **Products**.

   **Ожидаемый результат:** **Actions** не изменилось относительно шага 1.

4. Нажмите **Resume**. Запишите **Actions**.

   **Ожидаемый результат:** **Capturing this tab**; badge **REC** (если нет числового badge из‑за issues).

5. На web-странице один раз **Cart**.

   **Ожидаемый результат:** **Actions** увеличилось ровно на один относительно шага 4; в **Recent activity** новая строка.

## SES-003. Capture при закрытом side panel

Приоритет: High  
Тип: Functional  
Цель: Закрытие side panel не останавливает capture на отслеживаемой вкладке.

Предусловия

- **Capturing this tab**; side panel открыт.

Шаги

1. Запишите **Actions** в **Capture summary**.

   **Ожидаемый результат:** число записано.

2. Закройте side panel.

   **Ожидаемый результат:** panel скрыт; badge **REC** или число issues.

3. На той же вкладке один раз **Test Cases**.

   **Ожидаемый результат:** panel закрыт; badge не пустой.

4. Откройте side panel с toolbar.

   **Ожидаемый результат:** **Capturing this tab**; **Actions** больше шага 1 минимум на один; в **Recent activity** есть действие с шага 3.

## SES-004. Другая вкладка не смешивает Actions

Приоритет: High  
Тип: Integration  
Цель: Capture остаётся на вкладке A; на B — **Capture is running in another tab**; клики на B не увеличивают **Actions** на A.

Предусловия

- **Вкладка A:** Automation Exercise, **Start capture**, **Capturing this tab**.
- **Вкладка B:** новая вкладка с тем же URL.

Шаги

1. На **A** запишите **Actions** в **Capture summary**.

   **Ожидаемый результат:** число записано.

2. На **B** один раз **Products** (side panel может быть закрыт).

   **Ожидаемый результат:** шаг выполнен без ошибки страницы.

3. На **B** откройте side panel.

   **Ожидаемый результат:** **Capture is running in another tab**; hostname **A**; **Go to captured tab**; **Pause** и **Stop and review** доступны.

4. **Go to captured tab**.

   **Ожидаемый результат:** активна **A**; **Capturing this tab**.

5. Сравните **Actions** на **A** с шагом 1.

   **Ожидаемый результат:** **Actions** то же, что на шаге 1.

## SES-005. Stop and review и Session Summary

Приоритет: High  
Тип: Functional  
Цель: **Stop and review** открывает итог сессии.

Предусловия

- **Capturing this tab**; **Actions** больше нуля (например после **Products**).

Шаги

1. **Stop and review**.

   **Ожидаемый результат (сессия без issues):** **Session Summary**; **Reviewing**; **Duration**; блок **Session completed** с **No potential bugs detected** и числом **recorded Actions**; **View activity**; **Start new capture**; **Delete session** отдельно внизу. Нет **Describe a problem**, **Document actions**, **Bug context**, **Report scope** и **Bug report preview**.

1a. **View activity**.

**Ожидаемый результат:** список **Recorded activity** без строк вида **Clicked a button.**; **Hide activity** сворачивает список.

1b. Новая сессия: **Create action event** → **Create UI issue**, подождите больше 3 с → **Create console error** → **Stop and review**.

**Ожидаемый результат:** заголовок **2 potential bugs captured**; две карточки **Potential bug 1** и **Potential bug 2**. В каждой — **Factual description** только из фактов (первая: **The page displayed “Diagnostics UI issue”.**, вторая: **A JavaScript error was recorded: “Diagnostics console error”.**), счётчики relevant Actions (не больше 5) / related issues / screenshots; **Generate prompt** disabled и **Coming next**; **Review**; **Exclude**.

1c. Повторно **Create UI issue** и **Create console error** в пределах 3 с от первого issue (до **Stop and review**).

**Ожидаемый результат:** issues на той же странице в течение 3 с объединены в одну карточку (счётчик related issues вырос); повторные одинаковые issues новых карточек не создают.

1d. **Exclude** на второй карточке.

**Ожидаемый результат:** карточка помечена **Excluded**, кнопка **Include**; заголовок **1 potential bug captured**.

1e. **Review** → **Back to summary**; затем закройте и снова откройте side panel.

**Ожидаемый результат:** **Issue Review** открывается и возвращает на **Session Summary**; карточки и статус **Excluded** сохранены.

2. Наведите курсор на иконку extension.

   **Ожидаемый результат:** badge пустой.

## SES-006. Start new capture с подтверждением

Приоритет: High  
Тип: Integration  
Цель: Замена сессии на Summary требует подтверждения и очищает старые данные.

Предусловия

- **Session Summary**; **Total actions** или **Potential issues** больше нуля.

Шаги

1. **Start new capture**.

   **Ожидаемый результат:** **Replace current session?**; **Starting a new capture will delete the current session data.**; **Start new capture** и **Keep current session**.

2. **Keep current session**.

   **Ожидаемый результат:** диалог закрыт; остаётесь на **Session Summary**; данные сессии сохранены; краткое сообщение **Current session kept.**; счётчики не обнулились.

3. Снова **Start new capture** → подтвердите **Start new capture**. Web-страницу **не** перезагружайте.

   **Ожидаемый результат:** **Capturing this tab**; нет **Capture could not start on this page.**; нет карточек **Potential bug**; **Recent activity** без записей удалённой сессии.

4. **Stop and review**.

   **Ожидаемый результат:** **Session Summary** без данных прежней сессии в **Recent potential issues** (если блок есть).

## SES-007. Delete session и Start без F5

Приоритет: High  
Тип: Functional  
Цель: **Delete session** возвращает экран **Start capture**; новый **Start** на той же странице работает без перезагрузки.

Предусловия

- **Session Summary** после **Stop and review**.

Шаги

1. **Delete session**.

   **Ожидаемый результат:** **Delete this session?**; **This removes all actions, issues, dispositions, potential bugs, and screenshots from this session.**; **Delete session** и **Keep current session**.

2. **Keep current session**.

   **Ожидаемый результат:** **Session Summary** без изменений.

3. **Delete session** → подтвердите **Delete session**.

   **Ожидаемый результат:** side panel открыт; **Start capture**; нет **Session Summary**; **Recent activity** — **No activity yet. Explore the page to capture actions and issues.**

4. Badge на иконке extension пустой (нет **REC**, **II**, числа issues).

   **Ожидаемый результат:** как описано.

5. Без F5 нажмите **Start capture**.

   **Ожидаемый результат:** **Capturing this tab**; нет **Capture could not start on this page.**

6. На web-странице один раз **Create action event** (diagnostics) или **Products** (Automation Exercise).

   **Ожидаемый результат:** **Actions** равно **1**; одна новая строка в **Recent activity**.

7. Повторите цикл **Stop and review** → **Delete session** → **Start capture** → одно действие на той же вкладке **без F5** ещё **четыре раза** (всего пять циклов). В одном цикле перед **Stop** выполните **Create UI issue** и **Capture bug now** с заметкой, дождитесь **Bug captured**.

   **Ожидаемый результат:** каждый раз **Capturing this tab**; **Actions** снова **1** после одного действия; нет карточек **Potential bug**, старых issues и скриншотов удалённой сессии; нет **Capture could not start on this page.**

## SES-008. F5 на отслеживаемой вкладке

Приоритет: Medium  
Тип: Recovery  
Цель: После F5 сессия не сбрасывается в idle.

Предусловия

- **Capturing this tab** на Automation Exercise.

Шаги

1. **Products**; запомните последнюю строку **Recent activity**.

   **Ожидаемый результат:** в ленте есть запись.

2. F5 на той же вкладке.

   **Ожидаемый результат:** сайт снова загружен.

3. Откройте side panel при необходимости.

   **Ожидаемый результат:** **Capturing this tab** или **Reconnecting capture…**, затем **Capturing this tab**; не только **Start capture**; запись с шага 1 в **Recent activity** видна.

4. **Cart** на странице.

   **Ожидаемый результат:** **Actions** выросло; новая строка в **Recent activity**.

## SES-009. Reload extension

Приоритет: High  
Тип: Recovery  
Цель: После **Reload** extension capture на открытой HTTPS-вкладке снова запускается.

Предусловия

- Automation Exercise открыта; side panel закрыт до шага 3.

Шаги

1. `chrome://extensions` → **Reload** у **Bug Capture Assistant**.

   **Ожидаемый результат:** карточка extension без ошибки.

2. Вкладка Automation Exercise → DevTools (**F12**) → **Console** (контекст сайта).

   **Ожидаемый результат:** Console относится к сайту, не к side panel.

3. Side panel → **Start capture** → **Products** → **Cart**.

   **Ожидаемый результат:** **Capturing this tab**; новые строки в **Recent activity**.

4. В Console сайта нет серии одинаковых **Extension context invalidated** на каждый клик после **Start capture**.

   **Ожидаемый результат:** как описано (допустимо единичное сообщение сразу после Reload).

## SES-010. chrome:// без capture

Приоритет: High  
Тип: Negative  
Цель: На системной странице нет **Capturing this tab**.

Предусловия

- Активна `chrome://extensions`; side panel закрыт.

Шаги

1. Side panel → **Start capture**.

   **Ожидаемый результат:** **Capturing this tab** не появляется.

2. Текст в секции capture.

   **Ожидаемый результат:** **This browser page does not allow extension capture.**
