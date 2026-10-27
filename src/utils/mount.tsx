import { StrictMode, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';

export function mountApp(app: ReactElement): void {
  const rootElement = document.getElementById('root');
  if (rootElement === null) {
    throw new Error('Root element was not found.');
  }

  createRoot(rootElement).render(<StrictMode>{app}</StrictMode>);
}
