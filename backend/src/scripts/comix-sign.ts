/**
 * Comix.to API request signing — the chapters endpoint requires a signed `_` param.
 * Downloads Comix.to frontend JS, evaluates its signing module, and exposes signUrl/signedFetch.
 * Signature depends only on URL path (not query params) and is deterministic per JS version.
 */

// ─── Turbopack module loader ────────────────────────────────────
interface TurbopackModule {
  exports: Record<string, any>;
}

function createModuleLoader() {
  const modules: Record<number, Function> = {};
  const cache: Record<number, TurbopackModule> = {
    // Stub for process.env (module 85696)
    85696: { exports: { default: { env: {} }, env: {} } },
  };

  // Turbopack push handler — registers module factories
  const push = (args: any[]) => {
    const items = args.slice(1);
    for (let j = 0; j < items.length; j += 2) {
      if (typeof items[j] === 'number' && typeof items[j + 1] === 'function') {
        modules[items[j]] = items[j + 1];
      }
    }
  };

  function requireModule(id: number) {
    if (cache[id]) return cache[id].exports;
    const factory = modules[id];
    if (!factory) return { default: { env: {} }, env: {} };

    const mod: TurbopackModule = { exports: {} };
    cache[id] = mod;

    const e = {
      i: (depId: number) => requireModule(depId),
      r: (depId: number) => requireModule(depId),
      g: globalThis,
      s(entries: any[]) {
        if (!Array.isArray(entries)) return;
        for (let k = 0; k < entries.length; k++) {
          if (typeof entries[k] === 'string') {
            const name = entries[k];
            const value = entries[k + 2];
            mod.exports[name] = typeof value === 'function' ? value() : value;
            k += 2;
          }
        }
      },
    };

    try {
      factory(e);
    } catch {
      /* signing module self-initialises; swallow factory errors */
    }
    return mod.exports;
  }

  return { push, requireModule };
}

// ─── Download & evaluate Comix.to signing module ────────────────

/** Chunk URL cache — avoids re-downloading on every call */
let cachedApiClient: any = null;

async function loadApiClient(): Promise<any> {
  if (cachedApiClient) return cachedApiClient;

  // 1. Fetch homepage to discover current JS chunk URLs
  const homeRes = await fetch('https://comix.to/home', {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  const html = await homeRes.text();
  const chunkUrls: string[] = [];
  const chunkRe = /\/_next\/static\/chunks\/([a-f0-9]+\.js)/g;
  let chunkMatch: RegExpExecArray | null;
  while ((chunkMatch = chunkRe.exec(html))) chunkUrls.push(chunkMatch[1]);

  // 2. Find the chunk containing the apiClient (module 9165)
  let apiChunkCode: string | null = null;
  for (const chunkFile of chunkUrls) {
    const res = await fetch(
      `https://comix.to/_next/static/chunks/${chunkFile}`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      },
    );
    const code = await res.text();
    if (code.includes('apiClient') && code.includes('9165,e=>')) {
      apiChunkCode = code;
      break;
    }
  }

  if (!apiChunkCode)
    throw new Error('Could not find Comix.to API chunk with signing module');

  // 3. Set up minimal browser globals for the signing code
  const savedDoc = (globalThis as any).document;
  const savedLS = (globalThis as any).localStorage;
  const savedSS = (globalThis as any).sessionStorage;

  (globalThis as any).document = { currentScript: null };
  (globalThis as any).localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
  (globalThis as any).sessionStorage = (globalThis as any).localStorage;

  // 4. Evaluate the chunk with our Turbopack loader
  const loader = createModuleLoader();
  const savedTurbopack = (globalThis as any).TURBOPACK;
  (globalThis as any).TURBOPACK = { push: loader.push };

  try {
    new Function(apiChunkCode)();
  } catch {
    /* chunk may throw on non-module code; signing module is self-contained */
  }

  // 5. Extract the apiClient
  const mod = loader.requireModule(9165);
  cachedApiClient = mod.apiClient;

  // 6. Restore globals
  (globalThis as any).TURBOPACK = savedTurbopack;
  (globalThis as any).document = savedDoc;
  (globalThis as any).localStorage = savedLS;
  (globalThis as any).sessionStorage = savedSS;

  if (!cachedApiClient) throw new Error('Failed to extract Comix.to apiClient');
  return cachedApiClient;
}

// ─── Public API ─────────────────────────────────────────────────

/**
 * Sign a Comix.to API URL (adds `time` and `_` query params).
 * WARNING: not concurrency-safe — monkey-patches `globalThis.fetch` to capture the signed URL.
 * Callers must serialize invocations (current import loops are strictly sequential).
 */
export async function signUrl(
  path: string,
  query: Record<string, string | number> = {},
): Promise<string> {
  const apiClient = await loadApiClient();

  // Intercept fetch to capture the signed URL
  const origFetch = globalThis.fetch;
  let signedUrl = '';

  globalThis.fetch = (async (url: any) => {
    const urlStr = url.toString();
    if (urlStr.includes('csrf-cookie')) {
      return {
        ok: true,
        status: 204,
        headers: {
          get: (n: string) =>
            n === 'XSRF-TOKEN'
              ? 'tok'
              : n === 'set-cookie'
                ? 'XSRF-TOKEN=tok'
                : null,
        },
      };
    }
    signedUrl = urlStr;
    throw { __signCapture: true };
  }) as any;

  try {
    await apiClient.get(path, { query });
  } catch (e: any) {
    if (!e?.__signCapture) throw e;
  } finally {
    globalThis.fetch = origFetch;
  }

  if (!signedUrl) throw new Error(`Failed to sign URL: ${path}`);
  return signedUrl;
}

/** Sign + fetch a Comix.to API URL. Returns parsed JSON. */
export async function signedFetch<T>(
  path: string,
  query: Record<string, string | number> = {},
  opts?: {
    throttleMs?: number;
    jitter?: [number, number];
    fetchTimeoutMs?: number;
  },
): Promise<T> {
  const url = await signUrl(path, query);
  let ms: number;
  if (opts?.jitter) {
    const [min, max] = opts.jitter;
    ms = Math.floor(Math.random() * (max - min) + min);
  } else {
    ms = opts?.throttleMs ?? 250;
  }

  // Throttle
  const now = Date.now();
  if (signedFetchLastReq && now - signedFetchLastReq < ms) {
    await new Promise((r) => setTimeout(r, ms - (now - signedFetchLastReq)));
  }
  signedFetchLastReq = Date.now();

  const headers = { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' };
  let fetchFn: typeof fetch;
  if (process.env.USE_PROXY === '1')
    fetchFn = (await import('./proxy-fetch.js')).proxyFetch;
  else fetchFn = fetch;
  const signal = AbortSignal.timeout(opts?.fetchTimeoutMs ?? 30_000);
  const res = await fetchFn(url, { headers, signal });
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

let signedFetchLastReq = 0;
