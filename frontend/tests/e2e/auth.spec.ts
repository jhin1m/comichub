import { test, expect } from '@playwright/test';

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
    await page.goto('/login');

    await page.getByLabel(/email/i).fill('admin@admin.com');
    await page.getByLabel(/password/i).fill('Fakepro999@@');
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
