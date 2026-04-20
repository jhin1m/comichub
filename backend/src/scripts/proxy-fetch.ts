/**
 * Rotation proxy fetch wrapper. Activated via USE_PROXY=1 + PROXY_URL env vars.
 * PROXY_URL format: http://user:pass@ip:port
 */
import { ProxyAgent, fetch as undiFetch } from 'undici';

let agent: ProxyAgent | null = null;

function getAgent(): ProxyAgent {
  if (!agent) {
    const url = process.env.PROXY_URL;
    if (!url) throw new Error('PROXY_URL env var required when USE_PROXY=1');
    agent = new ProxyAgent(url);
  }
  return agent;
}

export async function proxyFetch(
  url: string | URL | Request,
  init?: RequestInit,
): Promise<Response> {
  const urlStr =
    typeof url === 'string'
      ? url
      : url instanceof URL
        ? url.toString()
        : url.url;
  const headers = init?.headers as Record<string, string> | undefined;
  const signal = init?.signal as AbortSignal | undefined;
  const res = await undiFetch(urlStr, {
    dispatcher: getAgent(),
    headers,
    signal,
  });
  return res as unknown as Response;
}
