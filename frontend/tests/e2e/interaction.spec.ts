import { test, expect } from '@playwright/test';

// Shared login helper
async function loginAsTestUser(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill('test@example.com');
  await page.getByLabel(/password/i).fill('password123');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL('/', { timeout: 10_000 });
}

// Navigate to first available manga detail page
async function goToFirstMangaDetail(page: import('@playwright/test').Page) {
  await page.goto('/browse');
  await expect(page.getByText(/items/i)).toBeVisible({ timeout: 15_000 });
  const firstMangaLink = page.locator('a[href^="/manga/"]').first();
  await firstMangaLink.click();
  await expect(page).toHaveURL(/\/manga\/.+/, { timeout: 10_000 });
  // Wait for the detail page to fully load
  await expect(page.locator('h1')).toBeVisible({ timeout: 10_000 });
}

test.describe('Interaction Flow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
  });

  test('post a comment on manga detail page', async ({ page }) => {
    await goToFirstMangaDetail(page);

    // Scroll to comments section
    const commentsSection = page.locator('#comments-section');
    await expect(commentsSection).toBeVisible({ timeout: 10_000 });
    await commentsSection.scrollIntoViewIfNeeded();

    // The Tiptap editor renders a contenteditable div — click to focus
    const editor = commentsSection.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });
    await editor.click();
    await editor.fill('E2E test comment — automated');

    // Send button becomes active once char count > 0
    const sendBtn = commentsSection.getByRole('button', { name: /send/i });
    await expect(sendBtn).toBeEnabled({ timeout: 5_000 });
    await sendBtn.click();

    // Success toast from sonner
    await expect(page.getByText(/comment posted/i)).toBeVisible({ timeout: 10_000 });
  });

  test('rate a manga on detail page', async ({ page }) => {
    await goToFirstMangaDetail(page);

    // Star rating buttons have aria-label "Rate N stars"
    const firstStar = page.getByRole('button', { name: /rate 1 stars/i });
    await expect(firstStar).toBeVisible({ timeout: 10_000 });
    await firstStar.click();

    // Success toast
    await expect(page.getByText(/rating saved/i).or(page.getByText(/rating removed/i))).toBeVisible({ timeout: 10_000 });
  });

  test('follow a manga on detail page', async ({ page }) => {
    await goToFirstMangaDetail(page);

    // Follow button text is "Follow (N)" or "Following (N)"
    const followBtn = page.getByRole('button', { name: /^follow/i });
    await expect(followBtn).toBeVisible({ timeout: 10_000 });

    await followBtn.click();

    // Toast confirms action
    await expect(
      page.getByText(/followed successfully/i).or(page.getByText(/unfollowed/i))
    ).toBeVisible({ timeout: 10_000 });
  });
});
