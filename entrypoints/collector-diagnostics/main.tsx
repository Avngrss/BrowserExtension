import { injectHistoryBridge } from '@/src/capture/content-action-collector';
import { HISTORY_MESSAGE_TYPE } from '@/src/capture/content-action-collector';

const root = document.getElementById('root');
if (root === null) {
  throw new Error('Collector diagnostics root is missing.');
}

injectHistoryBridge(document);

const controls: { label: string; detail: string; action: () => void }[] = [
  {
    label: 'Create action event',
    detail: 'Expect a click action in the monitored session.',
    action: () => {
      document.getElementById('diagnostics-go')?.click();
    },
  },
  {
    label: 'Create UI issue',
    detail: 'Adds a visible [role="alert"] node for UI rules.',
    action: () => {
      const alert = document.createElement('div');
      alert.setAttribute('role', 'alert');
      alert.textContent = 'Diagnostics UI issue';
      document.body.appendChild(alert);
    },
  },
  {
    label: 'Create console error',
    detail: 'Expect a console.error issue after collectors are active.',
    action: () => {
      console.error('Diagnostics console error');
    },
  },
  {
    label: 'Create uncaught error',
    detail: 'Expect an uncaught error issue via the MAIN-world bridge.',
    action: () => {
      setTimeout(() => {
        throw new Error('Diagnostics uncaught error');
      }, 0);
    },
  },
  {
    label: 'Create unhandled rejection',
    detail: 'Expect an unhandledrejection issue.',
    action: () => {
      void Promise.reject(new Error('Diagnostics unhandled rejection'));
    },
  },
  {
    label: 'Create fetch 404',
    detail: 'Expect a network failure for GET /diagnostics-missing.',
    action: () => {
      void fetch('/diagnostics-missing').catch(() => undefined);
    },
  },
  {
    label: 'Create fetch 500',
    detail: 'Not supported on this fixture yet (404 route only).',
    action: () => {
      void fetch('/diagnostics-missing').catch(() => undefined);
    },
  },
  {
    label: 'Create XHR error',
    detail: 'Expect a network failure from XMLHttpRequest.',
    action: () => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', '/diagnostics-missing');
      xhr.send();
    },
  },
  {
    label: 'Navigate with History API',
    detail: 'Updates URL/title context without full reload.',
    action: () => {
      history.pushState({}, '', '/diagnostics-spa-route');
      document.title = 'Diagnostics SPA route';
      window.postMessage({ type: HISTORY_MESSAGE_TYPE }, '*');
    },
  },
  {
    label: 'Change page title',
    detail: 'Expect side panel page title to update.',
    action: () => {
      document.title = `Diagnostics title ${Date.now()}`;
    },
  },
];

root.innerHTML = `
  <main style="font-family: system-ui, sans-serif; max-width: 40rem; margin: 1rem auto; padding: 0 1rem;">
    <h1>Collector diagnostics</h1>
    <p>Development fixture for verifying real collector pipelines. Start capture on this tab, wait for readiness, then use the controls.</p>
    <button id="diagnostics-go" type="button" hidden aria-hidden="true">Hidden action target</button>
    <ul style="list-style: none; padding: 0; display: flex; flex-direction: column; gap: 0.75rem;"></ul>
  </main>
`;

const list = root.querySelector('ul');
if (list === null) {
  throw new Error('Collector diagnostics list is missing.');
}

for (const control of controls) {
  const item = document.createElement('li');
  item.style.border = '1px solid #cbd5e1';
  item.style.borderRadius = '0.5rem';
  item.style.padding = '0.75rem';
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = control.label;
  button.style.display = 'block';
  button.style.marginBottom = '0.35rem';
  button.addEventListener('click', control.action);
  const detail = document.createElement('p');
  detail.textContent = control.detail;
  detail.style.margin = '0';
  detail.style.fontSize = '0.85rem';
  detail.style.color = '#475569';
  item.append(button, detail);
  list.append(item);
}
