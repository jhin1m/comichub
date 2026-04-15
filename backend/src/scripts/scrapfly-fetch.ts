/**
 * Scrapfly opt-in fetch wrapper. Activated via USE_SCRAPFLY=1 + SCRAPFLY_KEY env vars.
 * Routes requests through Scrapfly's anti-scraping-protection (ASP) proxy when IP is blocked.
 * Returns a native Response so callers can treat it identically to a direct fetch.
 */
import { ScrapflyClient, ScrapeConfig } from 'scrapfly-sdk';

let client: ScrapflyClient | null = null;

function getClient(): ScrapflyClient {
  if (!client) {
    const key = process.env.SCRAPFLY_KEY;
    if (!key) throw new Error('SCRAPFLY_KEY env var required when USE_SCRAPFLY=1');
    client = new ScrapflyClient({ key });
  }
  return client;
}

// ScrapeResult shape (narrowing `Response | ScrapeResult` union from client.scrape)
interface ScrapfulResult {
  result: {
    content: string;
    status_code: number;
    response_headers?: Record<string, string>;
  };
}

export async function scrapflyFetch(
  url: string | URL | Request,
  init?: RequestInit,
): Promise<Response> {
  const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
  const headers = init?.headers as Record<string, string> | undefined;

  const raw = (await getClient().scrape(
    new ScrapeConfig({
      url: urlStr,
      asp: true,
      render_js: false,
      country: 'US',
      cache: true,
      headers,
    }),
  )) as unknown as ScrapfulResult;

  const respHeaders = raw.result.response_headers ?? {};
  return new Response(raw.result.content, {
    status: raw.result.status_code,
    headers: { 'content-type': respHeaders['content-type'] ?? 'application/json' },
  });
}
