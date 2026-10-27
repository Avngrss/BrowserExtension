# Smoke checklist

Один сценарий критического пути (~10 минут). Сайт: `https://automationexercise.com/`. Подготовка extension — [session-management.md](./session-management.md) (общая подготовка), чистая сессия.

## SMOKE-001. Критический путь capture

Приоритет: High  
Тип: E2E  
Цель: Подтвердить загрузку extension, capture, паузу, фоновый режим и удаление сессии на обычном сайте.

Предусловия

- Выполнена общая подготовка; активна вкладка Automation Exercise.

Шаги

1. На панели инструментов нажмите иконку **Bug Capture Assistant**.

   **Ожидаемый результат:** открылся side panel с заголовком **Bug Capture Assistant** и кнопкой **Settings**; отдельное popup-окно extension не появилось.

2. В side panel нажмите **Start capture**.

   **Ожидаемый результат:** заголовок **Capturing this tab**; строка **Capturing** с hostname Automation Exercise; кнопки **Pause** и **Stop and review**; на иконке extension badge **REC**.

3. На web-странице один раз нажмите **Products** в меню сайта.

   **Ожидаемый результат:** в **Capture summary** (**Actions**) число увеличилось на один; в **Recent activity** новая строка.

4. В side panel нажмите **Pause**.

   **Ожидаемый результат:** заголовок **Capture paused**; badge **II**.

5. На web-странице один раз нажмите **Cart**.

   **Ожидаемый результат:** **Actions** в **Capture summary** не изменилось относительно значения после шага 3.

6. Нажмите **Resume**.

   **Ожидаемый результат:** заголовок **Capturing this tab**; badge **REC** (или число issues, если они уже есть).

7. Закройте side panel способом, принятым в вашем Chrome (кнопка закрытия panel или повторный клик по иконке extension).

   **Ожидаемый результат:** panel скрыт; badge на иконке extension по-прежнему **REC** или число issues, не пустой.

8. На той же вкладке один раз нажмите **Test Cases** в меню сайта.

   **Ожидаемый результат:** side panel закрыт; badge не сброшен в пустой.

9. Снова откройте side panel с toolbar.

   **Ожидаемый результат:** **Capturing this tab**; **Actions** больше, чем после шага 3; в **Recent activity** есть действие с шага 8.

10. Нажмите **Stop and review**.

    **Ожидаемый результат:** **Session Summary**; подпись **Reviewing**; **Total actions** больше нуля.

11. Нажмите **Delete session** → в диалоге **Delete this session?** нажмите **Delete session**.

    **Ожидаемый результат:** side panel открыт; видна кнопка **Start capture**; заголовка **Session Summary** нет; в **Recent activity** текст **No activity yet. Explore the page to capture actions and issues.**
