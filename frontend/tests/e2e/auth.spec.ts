import { test, expect } from '@playwright/test';

// Credentials come from `.env.test.local` (gitignored) — see `.env.test.example`.
// Loaded by `playwright.config.ts` via dotenv before tests run.
const E2E_EMAIL = process.env.E2E_TEST_EMAIL;
const E2E_PASSWORD = process.env.E2E_TEST_PASSWORD;

test.describe('Auth Flow', () => {
  test('login page renders form elements', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('shows validation errors on empty submit', async ({ page }) => {
    await page.goto('/login');

    await page.getByRole('button', { name: /sign in/i }).click();

    // Zod validation fires client-side — errors appear without network round-trip
    await expect(page.getByText(/invalid email/i).or(page.getByText(/min 6 characters/i))).toBeVisible({ timeout: 5_000 });
  });

  test('login with valid credentials redirects to home', async ({ page }) => {
    test.skip(!E2E_EMAIL || !E2E_PASSWORD, 'E2E_TEST_EMAIL / E2E_TEST_PASSWORD not set (see .env.test.example)');
    await page.goto('/login');

    await page.getByLabel(/email/i).fill(E2E_EMAIL!);
    await page.getByLabel(/password/i).fill(E2E_PASSWORD!);
    await page.getByRole('button', { name: /sign in/i }).click();

    // Successful login navigates away from /login
    await expect(page).toHaveURL('/', { timeout: 10_000 });
  });

  test('login with wrong credentials shows error message', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel(/email/i).fill('wrong@example.com');
    await page.getByLabel(/password/i).fill('wrongpassword');
    await page.getByRole('button', { name: /sign in/i }).click();

    // API returns 401 → form sets root error
    await expect(page.getByText(/invalid credentials/i).or(page.getByText(/unauthorized/i))).toBeVisible({ timeout: 10_000 });
  });
});
