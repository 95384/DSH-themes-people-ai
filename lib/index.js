/**
 * people-ai — host half.
 *
 * Serves the fixed wallpaper image on the harness webserver so the browser
 * can load it through a same-origin URL (no CORS, no base64 over RPC).
 *
 * Route: GET /people-ai/wallpaper.jpg (only GET; anything else → 405).
 *
 * The wallpaper is bundled with the project (assets/background.jpg) and
 * resolved relative to this module, so the package works from any install
 * location (local link or published copy). An optional override is honored:
 *   1. $PEOPLE_AI_WALLPAPER_PATH (environment variable, absolute or relative)
 *   2. assets/background.jpg inside the package
 * The bytes are read once on the first request and cached for the lifetime
 * of the plugin fiber; the route and cache are removed when the fiber stops.
 */
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROUTE_PATH = '/people-ai/wallpaper.jpg';

const BUNDLED_WALLPAPER = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'background.jpg');
const CANDIDATES = [
  process.env.PEOPLE_AI_WALLPAPER_PATH,
  BUNDLED_WALLPAPER,
].filter(Boolean);

export default {
  name: 'people-ai',
  inject: ['webServer'],
  apply(ctx) {
    let bytesPromise = null;

    function loadBytes() {
      if (bytesPromise === null) {
        bytesPromise = (async () => {
          let lastError = null;
          for (const candidate of CANDIDATES) {
            try {
              return await readFile(resolve(candidate));
            } catch (err) {
              lastError = err;
            }
          }
          throw lastError ?? new Error('no wallpaper candidates');
        })();
      }
      return bytesPromise;
    }

    ctx.effect(
      () =>
        ctx.webServer.register({
          kind: 'exact',
          path: ROUTE_PATH,
          handler: async (req, res) => {
            if (req.method !== 'GET') {
              res.writeHead(405, { allow: 'GET' });
              res.end();
              return;
            }
            try {
              const data = await loadBytes();
              res.writeHead(200, {
                'content-type': 'image/jpeg',
                'content-length': String(data.byteLength),
                'cache-control': 'public, max-age=3600',
              });
              res.end(data);
            } catch {
              res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
              res.end('wallpaper not found');
            }
          },
        }),
      'people-ai: /people-ai/wallpaper.jpg route',
    );
  },
};
