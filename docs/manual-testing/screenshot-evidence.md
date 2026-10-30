# Screenshot evidence

Скриншоты issues на Collector diagnostics. Сессия — [session-management.md](./session-management.md). Замена сессии — SES-006.

## Подготовка extension

По умолчанию **Settings** → **Screenshot evidence**: **Capture screenshots automatically** и **UI issues** включены; **Console issues** и **Network issues** для скриншотов **выключены**.

## Collector diagnostics

```bash
npm run diagnostics
```

URL: `http://127.0.0.1:8765/collector-diagnostics.html`

Кнопки: **Create UI issue**, **Create console error**, **Create fetch 404**.

Во время ожидания скриншота вкладка diagnostics должна быть **активной** (на переднем плане).

## SHOT-001. UI issue — thumbnail и просмотр

Приоритет: High  
Тип: Functional  
Цель: UI issue получает thumbnail и диалог просмотра.

Шаги

1. **Start capture** → **Create UI issue**; подождите до 5 с (вкладка diagnostics активна).

   **Ожидаемый результат:** **Stop and review** → **Review** → **UI** → у **UI error: Diagnostics UI issue** есть **Issue screenshot thumbnail** или **Capturing screenshot…**, затем thumbnail.

2. **View screenshot**.

   **Ожидаемый результат:** диалог **Screenshot preview**; Escape закрывает диалог.

## SHOT-002. Console и Network без thumbnail по умолчанию

Приоритет: High  
Тип: Functional  
Цель: Console и Network issues без включённых toggles не получают thumbnail.

Шаги

1. Убедитесь: **Console issues** и **Network issues** в **Screenshot evidence** **выключены**. **Start capture** на diagnostics.

   **Ожидаемый результат:** **Capturing this tab**.

2. **Create console error**; подождите 3 с. **Create fetch 404**; подождите 3 с.

   **Ожидаемый результат:** **Stop and review** → **Review** → у Console и Network карточек **нет** **Issue screenshot thumbnail** (только текст issue).

## SHOT-003. Один скриншот на два одинаковых UI issue

Приоритет: Medium  
Тип: Functional  
Цель: Повтор UI issue не создаёт второй captured screenshot.

Шаги

1. **Capturing this tab**; два раза **Create UI issue** (вкладка активна); **Stop and review**.

   **Ожидаемый результат:** на **Session Summary** строка **Screenshots: 1** (не **2**).

## SHOT-004. Remove screenshot

Приоритет: High  
Тип: Functional  
Цель: **Remove screenshot** удаляет кадр, issue остаётся.

Предусловия

- UI issue с thumbnail (как SHOT-001).

Шаги

1. **Review** → **UI** → **Remove screenshot** у issue с thumbnail.

   **Ожидаемый результат:** thumbnail исчез; текст **UI error: Diagnostics UI issue** остался; **Remove screenshot** для этой записи больше не показывается.

## SHOT-005. Лимит Maximum screenshots per session

Приоритет: Medium  
Тип: Functional  
Цель: При лимите второй UI screenshot помечается unavailable.

Предусловия

- **Settings** → **Maximum screenshots per session** = **1** → **Settings saved.**; **Delete session** → новый **Start capture** на diagnostics.

Тестовые данные

```javascript
const el = document.createElement('div');
el.setAttribute('role', 'alert');
el.textContent = 'BCA second ui for limit';
document.body.appendChild(el);
```

Шаги

1. **Create UI issue** → дождитесь thumbnail. В **Console** выполните скрипт второго alert; подождите 5 с.

   **Ожидаемый результат:** **Stop and review** → **Review** → у второго UI issue текст **Screenshot unavailable: session screenshot limit reached** или нет второго thumbnail; на Summary в сумме по карточкам багов **1 screenshot**.

## SHOT-006. Новая сессия без старых скриншотов

Приоритет: Medium  
Тип: Functional  
Цель: **Start new capture** убирает evidence прошлой сессии.

Предусловия

- Сессия с UI thumbnail (SHOT-001); **Session Summary**.

Шаги

1. **Start new capture** → подтвердите замену → **Stop and review** без новых issues.

   **Ожидаемый результат:** **No potential bugs detected**; карточек багов и кнопки **Review** нет; старый thumbnail **не** показывается.
