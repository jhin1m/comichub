import { promises as dns } from 'node:dns';
import { isPrivateIp } from './private-ip.util.js';

export interface SafeHttpsFetchOptions {
  maxHops?: number;
  timeoutMs?: number;
  userAgent?: string;
  headers?: Record<string, string>;
}

const DEFAULT_OPTS = {
  maxHops: 3,
  timeoutMs: 30_000,
  userAgent: 'ComicHub/1.0',
};

// Narrow DNS lookup to a single public IP. Throws if hostname resolves privately.
async function assertPublicHost(hostname: string): Promise<void> {
  const { address } = await dns.lookup(hostname, { all: false });
  if (isPrivateIp(address)) {
    throw new Error(
      `SSRF blocked: ${hostname} resolves to private IP ${address}`,
    );
  }
}

function assertHttpsUrl(raw: string): URL {
  const url = new URL(raw);
  if (url.protocol !== 'https:') {
    throw new Error(`SSRF blocked: non-HTTPS scheme ${url.protocol}`);
  }
  return url;
}

/**
 * Fetch an HTTPS URL with SSRF defenses:
 * - only HTTPS scheme allowed (re-validated at every redirect hop)
 * - hostname resolved upfront; private/link-local/loopback IPs rejected
 * - redirects handled manually, capped at `maxHops` (default 3)
 *
 * Caller is responsible for enforcing body size + content-type on the returned Response.
 */
export async function safeHttpsFetch(
  initialUrl: string,
  opts: SafeHttpsFetchOptions = {},
): Promise<Response> {
  const { maxHops, timeoutMs, userAgent, headers } = { ...DEFAULT_OPTS, ...opts };
  let currentUrl = initialUrl;

  for (let hop = 0; hop <= maxHops; hop++) {
    const url = assertHttpsUrl(currentUrl);
    await assertPublicHost(url.hostname);

    const res = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'User-Agent': userAgent, ...headers },
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) throw new Error(`SSRF blocked: ${res.status} with no Location`);
      if (hop === maxHops) {
        throw new Error(`SSRF blocked: exceeded max ${maxHops} redirect hops`);
      }
      currentUrl = new URL(location, url).toString();
      continue;
    }

    return res;
  }

  throw new Error(`SSRF blocked: exceeded max ${maxHops} redirect hops`);
}
