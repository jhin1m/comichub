import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/tests/mocks/handlers';
import { preferencesApi } from './preferences.api';

const BASE_URL = 'http://localhost:8080/api/v1';
const envelope = (data: unknown) => ({ success: true, data, message: null });

const defaultPrefs = {
  hideNsfw: true,
  excludedTypes: [],
  excludedDemographics: [],
  excludedGenreSlugs: [],
  highlightedGenreSlugs: [],
};

describe('preferencesApi', () => {
  it('get returns user preferences', async () => {
    server.use(
      http.get(`${BASE_URL}/users/preferences`, () =>
        HttpResponse.json(envelope(defaultPrefs)),
      ),
    );
    const result = await preferencesApi.get();
    expect(result).toHaveProperty('hideNsfw', true);
    expect(result).toHaveProperty('excludedTypes');
  });

  it('update sends only allowed keys and returns updated preferences', async () => {
    let body: unknown;
    server.use(
      http.put(`${BASE_URL}/users/preferences`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(envelope({ ...defaultPrefs, hideNsfw: false }));
      }),
    );
    const result = await preferencesApi.update({ hideNsfw: false });
    expect(result).toHaveProperty('hideNsfw', false);
    // pickAllowed should only include known keys
    expect(body).toHaveProperty('hideNsfw', false);
    expect(body).not.toHaveProperty('unknownKey');
  });
});
