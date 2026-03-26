import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

const BASE_URL = 'http://localhost:8080/api/v1';

const envelope = (data: unknown) => ({ success: true, data, message: null });

export const handlers = [
  // Auth
  http.post(`${BASE_URL}/auth/login`, () =>
    HttpResponse.json(envelope({
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
      expiresIn: 3600,
    })),
  ),

  http.post(`${BASE_URL}/auth/register`, () =>
    HttpResponse.json(envelope({
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
      expiresIn: 3600,
    })),
  ),

  http.get(`${BASE_URL}/auth/me`, () =>
    HttpResponse.json(envelope({
      id: 1,
      uuid: 'test-uuid',
      email: 'test@example.com',
      name: 'Test User',
      avatar: null,
      role: 'user',
    })),
  ),

  http.post(`${BASE_URL}/auth/logout`, () =>
    HttpResponse.json(envelope(null)),
  ),

  http.post(`${BASE_URL}/auth/refresh`, () =>
    HttpResponse.json(envelope({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      expiresIn: 3600,
    })),
  ),

  // Manga list
  http.get(`${BASE_URL}/manga`, () =>
    HttpResponse.json(envelope({
      data: [
        { id: 1, title: 'Test Manga', slug: 'test-manga', cover: null, status: 'ongoing', latestChapter: null },
      ],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    })),
  ),

  // Chapter list
  http.get(`${BASE_URL}/manga/:slug/chapters`, () =>
    HttpResponse.json(envelope({
      data: [
        { id: 1, number: 1, title: 'Chapter 1', createdAt: '2026-01-01T00:00:00Z' },
      ],
      total: 1,
      page: 1,
      limit: 50,
      totalPages: 1,
    })),
  ),

  // Notifications
  http.get(`${BASE_URL}/notifications`, () =>
    HttpResponse.json(envelope({
      data: [],
      total: 0,
      unreadCount: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
    })),
  ),

  // Preferences
  http.get(`${BASE_URL}/users/preferences`, () =>
    HttpResponse.json(envelope({
      hideNsfw: true,
      excludedTypes: [],
      excludedDemographics: [],
      excludedGenreSlugs: [],
      highlightedGenreSlugs: [],
    })),
  ),

  http.put(`${BASE_URL}/users/preferences`, () =>
    HttpResponse.json(envelope({
      hideNsfw: true,
      excludedTypes: [],
      excludedDemographics: [],
      excludedGenreSlugs: [],
      highlightedGenreSlugs: [],
    })),
  ),
];

export const server = setupServer(...handlers);
