# Bug Capture Assistant — project handoff context

Last verified against the repository implementation and test suite (not chat history). When this file disagrees with the code, **the code wins**—update this document after confirming in the tree.

---

## Project overview

**Bug Capture Assistant** is a Chrome Manifest V3 extension (WXT) that records a single **monitored tab** during manual or exploratory testing. It captures **Actions**, **UI / Console / Network issues**, optional **screenshot evidence**, and derives **Potential bugs** for later prompt-based reporting.

- **Repository layout (high level):**
  - `entrypoints/` — WXT entrypoints: `background.ts`, `content.ts`, `sidepanel/`, `options/`, `collector-diagnostics/`
  - `src/` — domain models, collectors, stores, messaging, React UI, `potential-bugs/`, `screenshots/`, `bug-report/` (legacy report builders), `issue-marks/` (legacy mark store)
  - `tests/unit/` — Vitest (79 files, 308 tests at last `npm run check`)
  - `tests/extension/` — Playwright against built `.output/chrome-mv3`
  - `tests/fixtures/collector-diagnostics.html` — deterministic collector triggers
  - `docs/manual-testing/` — Russian manual QA cases (English UI strings in steps)
  - `public/content-scripts/console-bridge.js` — MAIN-world bridge (built via `scripts/build-console-bridge.mjs`)

---

## Primary product goal

**Minimize tester effort while maximizing useful context for fast, high-quality bug reporting.**

Product promise: **A bug appears. The useful context is already captured.**

The extension should stay **simple**, **local and transparent by default**, **focused on speeding up bug reporting**, **provider-independent**, useful for **quick capture** and **exploratory testing**, and **free of mandatory forms and excessive configuration**.

---

## Product slogan and decision principles

- Prefer **automatic capture** over manual note-taking.
- **One Potential bug per reportable problem**, not one giant session report.
- **Factual descriptions** from evidence; do not invent expected behavior or root cause.
- **Privacy by default** (URL redaction, sensitive field handling).
- **Remove visible complexity** before adding new controls.
- **No cloud / LLM / tracker dependency** in the current scope.

---

## Target users and core use cases

- QA and developers doing **exploratory testing** or **ad-hoc reproduction**.
- Testers who need **structured evidence** (steps, console, network, UI alerts, screenshots) without writing a report from scratch.
- Teams that will later paste a **generated prompt** into any issue tracker or AI assistant (not built yet).

---

## Current user workflow

**Intended primary flow (product direction):**

`Start capture` → test normally → **Potential bugs captured automatically** → **Stop and review** → **Create ticket**

**Implemented today:**

1. Open side panel (toolbar icon opens panel; no popup).
2. On an `http`/`https` tab, **Start capture** → **Capturing this tab** when the monitored tab is bound and collectors are ready.
3. While **recording** or **paused**: explore the page; Actions and issues accumulate; **Potential issues** counter reflects unique UI + Console + Network issues.
4. **Stop and review** → **Session Summary**:
   - **No bugs:** “Session completed”, “No potential bugs detected”, recorded Actions count, **View activity**, **Start new capture**, **Delete session**.
   - **With bugs:** headline `N potential bugs captured` ( **included** bugs only ), one **Potential bug** card each: factual description, **Create ticket** (disabled on excluded cards with “Include this bug to create a ticket.”), **Exclude** / **Include**. Summary has **Issues** (session-wide Issue Review).
5. **Create ticket** on a card opens the **Bug ticket** screen: screenshot for this bug (if captured), a read-only draft ticket, **Copy ticket**, and **Back to summary**.
6. **Review** on a card opens shared **Issue Review** (all session issues, dispositions, screenshots)—not a per-bug filtered view.
7. **Settings** (options page): capture toggles, privacy, limits, UI rules, screenshots, notifications, extra bug-ticket prompt instructions.

**Not in UI:** session-level **Bug context** form, **Report scope**, **Bug report preview**, **Mark issue**, **Capture bug now**.

---

## Current technical stack

| Area                | Choice                               |
| ------------------- | ------------------------------------ |
| Extension framework | WXT 0.21, MV3                        |
| UI                  | React 19, Tailwind CSS 4             |
| Language            | TypeScript 5.9                       |
| Unit tests          | Vitest 5, Testing Library            |
| E2E                 | Playwright 1.64 (`tests/extension/`) |
| Runtime             | Node.js ≥ 22                         |
| Browser             | Chrome / Edge 114+ (side panel API)  |

See `package.json`, `wxt.config.ts`, root `README.md`.

---

## Current architecture and execution contexts

| Context                       | Role                                                                                                                             |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Service worker**            | `entrypoints/background.ts` — session backend, stores, screenshot queue, Potential bug coordinator, router, badge, notifications |
| **Content script** (isolated) | `entrypoints/content.ts` → `src/capture/run-content-script.ts` — action/UI/console/network collectors, session sync, readiness   |
| **MAIN world**                | `public/content-scripts/console-bridge.js` — console/network hooks where CSP requires it                                         |
| **Side panel**                | `entrypoints/sidepanel/` — Capture, Summary, Issue Review                                                                        |
| **Options**                   | `entrypoints/options/` — extension settings and custom UI rules                                                                  |
| **Collector diagnostics**     | WXT page + local HTTP fixture: `tests/helpers/diagnostics-server.ts` (Playwright), `npm run diagnostics` on port 8765 (manual)   |

**Messaging:** typed messages in `src/messaging/*`; side panel uses runtime `sendMessage` + broadcast subscriptions (`src/utils/*-client.ts`).

**Persistence:**

- `chrome.storage.session` — active session, session-scoped Actions, issues, issue dispositions (on issue records), IssueMark (legacy), BugReportContext (legacy), **Potential bugs** (`bugCaptureAssistant.sessionPotentialBugs`)
- `chrome.storage.local` — `extensionSettings.v1`, UI rules
- **IndexedDB** — screenshot frames/blobs/links (`src/screenshots/screenshot-idb.ts`, DB name `bug-capture-screenshots`)

Session memory is also held in an in-memory store synchronized with session storage via `PersistentSessionStore`.

---

## Implemented functionality

### Collectors and their current boundaries

All collectors run only on the **bound target tab** while session status is **recording** (content script gates on active session).

| Collector     | Source                                                                                         | Boundaries / notes                                                                                                                   |
| ------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Actions**   | Clicks, submit, navigation (incl. History API bridge), debounced text/change on allowed fields | Respects `capture.captureActions`; privacy skips/redacts password fields and can omit text field values; URLs sanitized per settings |
| **UI issues** | DOM rules + built-in detectors (`ContentUiIssueCollector`)                                     | User rules in options; max unique issues per session; duplicates increase `occurrenceCount` only                                     |
| **Console**   | `console.error` + uncaught errors / unhandled rejections (bridge + content)                    | Settings toggle; not retroactive to pre-session DevTools history                                                                     |
| **Network**   | Failed fetch/XHR via bridge                                                                    | Settings toggle; captures failure metadata, not full bodies                                                                          |

Collectors report **readiness** flags; side panel shows capture phase / retry via `useCaptureReadiness`.

**Duplicate issues:** stores call `onNewUniqueIssue` only for **new unique** issues; repeats do not create new Potential bugs.

### Session lifecycle and target-tab behavior

States: **idle** → **recording** ↔ **paused** → **stopped** (see `src/domain/session.ts`, `src/sessions/lifecycle.ts`).

- **Start** requires a **target tab binding** (tab id + sanitized URL). Unsupported tabs (e.g. `chrome://`) fail with user-visible guidance.
- **Stop** keeps data for Summary; **Delete session** or **Start new capture** (with replace confirm when preserved data exists) clears artifacts.
- `PersistentSessionStore` persists to session storage, resolves target tab, bootstraps content script (`content-tab-bootstrap`), and delivers session state to the target tab.
- **Pause / resume** supported; screenshot auto-capture follows recording rules.

### Background capture, badge, and notifications

- Toolbar **badge** reflects recording / issue signal (`src/background/capture-indicators-runtime.ts`, `src/capture/capture-action-badge.ts`).
- **Notifications:** title **Potential bug captured**; fired only when a **new** Potential bug is created from a **new unique** issue (`src/notifications/issue-notification-service.ts`). Grouping and duplicate issues do not notify. Gated by settings and active recording session.

### Screenshot evidence and IndexedDB storage

- Queue in `ScreenshotCaptureQueue`; capture via `chrome.tabs.captureVisibleTab` path in `src/screenshots/monitored-tab-capture.ts`.
- Triggered on **new unique** issues (category settings) and for manual bugs via `requestCaptureForBug` (mark category link with `issueId = bug.id`).
- Session cap `screenshots.maxPerSession`; JPEG processing in `jpeg-process.ts`.
- UI: Issue Review thumbnails, remove screenshot, viewer modal; Summary cards show **per-bug screenshot count** via `countPotentialBugScreenshots`.

### Privacy and redaction

- URL: sensitive query params, optional hash removal (`src/privacy/url-sanitizer.ts`). Display paths omit long query strings (`formatActionTimelinePath`); ticket Environment is origin + pathname.
- Field values: optional never-store for text fields; password/private field protection.
- Applied in collectors and session URL fields via settings service.

### Current UI surfaces

| Surface                | Purpose                                                           |
| ---------------------- | ----------------------------------------------------------------- |
| **Capture**            | Start/pause/resume/stop, timeline, counts                         |
| **Session Summary**    | Potential bug cards or empty session result; activity expansion   |
| **Issue Review**       | Category tabs, include/exclude/expected, screenshot evidence      |
| **Bug ticket**         | Draft ticket + optional AI prompt for one Potential bug           |
| **Settings / Options** | Collectors, privacy, limits, screenshots, notifications, UI rules |

---

## Manual testing and automated testing

### Manual

- **`docs/manual-testing/README.md`** — build/load, two page types (Automation Exercise + collector diagnostics), run order.
- Cases are **Russian**; UI strings in steps match **English** product copy.
- Explicitly **not** documented as implemented: Export file, extra Prompt Builder modes, in-extension LLM, webhooks, Jira/YouTrack, past session history.

### Automated

- **Vitest:** `npm run test:run` — domain, stores, coordinators, side panel flows (mocked extension clients in `tests/setup.ts`).
- **Playwright:** `npm run test:e2e` (= build + test); loads `.output/chrome-mv3`; **workers: 1**; helpers in `tests/helpers/extension-playwright.ts`:
  - Prefer **`startRecordingOnPage`** (runtime message + monitored tab focus) over clicking **Start capture** from the side panel alone.
  - **`clickSidePanelControl`** — evaluate click so the monitored page stays focused.
- **Key extension specs:** `potential-bugs.spec.ts` (two auto bugs, exclude, review, delete→start), `delete-start-repeated.spec.ts` (five delete/start cycles), collector/settings/navigation/screenshot suites.
- **Removed** (obsolete UI): `mark-issue-flow`, `report-preview-*`, `session-summary-compact`, `session-summary-adaptive`.

### Windows PowerShell

- Use **`npm.cmd`** / **`npx.cmd`** (not bare `npm`/`npx` if policy requires).
- Chain with **`;`**, not `&&`.
- Line endings: `.gitattributes` forces **LF** (`* text=auto eol=lf`) to match Prettier `endOfLine: lf`. Without it, `core.autocrlf=true` checks out CRLF and `format:check` fails on every file. Clones made before `.gitattributes` existed need a one-time LF re-checkout of the working tree.

### Fresh clone

- `postinstall` runs `scripts/build-console-bridge.mjs` before `wxt prepare`. The bridge file is gitignored; without it WXT omits `/content-scripts/console-bridge.js` from `ScriptPublicPath` and `typecheck` fails in `src/sessions/content-tab-bootstrap.ts`.

### Playwright browser install

- **`npm run check` does not install browsers.**
- Do **not** run `npx playwright install chromium` proactively.
- Install only when Playwright reports a **missing executable** (see root `README.md`).
- CI/sandbox may need `PLAYWRIGHT_BROWSERS_PATH` pointing at an existing cache.

### Verification expectations for changes

- Default gate: **`npm run check`** (typecheck, lint, format, unit tests, production build).
- Feature work: add/update **focused Vitest** tests; add/update **affected Playwright** spec when behavior crosses extension boundaries.
- Lifecycle changes: verify **Delete session → Start capture** on the **same page without reload** (unit: `session-delete-reset.test.tsx`; E2E: `delete-start-repeated.spec.ts`, `potential-bugs.spec.ts`).
- Near MVP: full manual regression per `docs/manual-testing/`.

---

## Known lifecycle risks and previously fixed regressions

### Delete session → Start capture (same tab, no reload)

Historically intermittent failures: side panel stuck idle, “Open an HTTP or HTTPS page…”, stale Summary/mark data, or capture not starting after delete/replace.

**Current mitigations (implemented):**

- Centralized **`clearSessionArtifacts`** on delete/replace (`entrypoints/background.ts`) — clears actions, issues, screenshots IDB, legacy mark/context, **Potential bugs**, broadcasts empty state.
- Target-tab session sync after delete (`onSessionDeletedOnTab`).
- Content script bootstrap / readiness diagnostics (`capture-start-diagnostics.ts`).
- Playwright **`startRecordingOnPage`** with message timeout to avoid hung `sendMessage`.

**Status:** **Not proven permanently solved.** Unit and targeted E2E cover repeated cycles; some Playwright specs still use raw side-panel **Start capture** clicks and may fail if the **monitored tab is not focused** (symptom: alert “Open an HTTP or HTTPS page tab…”). Treat lifecycle edits as **high risk** until targeted E2E pass locally.

### Other regressions addressed in tests

- Side panel stealing focus broke manual capture controls — mitigated by **`clickSidePanelControl`** in E2E helpers.
- Screenshot burst / stop must not block Summary — covered by burst specs.
- IndexedDB migration / InvalidStateError — `screenshot-idb-regression.spec.ts`.

---

## Current reporting UX and its problems

**Past direction (partially removed from primary UI):**

- Session-level **Mark issue** (one mark per session, replace confirm).
- Prominent **Bug context** (“What happened?”, “What was expected?”), **Report scope**, and **Bug report preview** on Summary.

**Problem:** Session-level reporting became **too prominent and complex**; testers faced mandatory-style forms while the real unit of work is a **single bug**, not the whole session.

**Current UX (implemented):**

- Summary centered on **Potential bug cards** or a minimal **no bugs** result.
- **Create ticket** opens the **Bug ticket** draft for that card (see Prompt-first product direction).
- Factual one-line descriptions via `buildPotentialBugDescription` (note → UI → console → network drafts in `src/bug-report/factual-what-happened-draft.ts`).

**Legacy code still in repo (intentionally not deleted):**

- `src/sidepanel/build-session-report-preview.ts` (+ unit tests)
- `src/bug-report/bug-report-context-*`, `src/issue-marks/*`, messaging handlers in `background-router.ts`
- Orphan UI pieces: `SessionBugContextSection.tsx`, `ReportScopeChoices.tsx` (not mounted in `App.tsx`)

Do **not** recommend deleting structured report code until Prompt Builder reuses or replaces it deliberately. The prompt already reuses `describeUiIssue` and `report-technical-evidence.ts` formatters; `build-session-report-preview.ts` itself is still unused by the UI.

---

## Intended Potential bug model

### Implemented

| Requirement                                                                                   | Implementation                                                                             |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Auto create/update on new **unique** issue (while **recording**, not paused)                  | `PotentialBugCoordinator.handleNewUniqueIssue` ← `dispatchNewUniqueIssue` in background    |
| Fields: id, sessionId, timestamps, page, ≤5 meaningful actions, issues, status, optional note | `src/domain/potential-bug.ts`, grouping in `potential-bug-grouping.ts`                     |
| Group same page within **3 s** (`POTENTIAL_BUG_GROUPING_WINDOW_MS`)                           | `applyDetectedIssue`; page key = origin + pathname of session target URL                   |
| Later unrelated issue → new bug                                                               | Window slides from `lastDetectedAt`                                                        |
| Duplicates                                                                                    | No new bug; issue already linked → no-op                                                   |
| Meaningful actions                                                                            | `selectMeaningfulActions` + `refineActionStepEntries` (does **not** mutate stored Actions) |
| Manual fallback                                                                               | Removed from UI (**Capture bug now**). Store/message path may still exist.                 |
| Persistence                                                                                   | `chrome.storage.session` key `bugCaptureAssistant.sessionPotentialBugs`                    |
| Clear on session delete/replace                                                               | `potentialBugStore.clear()` in `clearSessionArtifacts`                                     |

### Partially implemented / unstable

- **Review** on a card opens **session-wide** Issue Review, not an isolated view for that bug’s issues/actions only.
- **Headline count** includes **included** bugs only; excluded cards remain visible.
- **Notifications** only for automatic new bugs.

### Legacy Mark issue (accurate status)

- **User-facing Mark issue flow is removed.**
- **IssueMark** store, storage, and router handlers **remain** for compatibility/tests; cleared with session artifacts; **not** used in side panel UI.
- User-facing **Capture bug now** is removed.

---

## Prompt-first product direction

**Implemented (first slice):**

- **Create ticket** shows a deterministic draft from `buildBugTicketDraft` (`src/bug-report/bug-ticket-draft.ts`) on `PotentialBugPromptScreen`. **Copy ticket** copies that markdown. Linked screenshots for that bug render on the same screen. The Senior QA prompt builder remains in code for a later in-extension LLM; it is not shown in the UI.
- Ticket shape: Title / Description / Steps / Actual / Expected / Severity / Priority / Labels / Environment, with a writing lens (`ui` / `console` / `network` / `mixed` / `observation`). Description states the page, the symptom, the steps before it, and other captured signals. Analytics noise such as `/g/collect` is left out unless the failed request itself is the bug. Network signals include HTTP 4xx/5xx and transport failures; analytics HTTP 200 is omitted. Display URLs stay short (no analytics query dump; opaque path ids become a readable page name in steps).
- Built in the side panel from data it already has; no extra permissions.
- **Settings → Bug ticket prompt** is hidden until an LLM writes the ticket from an editable agent.

**Planned (not implemented):**

- Download/export of a structured bundle (file).
- Additional prompt modes — only after the first mode is proven useful on real captures.
- Optional future integrations (Jira, webhooks, LLM providers) — **out of scope** until prompt quality is validated.

**Principles for prompts:**

- Safe, **evidence-only** facts; steps from refined actions; technical evidence from linked issues and screenshots.
- No invented root cause or extra UI. Expected Result comes from the tester note, or one conservative inverse of the actual result (the captured error/message/failure should not occur).

---

## Immediate next priorities

1. **Reconcile this file with the repo** after any drift (next AI session step zero).
2. **Manual acceptance of Potential bugs + Steps for bug ticket** — checklist in `docs/manual-testing/acceptance.md`: SES-005 steps 1b–1g, E2E-002 (prompt follows Review dispositions), E2E-004 step 4a.
3. **Validate ticket quality on real captures** — E2E-006 (Automation Exercise → Create ticket → Copy ticket); fix only what materially affects usefulness.
4. Keep Summary **card-centric**; resist re-expanding session-level forms on the primary screen.

Playwright lifecycle specs use **`startRecordingOnPage`** / **`clickSidePanelControl`** (full extension suite was green at last run).

---

## Explicitly postponed features

- Export prompt or session as a file
- Third-party integrations (Jira, YouTrack, webhooks)
- In-extension LLM calls
- Multi-tab simultaneous capture
- Historical archive of past sessions
- Per-bug Issue Review route (unless explicitly prioritized)

Documented as not implemented in `docs/manual-testing/README.md`.

---

## Rules for future AI-assisted work

1. **Inspect before changing** — read relevant `src/` and tests; run `npm run check` before handoff.
2. **One compact task at a time** — minimal diff; no drive-by refactors.
3. **Explain the current stage** before coding (what is implemented vs planned).
4. **Do not redesign unrelated architecture** (stores, messaging patterns) without cause.
5. **No features without clear bug-reporting value.**
6. **Preserve privacy and local-first behavior** — no silent exfiltration; respect settings.
7. **Update only affected manual cases** in `docs/manual-testing/` (Russian).
8. **Require focused tests** for behavior changes; self-review against regressions list above.
9. **Separate facts from assumptions** — if unsure, grep/read the file.
10. **Prefer removing visible complexity** over adding controls.

**Permissions / dependencies:** do not expand manifest permissions or npm dependencies unless the user explicitly requests it.

**Stored Actions:** do not mutate historical action records for display-only refinements (use preview/refinement layers).

---

## Continuation workflow (required after every task)

Every AI session that **implements** product or test behavior must follow this cycle. **Do not** start the next implementation task until the user reports manual acceptance (when manual testing was requested).

### After completing an implementation task

1. **Summarize what was actually implemented** (facts from the diff and tests, not plans).
2. **Report all verification results** (`npm run check`, targeted Playwright, anything else run).
3. **Separate clearly:**
   - **Confirmed working** — backed by passing automated tests or explicit user confirmation.
   - **Remaining defects** — known failures or flaky areas.
   - **Known limitations** — intentional partial behavior (e.g. Review is session-wide).
   - **Postponed ideas** — explicitly out of scope for this task.
4. **Decide feature acceptance readiness** — is the changed feature ready for the user to accept on its own?
5. **Provide one short manual acceptance scenario** (Russian or English UI strings as in the product) focused **only** on the changed feature.
6. **Wait for the user’s manual-test result** before starting another implementation task.

### If automated and manual checks pass

1. **Reassess the product stage** against the primary goal: _Minimize tester effort while maximizing useful context for fast, high-quality bug reporting._
2. **Identify the next smallest high-value product step** (not the longest roadmap item).
3. **Explain briefly in Russian:**
   - current stage;
   - why the next step is valuable;
   - what the user should see after completion;
   - what remains explicitly out of scope.
4. **Propose exactly one compact implementation prompt in English.**
5. **Do not start implementation automatically.**
6. **Do not** propose several competing roadmaps unless the current direction is genuinely blocked.

### If checks fail

1. **Stop** progression to the next feature.
2. **Analyze the confirmed failure** (reproduce, root cause).
3. **Propose one focused fix task only** — no unrelated refactoring or new functionality.
4. **Repeat feature acceptance** after the fix.

### High-level sequence after Potential bugs

1. Stabilize automatic Potential bug creation, grouping, persistence, and repeated session lifecycle.
2. Validate Potential bug cards via focused automated and manual tests.
3. Implement the **first Prompt Builder mode** for one selected Potential bug: **Steps for bug ticket** — **done** (pending manual acceptance).
4. Validate prompt quality on real captured examples; improve only what materially affects usefulness.
5. Consider additional prompt modes only after the first mode is proven valuable.
6. **Copy ticket** is implemented; file export and in-extension LLM remain postponed.
7. Full manual regression near MVP completion.
8. Integrations, manual visual-bug capture, extra collectors, session history — **only after** core MVP is stable.

The AI must **not** continue merely because the roadmap lists another item.

### Before proposing the next task, verify it

- Directly accelerates bug reporting.
- Improves report quality or reproducibility.
- Does not add unnecessary tester interaction.
- Does not expose internal complexity on the primary UI.
- Is **smaller and more valuable** than available alternatives.

### When MVP scope is complete

State explicitly that MVP scope is complete. Propose **stabilization, regression, documentation, or release preparation** — not a new feature by default.

---

## How to verify changes locally

```bash
npm install
npm run check
```

Optional E2E (Chromium must already exist):

```bash
npm run build
npx.cmd playwright test tests/extension/potential-bugs.spec.ts
```

Load unpacked: `.output/chrome-mv3` → `chrome://extensions`.

Manual smoke: `docs/manual-testing/smoke-checklist.md`.

---

## First task for the next AI session

1. Clone/open repo; read **`PROJECT_CONTEXT.md`** and root **`README.md`**.
2. Run **`npm run check`**; note any failures.
3. **Compare** Summary UI, Potential bug stores, and tests to this document; **report inconsistencies** to the user.
4. **Analyze** `src/potential-bugs/*`, `SessionSummaryScreen.tsx`, and `entrypoints/background.ts` (`dispatchNewUniqueIssue`, `clearSessionArtifacts`).
5. **Propose the smallest safe next task** (likely prompt-quality fixes from real captures, then Export/Copy, or Playwright lifecycle hardening)—**do not implement** until the user confirms.

---

## Product direction to preserve

- **Start capture → test normally → automatic Potential bugs → Stop → Create ticket** (draft ticket implemented; file export still ahead).
- Main artifact = **`PotentialBug` records**, not a monolithic session report.
- Keep evidence rich **internally** and in **Review**; keep **Summary** simple.
- Central goal unchanged: **minimum tester effort, maximum useful context** for fast, high-quality bug reports.
