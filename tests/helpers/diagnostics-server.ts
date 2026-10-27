import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import path from 'node:path';

const fixturePath = path.resolve('tests/fixtures/collector-diagnostics.html');

export function startDiagnosticsServer(): Promise<{
  baseUrl: string;
  server: Server;
}> {
  return new Promise((resolve, reject) => {
    const server = createServer((request, response) => {
      void (async () => {
        const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1:0');
        if (requestUrl.pathname === '/diagnostics-missing') {
          response.writeHead(404, { 'Content-Type': 'text/plain' });
          response.end('missing');
          return;
        }

        if (
          requestUrl.pathname === '/' ||
          requestUrl.pathname === '/diagnostics-spa-route'
        ) {
          response.setHeader('Content-Type', 'text/html; charset=utf-8');
          createReadStream(fixturePath).pipe(response);
          return;
        }

        if (requestUrl.pathname === '/page-two') {
          const html = await readFile(fixturePath, 'utf8');
          response.setHeader('Content-Type', 'text/html; charset=utf-8');
          response.end(
            html.replace('Collector diagnostics fixture', 'Page two'),
          );
          return;
        }

        response.writeHead(404);
        response.end('unknown');
      })().catch(() => {
        if (!response.headersSent) {
          response.writeHead(500);
        }
        response.end('error');
      });
    });
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address === null || typeof address === 'string') {
        reject(new Error('Could not resolve diagnostics server address.'));
        return;
      }
      resolve({ baseUrl: `http://127.0.0.1:${address.port}`, server });
    });
  });
}
