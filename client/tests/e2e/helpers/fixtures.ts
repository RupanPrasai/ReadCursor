import { readFile } from 'node:fs/promises';
import http from 'node:http';
import { join, normalize, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

let baseUrl: string | null = null;

const fixturesRoot = normalize(fileURLToPath(new URL('../fixtures/', import.meta.url)));

const contentTypeFor = (path: string) => {
  switch (extname(path)) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.js':
      return 'text/javascript; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    default:
      return 'text/plain; charset=utf-8';
  }
};

const ensureFixtureServer = async () => {
  if (baseUrl) return baseUrl;

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      const pathname = url.pathname === '/' ? '/basic-article.html' : url.pathname;

      const abs = normalize(join(fixturesRoot, pathname));
      if (!abs.startsWith(fixturesRoot)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }

      const body = await readFile(abs);
      res.writeHead(200, {
        'content-type': contentTypeFor(abs),
        'cache-control': 'no-store',
      });
      res.end(body);
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Not found');
    }
  });

  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('Failed to start fixture server');

  baseUrl = `http://127.0.0.1:${addr.port}`;

  process.once('exit', () => {
    try {
      server.close();
    } catch { }
  });

  return baseUrl;
};

export const openFixture = async (name: string) => {
  const url = await ensureFixtureServer();
  await browser.url(`${url}/${name}.html`);
};
