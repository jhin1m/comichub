import { test, expect } from '@playwright/test';

async function loginAsTestUser(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill('test@example.com');
  await page.getByLabel(/password/i).fill('password123');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL('/', { timeout: 10_000 });
}

test.describe('Profile Flow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
  });

  test('navigate to profile page', async ({ page }) => {
    await page.goto('/profile');

    // Profile page redirects unauthenticated users to /login.
    // Since we are logged in, it must stay on /profile.
    await expect(page).toHaveURL('/profile', { timeout: 10_000 });
  });

  test('profile page shows content with history and follows tabs', async ({ page }) => {
    await page.goto('/profile');

    // Wait for loading skeleton to clear and real content to appear
    // ProfileHeader renders the user's email/username
    await expect(page.locator('[data-radix-tabs-list]').or(page.getByRole('tablist'))).toBeVisible({ timeout: 15_000 });

    // Both tabs must be present (from Radix TabsTrigger, value="history" and value="following")
    await expect(page.getByRole('tab', { name: /history/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /following/i })).toBeVisible();
  });

  test('switch between history and following tabs', async ({ page }) => {
    await page.goto('/profile');

    // Wait for tabs to render
    const historyTab = page.getByRole('tab', { name: /history/i });
    const followingTab = page.getByRole('tab', { name: /following/i });
    await expect(historyTab).toBeVisible({ timeout: 15_000 });

    // Default tab is "history" — its panel should be visible
    await expect(historyTab).toHaveAttribute('data-state', 'active');

    // Switch to Following tab
    await followingTab.click();
    await expect(followingTab).toHaveAttribute('data-state', 'active', { timeout: 5_000 });

    // History tab panel is now inactive
    await expect(historyTab).toHaveAttribute('data-state', 'inactive');

    // Switch back to History
    await historyTab.click();
    await expect(historyTab).toHaveAttribute('data-state', 'active', { timeout: 5_000 });
  });
});
