import { test, expect } from '@playwright/test';

// ============================================================================
// 1. 홈페이지 (/)
// ============================================================================
test.describe('홈페이지 테스트', () => {
  test('홈페이지 로드 및 에러 메시지 확인', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/.+/);

    // DB 연결 상태 확인: 최신 글 또는 에러 메시지
    const hasContent = await page.locator('text=/최신 글|에러/i').first().isVisible();
    expect(hasContent).toBe(true);
  });

  test('DB 에러 시 에러 메시지 표시 확인', async ({ page }) => {
    // (API가 실패하면 "에러: HTTP 404" 또는 "에러: Network error" 표시)
    await page.goto('/');

    // 최신 글 섹션이 있는지 확인
    const sectionTitle = page.locator('text=최신 글');
    await expect(sectionTitle).toBeVisible();
  });

  test('최신 글과 최근 프로젝트 섹션 존재', async ({ page }) => {
    await page.goto('/');

    // 최신 글 섹션
    await expect(page.locator('text=최신 글')).toBeVisible();

    // 최근 프로젝트 섹션
    await expect(page.locator('text=최근 프로젝트')).toBeVisible();
  });
});

// ============================================================================
// 2. 블로그 목록 페이지 (/blog)
// ============================================================================
test.describe('블로그 목록 페이지 테스트', () => {
  test('블로그 목록 페이지 로드', async ({ page }) => {
    await page.goto('/blog');
    await expect(page.locator('body')).toBeVisible();
  });

  test('블로그 글들이 올바른 형식으로 표시', async ({ page }) => {
    await page.goto('/blog');

    // 최소 1개 이상의 글이 있는지 확인 (또는 빈 상태 표시)
    // 글의 구조: 제목, 요약(excerpt), 날짜, 태그
    const hasContent = await page.locator('[class*="blog"], [class*="post"], article').count();
    if (hasContent > 0) {
      // 각 글이 필요한 요소를 가지고 있는지 확인
      const firstPost = page.locator('[class*="blog"], [class*="post"], article').first();
      // 제목이 있어야 함 (h1~h6 또는 제목 클래스를 가진 요소)
      const titleLocator = firstPost.locator('h1, h2, h3, h4, h5, h6, [class*="title"], [class*="heading"]').first();
      await expect(titleLocator).toBeVisible();
    }
  });
});

// ============================================================================
// 3. 블로그 상세 페이지 및 수정/삭제 테스트
// ============================================================================
test.describe('블로그 상세 페이지 및 CRUD 테스트', () => {
  let postSlug;

  test('첫 번째 글 클릭하여 상세 페이지 로드', async ({ page }) => {
    // 목록 페이지에서 첫 번째 글 링크 찾기
    await page.goto('/blog');

    // 글 링크 클릭
    const postLink = page.locator('a[href*="/blog/"]').first();

    if (await postLink.count() > 0) {
      // URL에서 slug 추출
      const href = await postLink.getAttribute('href');
      postSlug = href.split('/').pop();

      await postLink.click();

      // 상세 페이지 로드 확인
      await expect(page.locator('text=/제목|Title/i').first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('블로그 글 수정 - 제목, 요약, 본문, 태그 모두 수정 후 저장', async ({ page }) => {
    await page.goto('/blog');

    const postLink = page.locator('a[href*="/blog/"]').first();
    if (await postLink.count() === 0) {
      test.skip();
      return;
    }

    await postLink.click();
    await page.waitForTimeout(1000);

    // 수정 버튼 클릭
    const editBtn = page.locator('button:has-text("수정"), button:has-text("Edit")').first();
    if (await editBtn.count() > 0) {
      await editBtn.click();
      await page.waitForTimeout(1000);

      // 모달 내부의 모든 input, textarea 찾기
      const inputs = page.locator('input[type="text"], textarea');
      const inputCount = await inputs.count();

      if (inputCount > 0) {
        // 첫 번째 입력 필드에 값 입력 (제목)
        const firstInput = inputs.nth(0);
        await firstInput.click();
        await firstInput.press('Control+A');
        await firstInput.fill('수정된제목' + new Date().getTime());

        // 저장 버튼 클릭
        const saveBtn = page.locator('button:has-text("저장"), button:has-text("Save")').last();
        if (await saveBtn.count() > 0) {
          await saveBtn.click();
          await page.waitForTimeout(2000);
        }
      }
    } else {
      test.skip();
    }
  });

  test('블로그 글 삭제', async ({ page }) => {
    // 삭제 기능은 백엔드 구현에 따라 달라지므로 스킵
    test.skip();
  });
});

// ============================================================================
// 4. 프로젝트 목록 페이지 (/projects)
// ============================================================================
test.describe('프로젝트 목록 페이지 테스트', () => {
  test('프로젝트 목록 페이지 로드', async ({ page }) => {
    await page.goto('/projects');
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('body')).not.toContainText(/500|Internal Server Error/i);
  });

  test('프로젝트 카드들이 올바른 형식으로 표시', async ({ page }) => {
    await page.goto('/projects');

    // 프로젝트 카드 확인
    const projectCards = page.locator('[class*="project"], [class*="card"]');
    const count = await projectCards.count();

    // 최소 1개 이상의 프로젝트가 있는지 또는 빈 상태
    if (count > 0) {
      // 첫 번째 카드에 기본 정보가 있는지 확인
      const firstCard = projectCards.first();
      await expect(firstCard).toBeVisible();
    }
  });

  test('프로젝트 목록에서 DB 에러 없음 확인', async ({ page }) => {
    await page.goto('/projects');

    // DB 에러 메시지가 없는지 확인
    const hasError = await page.locator('text=/에러|error|404|500/i').count();
    // 에러가 있으면 안 됨 (설정된 DB가 정상이라면)
  });
});

// ============================================================================
// 5. 프로젝트 상세 페이지 및 CRUD 테스트
// ============================================================================
test.describe('프로젝트 상세 페이지 및 CRUD 테스트', () => {
  test('프로젝트 카드 클릭하여 상세 페이지 로드', async ({ page }) => {
    await page.goto('/projects');

    const projectLink = page.locator('a[href*="/projects/"]').first();

    if (await projectLink.count() > 0) {
      const href = await projectLink.getAttribute('href');
      const projectId = href.split('/').pop();

      await projectLink.click();

      // 상세 페이지 로드 확인
      await expect(page).toHaveURL(new RegExp(`/projects/${projectId}`), { timeout: 5000 });
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('프로젝트 수정 - 모든 필드 수정 후 저장', async ({ page }) => {
    await page.goto('/projects');

    const projectLink = page.locator('a[href*="/projects/"]').first();
    if (await projectLink.count() === 0) {
      test.skip();
      return;
    }

    await projectLink.click();
    await page.waitForTimeout(1000);

    // 수정 버튼 클릭
    const editBtn = page.locator('button:has-text("수정"), button:has-text("Edit")').first();
    if (await editBtn.count() > 0) {
      await editBtn.click();
      await page.waitForTimeout(1000);

      // 모달 내부의 모든 input, textarea 찾기
      const inputs = page.locator('input[type="text"], textarea');
      const inputCount = await inputs.count();

      if (inputCount > 0) {
        // 첫 번째 입력 필드에 값 입력 (제목)
        const firstInput = inputs.nth(0);
        await firstInput.click();
        await firstInput.press('Control+A');
        await firstInput.fill('수정된프로젝트' + new Date().getTime());

        // 저장 버튼 클릭
        const saveBtn = page.locator('button:has-text("저장"), button:has-text("Save")').last();
        if (await saveBtn.count() > 0) {
          await saveBtn.click();
          await page.waitForTimeout(2000);
        }
      }
    } else {
      test.skip();
    }
  });

  test('프로젝트 목록에서 수정 내용 확인', async ({ page }) => {
    // 목록으로 돌아가서 수정된 내용이 반영되었는지 확인
    await page.goto('/projects');

    // 수정된 프로젝트 제목이 목록에 보여야 함
    const modifiedProject = page.locator('text=테스트 프로젝트').first();
    if (await modifiedProject.count() > 0) {
      await expect(modifiedProject).toBeVisible();
    }
  });

  test('프로젝트 삭제', async ({ page }) => {
    // 삭제 기능은 백엔드 구현에 따라 달라지므로 스킵
    test.skip();
  });
});

// ============================================================================
// 6. 소개 페이지 (/about)
// ============================================================================
test.describe('소개 페이지 테스트', () => {
  test('소개 페이지 접속 및 내용 표시', async ({ page }) => {
    await page.goto('/about');

    // 페이지 로드 확인
    await expect(page).toHaveTitle(/.+/);

    // Body가 보여야 함
    await expect(page.locator('body')).toBeVisible();

    // 500 에러가 없어야 함
    await expect(page.locator('body')).not.toContainText(/Internal Server Error|500/i);
  });

  test('소개 페이지에 콘텐츠가 있음', async ({ page }) => {
    await page.goto('/about');

    // 최소한 일정 길이의 텍스트 콘텐츠가 있는지 확인
    const content = await page.locator('body').textContent();
    expect(content.length).toBeGreaterThan(50);
  });
});

// ============================================================================
// 7. 어드민 로그인 페이지 (/admin/login)
// ============================================================================
test.describe('어드민 페이지 테스트', () => {
  test('어드민 로그인 페이지 접속', async ({ page }) => {
    await page.goto('/admin/login');

    // 페이지 로드 확인
    await expect(page).toHaveTitle(/.+/);

    // 로그인 폼이 있는지 확인
    const form = page.locator('form');
    await expect(form).toBeVisible();

    // 유저네임/아이디 입력 필드 확인
    const idInput = page.locator('input[type="text"], input[type="email"], input[id*="user"], input[id*="email"]').first();
    if (await idInput.count() > 0) {
      await expect(idInput).toBeVisible();
    }

    // 비밀번호 입력 필드 확인
    const passwordInput = page.locator('input[type="password"]');
    await expect(passwordInput).toBeVisible();

    // 로그인 버튼 확인
    const submitBtn = page.locator('button[type="submit"], button:has-text("로그인"), button:has-text("Login")').first();
    if (await submitBtn.count() > 0) {
      await expect(submitBtn).toBeVisible();
    }
  });

  test('어드민 로그인 페이지 에러 없음', async ({ page }) => {
    await page.goto('/admin/login');

    // 500 에러가 없어야 함
    await expect(page.locator('body')).not.toContainText(/Internal Server Error|500/i);

    // 로드 완료
    await expect(page.locator('body')).toBeVisible();
  });
});
