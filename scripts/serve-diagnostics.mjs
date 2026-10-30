import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const fixturesDir = path.join(rootDir, 'tests', 'fixtures');
const host = '127.0.0.1';
const port = 8765;

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

async function resolveFixture(urlPath) {
  const filePath = path.join(fixturesDir, decodeURIComponent(urlPath));
  if (!filePath.startsWith(fixturesDir + path.sep)) {
    return null;
  }
  try {
    return (await stat(filePath)).isFile() ? filePath : null;
  } catch {
    return null;
  }
}

const server = createServer((request, response) => {
  const { pathname } = new URL(request.url ?? '/', `http://${host}`);
  void resolveFixture(pathname).then((filePath) => {
    if (filePath === null) {
      response.writeHead(404, { 'Content-Type': 'text/plain' });
      response.end('Not found');
      return;
    }
    response.writeHead(200, {
      'Content-Type':
        contentTypes[path.extname(filePath)] ?? 'application/octet-stream',
    });
    createReadStream(filePath).pipe(response);
  });
});

server.on('error', (error) => {
  console.error(
    error.code === 'EADDRINUSE'
      ? `Port ${port} is already in use. Stop the other server and try again.`
      : error.message,
  );
  process.exit(1);
});

server.listen(port, host, () => {
  console.log(
    `Collector diagnostics: http://${host}:${port}/collector-diagnostics.html`,
  );
  console.log('Press Ctrl+C to stop.');
});
