# UI issues

UI collector на Collector diagnostics. Сессия — [session-management.md](./session-management.md). Пользовательские правила — [settings-privacy-limits.md](./settings-privacy-limits.md). Issues — после **Stop and review** → **Review** → **UI**.

## Подготовка extension

**Settings** → **Capture** → **Capture UI issues** включён → **Settings saved.**

## Collector diagnostics

```bash
python -m http.server 8765 --directory tests/fixtures
```

URL: `http://127.0.0.1:8765/collector-diagnostics.html`

Кнопка: **Create UI issue** (текст на странице **Diagnostics UI issue**).

DevTools → **Console** для скриптов в кейсах.

## UI-001. Alert после Start

Приоритет: High  
Тип: Functional  
Цель: Видимый alert после старта попадает в UI issues.

Шаги

1. **Start capture** → **Capturing this tab** (на странице нет alert). **Create UI issue**.

   **Ожидаемый результат:** на странице **Diagnostics UI issue**; **Potential issues** +1; **Recent activity** — **UI error: Diagnostics UI issue**.

2. **Stop and review** → **Review** → **UI**.

   **Ожидаемый результат:** карточка **UI error: Diagnostics UI issue**.

## UI-002. Initial scan до Start

Приоритет: High  
Тип: Functional  
Цель: Alert до **Start** попадает в Review сразу после старта.

Тестовые данные

```javascript
const el = document.createElement('div');
el.setAttribute('role', 'alert');
el.textContent = 'BCA initial scan alert';
document.body.appendChild(el);
```

Шаги

1. Без capture выполните скрипт в **Console**.

   **Ожидаемый результат:** на странице виден **BCA initial scan alert**.

2. **Start capture**.

   **Ожидаемый результат:** **Potential issues** минимум **1**; **Recent activity** — **UI error: BCA initial scan alert**.

3. **Stop and review** → **Review** → **UI**.

   **Ожидаемый результат:** карточка **UI error: BCA initial scan alert**.

## UI-003. Скрытый alert

Приоритет: Medium  
Тип: Negative  
Цель: Скрытый `[role="alert"]` не создаёт issue.

Тестовые данные

```javascript
const el = document.createElement('div');
el.setAttribute('role', 'alert');
el.setAttribute('hidden', '');
el.textContent = 'BCA hidden alert must not capture';
document.body.appendChild(el);
```

Шаги

1. При **Capturing this tab** выполните скрипт.

   **Ожидаемый результат:** **Potential issues** не увеличилось из‑за этого alert; в **Recent activity** **нет** `BCA hidden alert must not capture`.

2. **Stop and review** → **Review** → **UI**.

   **Ожидаемый результат:** список пуст или **No issues in this category.**; **нет** скрытого текста.

## UI-004. Повтор alert

Приоритет: Medium  
Тип: Functional  
Цель: Два **Create UI issue** — одна карточка с occurrences.

Шаги

1. **Capturing this tab**; два раза **Create UI issue**.

   **Ожидаемый результат:** **Potential issues** +1 относительно начала; **Recent activity** — **UI error: Diagnostics UI issue** и **2 occurrences**.

2. **Stop and review** → **UI**.

   **Ожидаемый результат:** одна карточка **UI error: Diagnostics UI issue** с **`· 2 occurrences`**.

## UI-005. Динамический alert с новым текстом

Приоритет: Medium  
Тип: Functional  
Цель: Новый видимый alert после удаления старого снова попадает в Review.

Тестовые данные

```javascript
document.querySelectorAll('[role="alert"]').forEach((n) => n.remove());
const el = document.createElement('div');
el.setAttribute('role', 'alert');
el.textContent = 'BCA second ui alert';
document.body.appendChild(el);
```

Шаги

1. **Create UI issue** при capture.

   **Ожидаемый результат:** **Potential issues** +1.

2. В **Console** выполните скрипт (удаление alerts и **BCA second ui alert**).

   **Ожидаемый результат:** **Potential issues** увеличилось ещё на **1**; **Recent activity** содержит **UI error: BCA second ui alert**.

3. **Stop and review** → **UI**.

   **Ожидаемый результат:** две разные карточки — **Diagnostics UI issue** и **BCA second ui alert**.
