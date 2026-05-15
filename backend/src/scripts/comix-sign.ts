/**
 * Comix.to API request signing.
 *
 * Comix migrated frontend Next.js/Turbopack → Vite/rolldown on 2026-05-07,
 * then re-obfuscated the signing module on 2026-05-08 (likely after detecting
 * scraper traffic). Algorithm + cipher keys remain stable across both bundles
 * — only the wrapper changed (28KB plain → 252KB obfuscated VM with `vmO_*`
 * prefix names as red herring).
 *
 * Strategy: instead of digging into the obfuscation to extract a hash
 * function (was `ki[2]` in plain bundle, hidden inside vmO interpreter in
 * obfuscated bundle), use the EXPORTED interceptor installer (`n` per main
 * bundle's `import{n,r,t} from "./secure-*.js"` alias) which the bundle
 * always wires on its axios instance. We register a fake axios, capture the
 * handler, then invoke it with mock GET configs — the handler adds `_=<sig>`
 * to params for whitelisted paths:
 *   /manga/{hid}/chapters
 *   /manga/{hid}/chapter-indexes
 *   /chapters/{id}
 * This survives bundler / variable-renaming / obfuscation changes as long as
 * the ESM export contract holds.
 *
 * Anti-tamper bypass:
 *   1. `document.querySelector.toString()` probed against native-code regex —
 *      spoof toString.
 *   2. `navigator.appCodeName` required by the obfuscator's runtime
 *      decryption key derivation (throws "VM decryption key not available"
 *      when missing).
 *
 * Cache: signer is loaded once per process (default 1h TTL); on 403 from a
 * signed call `resetSigner()` is invoked to force re-fetch (bundle hash
 * rotation handling).
 */
import vm from 'node:vm';

// ─── Bundle discovery ────────────────────────────────────────────

const HOMEPAGE = 'https://comix.to/home';
const UA = 'Mozilla/5.0';

// Vite layout: <script type="module" src=".../assets/build/<hash>/dist/main-<id>.js">
const MAIN_BUNDLE_RE =
  /<script[^>]+src="(https:\/\/comix\.to\/assets\/[^"]+main-[^"]+\.js)"/;
// Main bundle imports signer from sibling: import{...} from "./secure-<id>.js"
const SECURE_IMPORT_RE = /from\s*["'](\.\/secure-[^"']+\.js)["']/;
// Anti-tamper probe in secure module — must match exactly or cipher keys
// get scrambled. Spoof `document.querySelector.toString()` against this.
const NATIVE_QS_RE =
  /function\s+querySelector\(\)\s+\{\s+\[native\s+code\]\s+\}/;

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`fetch ${url} → ${res.status}`);
  return res.text();
}

/** Locate `main-*.js` and the sibling `secure-*.js` from the live homepage. */
async function discoverSecureBundleUrl(): Promise<string> {
  // Tiny in-function retry — homepage is a single-point-of-failure for the
  // whole import run, so transient 502/CF-blip shouldn't kill the cron tick.
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const html = await fetchText(HOMEPAGE);
      const mainMatch = html.match(MAIN_BUNDLE_RE);
      if (!mainMatch)
        throw new Error('Could not locate main bundle URL in homepage HTML');
      const mainCode = await fetchText(mainMatch[1]);
      const secMatch = mainCode.match(SECURE_IMPORT_RE);
      if (!secMatch)
        throw new Error('Could not locate secure module import in main bundle');
      return new URL(secMatch[1], mainMatch[1]).toString();
    } catch (err: any) {
      lastErr = err;
      if (attempt < 2)
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  throw lastErr!;
}

// ─── Sandbox for vm-eval of secure module ───────────────────────

/**
 * Build a sandbox that satisfies the secure module's anti-tamper probe.
 * Critical: `document.querySelector.toString()` MUST match the native-code
 * regex `/function\s+querySelector\(\)\s+\{\s+\[native\s+code\]\s+\}/`,
 * otherwise the cipher keys get scrambled and signatures become invalid.
 */
function makeBrowserSandbox(): vm.Context {
  const noop = () => {};
  const fakeQuerySelector = function querySelector() {
    return null;
  };
  // Spoof toString() to satisfy the secure module's NATIVE_QS_RE probe.
  // String must literally match — single space after `function`, single
  // space inside braces. Don't reformat without verifying against the regex.
  fakeQuerySelector.toString = () =>
    'function querySelector() { [native code] }';

  const fakeDoc = {
    querySelector: fakeQuerySelector,
    querySelectorAll: () => [],
    addEventListener: noop,
    removeEventListener: noop,
    createElement: () => ({
      setAttribute: noop,
      addEventListener: noop,
      removeEventListener: noop,
      innerHTML: '',
      innerText: '',
      __defineGetter__: noop,
    }),
    body: {
      appendChild: noop,
      removeChild: noop,
      innerHTML: '',
      innerText: '',
    },
    documentElement: { innerHTML: '', innerText: '' },
    currentScript: null,
    cookie: '',
    hidden: false,
    visibilityState: 'visible',
  };

  const fakeStorage = () => ({
    getItem: () => null,
    setItem: noop,
    removeItem: noop,
    clear: noop,
  });

  const fakeWindow = {
    location: {
      host: 'comix.to',
      href: 'https://comix.to/',
      search: '',
      hash: '',
      replace: noop,
      reload: noop,
    },
    setInterval: () => 0,
    clearInterval: noop,
    setTimeout: () => 0,
    clearTimeout: noop,
    addEventListener: noop,
    removeEventListener: noop,
    open: () => null,
    close: noop,
    history: { back: noop },
    devicePixelRatio: 1,
    innerWidth: 1280,
    innerHeight: 800,
    outerWidth: 1280,
    outerHeight: 800,
    screen: { deviceXDPI: 96, logicalXDPI: 96 },
    console,
  };

  const sandbox: any = {
    document: fakeDoc,
    window: fakeWindow,
    location: fakeWindow.location,
    navigator: {
      // Comix's obfuscator derives a runtime decryption key from
      // navigator.appCodeName — missing/empty value throws
      // "VM decryption key not available". Add common-browser fields
      // defensively in case future obfuscator iterations probe more.
      userAgent: UA,
      platform: 'MacIntel',
      maxTouchPoints: 0,
      appCodeName: 'Mozilla',
      appName: 'Netscape',
      appVersion: '5.0',
      language: 'en-US',
      languages: ['en-US', 'en'],
      onLine: true,
      vendor: '',
      product: 'Gecko',
      productSub: '20030107',
    },
    localStorage: fakeStorage(),
    sessionStorage: fakeStorage(),
    btoa: (s: string) => Buffer.from(s, 'binary').toString('base64'),
    atob: (s: string) => Buffer.from(s, 'base64').toString('binary'),
    setInterval: fakeWindow.setInterval,
    clearInterval: noop,
    setTimeout: fakeWindow.setTimeout,
    clearTimeout: noop,
    console,
  };
  // Self-reference — secure code uses globalThis/self/top/parent interchangeably.
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  sandbox.top = sandbox;
  sandbox.parent = sandbox;

  return vm.createContext(sandbox);
}

// ─── Signer load + cache ────────────────────────────────────────

type SignerFn = (path: string) => string | null;

interface CachedSigner {
  sign: SignerFn;
  loadedAt: number;
}

let cached: CachedSigner | null = null;
const SIGNER_TTL_MS = 60 * 60 * 1000; // 1 hour

async function loadSigner(): Promise<SignerFn> {
  if (cached && Date.now() - cached.loadedAt < SIGNER_TTL_MS) {
    return cached.sign;
  }

  const secureUrl = await discoverSecureBundleUrl();
  const secureCode = await fetchText(secureUrl);

  // The main bundle imports the installer via the stable export alias `n`
  // (`import{n,...} from "./secure-*.js"`). The source-side variable name
  // is volatile across bundles: `g` on 2026-05-08, `v` on 2026-05-09.
  // Resolve it dynamically by parsing `<name> as n` from the export clause —
  // alias `n` is the durable contract, source name is not.
  const exportMatch = secureCode.match(/export\s*\{([^}]+)\}/);
  if (!exportMatch)
    throw new Error('Comix secure module has no ESM export clause');
  const installerNameMatch = exportMatch[1].match(/(\w+)\s+as\s+n\b/);
  if (!installerNameMatch)
    throw new Error(
      'Comix secure module export clause missing `as n` (installer alias)',
    );
  const installerName = installerNameMatch[1];

  // Strip ESM `export {...}` so the code runs as plain script in vm, then
  // promote the resolved installer to globalThis for capture below.
  const transformed =
    secureCode.replace(/export\s*\{[^}]+\}\s*;?\s*$/, '') +
    `\n; globalThis.__comixInstall = typeof ${installerName} === 'function' ? ${installerName} : null;`;

  const ctx = makeBrowserSandbox();
  try {
    // Bigger timeout — obfuscated bundle takes longer to evaluate (~2x).
    vm.runInContext(transformed, ctx, { timeout: 15_000 });
  } catch {
    // Late IIFEs (devtool detector, ad injector) may throw on missing
    // browser APIs — irrelevant once `g` is captured.
  }

  const install = (ctx as any).__comixInstall as
    | ((axios: any) => void)
    | undefined;
  if (typeof install !== 'function')
    throw new Error(
      'Comix interceptor installer not captured from secure module',
    );

  // Mock just enough of axios for the interceptor to register itself, then
  // capture the handler so we can invoke it directly to sign URLs.
  let handler: ((cfg: any) => any) | null = null;
  install({
    interceptors: {
      request: {
        use(h: (cfg: any) => any) {
          handler = h;
          return 0;
        },
      },
      response: { use: () => 0 },
    },
  });
  if (typeof handler !== 'function')
    throw new Error('Comix request-interceptor handler not registered');
  const finalHandler: (cfg: any) => any = handler;

  // Wrap as a path-only signer: invoke handler with mock GET config and
  // pull the `_` query param the bundle adds for whitelisted paths.
  const sign: SignerFn = (path) => {
    const cfg = { method: 'get', url: `/api/v1${path}`, params: {} };
    const out = finalHandler(cfg);
    return out?.params?._ ?? null;
  };

  cached = { sign, loadedAt: Date.now() };
  return sign;
}

/** Force re-discovery of bundle on next call (use after a 403 from signed endpoint). */
export function resetSigner(): void {
  cached = null;
}

// ─── Public API ─────────────────────────────────────────────────

/**
 * Sign a Comix.to API path. The signature depends only on the path
 * (no query, no body). Returns the path with `_=<sig>` appended.
 *
 * Whitelist (per bundle interceptor `Pi`):
 *   /manga/{hid}/chapters
 *   /manga/{hid}/chapter-indexes
 *   /chapters/{id}
 * Other paths return without `_` param — server will accept them as-is.
 */
export async function signUrl(
  path: string,
  query: Record<string, string | number> = {},
): Promise<string> {
  const sign = await loadSigner();
  const sig = sign(path);
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) params.set(k, String(v));
  if (sig) params.set('_', sig);
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

let signedFetchLastReq = 0;

/** Sign + fetch a Comix.to API path. Returns parsed JSON. */
export async function signedFetch<T>(
  path: string,
  query: Record<string, string | number> = {},
  opts?: {
    throttleMs?: number;
    jitter?: [number, number];
    fetchTimeoutMs?: number;
  },
): Promise<T> {
  const signedPath = await signUrl(path, query);
  const url = `https://comix.to/api/v1${signedPath}`;

  // Throttle (jitter wins over fixed throttleMs when provided)
  let waitMs: number;
  if (opts?.jitter) {
    const [min, max] = opts.jitter;
    waitMs = Math.floor(Math.random() * (max - min) + min);
  } else {
    waitMs = opts?.throttleMs ?? 250;
  }
  const now = Date.now();
  if (signedFetchLastReq && now - signedFetchLastReq < waitMs) {
    await new Promise((r) =>
      setTimeout(r, waitMs - (now - signedFetchLastReq)),
    );
  }
  signedFetchLastReq = Date.now();

  const headers = { Accept: 'application/json', 'User-Agent': UA };
  let fetchFn: typeof fetch;
  if (process.env.USE_PROXY === '1')
    fetchFn = (await import('./proxy-fetch.js')).proxyFetch;
  else fetchFn = fetch;
  const signal = AbortSignal.timeout(opts?.fetchTimeoutMs ?? 30_000);
  const res = await fetchFn(url, { headers, signal });

  // 403 may indicate stale cached signer (bundle hash rotated). Reset and
  // surface the error so withRetry-wrapped callers can re-attempt with
  // freshly discovered bundle.
  if (res.status === 403) {
    resetSigner();
    throw new Error(`API 403: ${path} (signer reset, retry)`);
  }
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}
