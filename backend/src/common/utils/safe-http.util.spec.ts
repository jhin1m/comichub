import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promises as dns } from 'node:dns';
import { safeHttpsFetch } from './safe-http.util.js';

const mockResponse = (status: number, headers: Record<string, string> = {}) =>
  new Response(null, { status, headers });

describe('safeHttpsFetch', () => {
  const lookupSpy = vi.spyOn(dns, 'lookup');
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    lookupSpy.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects non-HTTPS scheme', async () => {
    await expect(safeHttpsFetch('http://example.com/x.jpg')).rejects.toThrow(
      /non-HTTPS/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects private-IP resolution', async () => {
    lookupSpy.mockResolvedValue({ address: '127.0.0.1', family: 4 } as never);
    await expect(safeHttpsFetch('https://evil.example/x.jpg')).rejects.toThrow(
      /private IP/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('succeeds for public host + 200 response', async () => {
    lookupSpy.mockResolvedValue({ address: '8.8.8.8', family: 4 } as never);
    fetchMock.mockResolvedValue(mockResponse(200, { 'content-type': 'image/png' }));
    const res = await safeHttpsFetch('https://cdn.example/x.png');
    expect(res.status).toBe(200);
  });

  it('follows one redirect to public host', async () => {
    lookupSpy.mockResolvedValue({ address: '8.8.8.8', family: 4 } as never);
    fetchMock
      .mockResolvedValueOnce(
        mockResponse(302, { location: 'https://cdn2.example/x.png' }),
      )
      .mockResolvedValueOnce(mockResponse(200));
    const res = await safeHttpsFetch('https://cdn.example/x.png');
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects redirect to private IP', async () => {
    lookupSpy
      .mockResolvedValueOnce({ address: '8.8.8.8', family: 4 } as never)
      .mockResolvedValueOnce({ address: '10.0.0.5', family: 4 } as never);
    fetchMock.mockResolvedValueOnce(
      mockResponse(302, { location: 'https://internal.example/secret' }),
    );
    await expect(safeHttpsFetch('https://cdn.example/x')).rejects.toThrow(
      /private IP/,
    );
  });

  it('rejects redirect to non-HTTPS', async () => {
    lookupSpy.mockResolvedValue({ address: '8.8.8.8', family: 4 } as never);
    fetchMock.mockResolvedValueOnce(
      mockResponse(302, { location: 'http://cdn.example/x' }),
    );
    await expect(safeHttpsFetch('https://cdn.example/x')).rejects.toThrow(
      /non-HTTPS/,
    );
  });

  it('rejects after exceeding max hops', async () => {
    lookupSpy.mockResolvedValue({ address: '8.8.8.8', family: 4 } as never);
    fetchMock.mockResolvedValue(
      mockResponse(302, { location: 'https://next.example/x' }),
    );
    await expect(
      safeHttpsFetch('https://cdn.example/x', { maxHops: 2 }),
    ).rejects.toThrow(/max 2 redirect hops/);
  });

  it('rejects 3xx without Location header', async () => {
    lookupSpy.mockResolvedValue({ address: '8.8.8.8', family: 4 } as never);
    fetchMock.mockResolvedValueOnce(mockResponse(302));
    await expect(safeHttpsFetch('https://cdn.example/x')).rejects.toThrow(
      /no Location/,
    );
  });
});
