import { expect, test } from '@playwright/test';

async function dismissCookieBannerIfPresent(page: import('@playwright/test').Page) {
  const acceptCookiesButton = page.getByRole('button', { name: /^accept$/i });
  if (await acceptCookiesButton.isVisible()) {
    await acceptCookiesButton.click();
  }
}

test.describe('JetBlue homepage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await dismissCookieBannerIfPresent(page);
  });

  test('loads with JetBlue branding and canonical URL', async ({ page }) => {
    await expect(page).toHaveTitle(/jetblue/i);
    await expect(page).toHaveURL(/jetblue\.com\/?$/i);

    await expect(page.getByRole('banner')).toBeVisible();
    await expect(page.getByRole('link', { name: /^jetblue$/i }).first()).toBeVisible();
  });

  test('has global navigation links for main customer flows', async ({ page }) => {
    await expect(page.getByRole('button', { name: /^book$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^my trips$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^travel info$/i })).toBeVisible();
  });

  test('exposes a flights booking entrypoint', async ({ page }) => {
    await expect(page.getByRole('link', { name: /^flights$/i }).first()).toBeVisible();
    await expect(page.locator('a[href*="/flights"]').first()).toBeVisible();
  });
});
