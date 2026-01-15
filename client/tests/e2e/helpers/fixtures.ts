import { readFile } from 'node:fs/promises';
import http from 'node:http';
import { extname, join, normalize } from 'node:path';

let server:
  | {
    baseUrl: string;
    close: () => Promise<void>;
  }
  | undefined;

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
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.svg':
      return 'image/svg+xml; charset=utf-8';
    default:
      return 'text/plain; charset=utf-8';
  }
};

async function ensureFixtureServer() {
  if (server) return server;

  // helpers/fixtures.ts to ../fixtures/
  const fixturesDir = new URL(`../fixtures/`, import.meta.url);
  const fixturesRoot = normalize(join(fixturesDir.pathname));

  const s = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      const pathname = url.pathname === '/' ? '/basic-article.html' : url.pathname;

      // Prevent path traversal
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
    } catch (e: any) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end(`Not found: ${(e && e.message) || e}`);
    }
  });

  await new Promise<void>(resolve => s.listen(0, '127.0.0.1', resolve));
  const addr = s.address();
  if (!addr || typeof addr === 'string') throw new Error('Failed to start fixture server');

  const baseUrl = `http://127.0.0.1:${addr.port}`;

  server = {
    baseUrl,
    close: () => new Promise<void>((resolve, reject) => s.close(err => (err ? reject(err) : resolve()))),
  };

  process.once('exit', () => {
    // cleanup
    void server?.close().catch(() => { });
  });

  return server;
}

export const openFixture = async (name: string) => {
  const { baseUrl } = await ensureFixtureServer();
  await browser.url(`${baseUrl}/${name}.html`);
};
