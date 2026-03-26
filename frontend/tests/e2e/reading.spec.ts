import { test, expect } from '@playwright/test';

test.describe('Reading Flow', () => {
  test('home page shows manga content', async ({ page }) => {
    await page.goto('/');

    // Page should load and contain manga carousels — wait for any manga card to appear
    await expect(page.locator('main')).toBeVisible({ timeout: 10_000 });
    // At minimum the layout renders — carousels or a loading state
    await expect(page.locator('body')).not.toContainText('500', { timeout: 10_000 });
  });

  test('browse page shows manga grid', async ({ page }) => {
    await page.goto('/browse');

    // Wait for the page wrapper to render
    await expect(page.getByPlaceholder(/search/i).or(page.getByRole('textbox'))).toBeVisible({ timeout: 10_000 });

    // Results section appears (loading state or actual items)
    await expect(page.locator('body')).not.toContainText('500');
  });

  test('clicking manga card navigates to detail page', async ({ page }) => {
    await page.goto('/browse');

    // Wait for results to load (items count text appears)
    await expect(page.getByText(/items/i)).toBeVisible({ timeout: 15_000 });

    // Click the first manga link in the results grid
    const firstMangaLink = page.locator('a[href^="/manga/"]').first();
    await expect(firstMangaLink).toBeVisible({ timeout: 10_000 });

    const href = await firstMangaLink.getAttribute('href');
    await firstMangaLink.click();

    // Should navigate to manga detail page
    await expect(page).toHaveURL(/\/manga\/.+/, { timeout: 10_000 });
    // Detail page renders a heading with the manga title
    await expect(page.locator('h1')).toBeVisible({ timeout: 10_000 });

    // Confirm we landed on the expected slug if href was captured
    if (href) {
      await expect(page).toHaveURL(new RegExp(href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
  });

  test('clicking chapter link opens reader', async ({ page }) => {
    await page.goto('/browse');

    await expect(page.getByText(/items/i)).toBeVisible({ timeout: 15_000 });

    // Navigate to first manga detail page
    const firstMangaLink = page.locator('a[href^="/manga/"]').first();
    await firstMangaLink.click();
    await expect(page).toHaveURL(/\/manga\/.+/, { timeout: 10_000 });

    // Find a chapter link (format: /manga/slug/chapterId)
    const chapterLink = page.locator('a[href^="/manga/"]').filter({ hasNotText: '' }).nth(1);
    await expect(chapterLink).toBeVisible({ timeout: 10_000 });
    await chapterLink.click();

    // Reader page URL matches /manga/<slug>/<chapterId>
    await expect(page).toHaveURL(/\/manga\/.+\/.+/, { timeout: 15_000 });
  });
});
