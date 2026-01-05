import { test, expect } from 'playwright/test';

test('未登录时，点击“获取使用量”会打开 MiniMax 页面', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem('minmax_logged_in');
  });

  await page.goto('/');

  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: /获取使用量/i }).click();
  const popup = await popupPromise;

  await expect(popup).toHaveURL(/platform\.minimaxi\.com\/user-center\/payment\/coding-plan/);
});

test('已登录时，点击“获取使用量”会打开 MiniMax 页面并提示自动同步', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('minmax_logged_in', 'true');
  });

  await page.goto('/');

  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: /获取使用量/i }).click();
  const popup = await popupPromise;

  await expect(popup).toHaveURL(/platform\.minimaxi\.com\/user-center\/payment\/coding-plan/);

  await expect(page.getByText(/MiniMax|自动同步使用量|无需复制/i)).toBeVisible();
});
