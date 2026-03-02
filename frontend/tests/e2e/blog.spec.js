import { test, expect } from '@playwright/test';

test.describe('블로그 기본 시나리오', () => {
  test('홈페이지 로드', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/.+/);
    await expect(page.locator('body')).toBeVisible();
    // 500 에러 페이지가 아닌지 확인
    await expect(page.locator('body')).not.toContainText('Internal Server Error');
  });

  test('포스트 목록 페이지', async ({ page }) => {
    await page.goto('/posts');
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('body')).not.toContainText('500');
    await expect(page.locator('body')).not.toContainText('Internal Server Error');
  });

  test('프로젝트 목록 페이지', async ({ page }) => {
    await page.goto('/projects');
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('body')).not.toContainText('500');
  });

  test('존재하지 않는 경로 → 404 처리', async ({ page }) => {
    const response = await page.goto('/this-page-does-not-exist');
    expect(response?.status()).toBe(404);
  });

  test('로그인 페이지 접근', async ({ page }) => {
    await page.goto('/admin/login');
    // 로그인 폼 또는 admin 페이지 (autoAuth 미동작 환경에선 로그인 폼이어야 함)
    const url = page.url();
    expect(url).toContain('/admin/login');
  });
});
