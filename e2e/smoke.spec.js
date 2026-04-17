import { test, expect } from '@playwright/test';

test.describe('Public UI smoke', () => {
  test('homepage loads with demo and language controls', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Try Awaaz AI now')).toBeVisible();
    await expect(page.locator('[data-lang="ks"]')).toBeVisible();
    await expect(page.locator('#analyzeBtn')).toBeVisible();
  });

  test('stats section container exists', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#statsBars')).toBeAttached();
    await expect(page.locator('#statsIssues')).toBeAttached();
  });

  test('user dashboard page loads', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'My complaints' })).toBeVisible();
    await expect(page.locator('#sessionIdDisplay')).not.toHaveText('—');
  });
});

test.describe('Public API smoke', () => {
  test('health returns ok', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  test('stats returns expected shape', async ({ request }) => {
    const res = await request.get('/api/stats');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(typeof body.total).toBe('number');
    expect(body.by_severity).toBeDefined();
    expect(body.by_issue_type).toBeDefined();
  });

  test('analyze rejects short text without calling Gemini success path', async ({ request }) => {
    const res = await request.post('/api/analyze', {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({
        text: 'short',
        language: 'en',
        sessionId: '00000000-0000-4000-8000-000000000001',
      }),
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Validation failed');
  });
});
