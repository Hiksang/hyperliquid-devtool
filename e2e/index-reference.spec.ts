import { test, expect } from '@playwright/test';

test.describe('Index Reference Panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173');
  });

  test('should show Index Reference on Precompile tab', async ({ page }) => {
    // Should be on Precompile tab by default
    await expect(page.getByText('Index Reference')).toBeVisible();
    await expect(page.getByText('Asset indices for precompile queries')).toBeVisible();
  });

  test('should have three tabs: Perp, Tokens, Pairs', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Perp/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Tokens/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Pairs/ })).toBeVisible();
  });

  test('should load perp assets from API', async ({ page }) => {
    // Wait for API to load
    await page.waitForTimeout(2000);

    // Should show BTC (index 0) and ETH (index 1) in perp list
    const pageContent = await page.textContent('body');
    expect(pageContent).toContain('BTC');
    expect(pageContent).toContain('ETH');
  });

  test('should switch to Tokens tab and show tokens', async ({ page }) => {
    // Click Tokens tab
    await page.getByRole('button', { name: /Tokens/ }).click();

    // Wait for content
    await page.waitForTimeout(1000);

    // Should show token indices
    const pageContent = await page.textContent('body');
    expect(pageContent).toContain('USDC');
  });

  test('should switch to Pairs tab and show @ pairs', async ({ page }) => {
    // Click Pairs tab
    await page.getByRole('button', { name: /Pairs/ }).click();

    // Wait for content
    await page.waitForTimeout(1000);

    // Should show @ notation
    const pageContent = await page.textContent('body');
    expect(pageContent).toContain('@');
  });

  test('should have search functionality', async ({ page }) => {
    // Type in search
    await page.getByPlaceholder('Search by name or index...').fill('HYPE');

    // Wait for filter
    await page.waitForTimeout(500);

    // Should filter to show HYPE
    const perpList = await page.textContent('body');
    expect(perpList).toContain('HYPE');
  });

  test('should show QuickActions on CoreWriter tab', async ({ page }) => {
    // Click CoreWriter tab
    await page.getByRole('button', { name: 'CoreWriter' }).click();

    // Should NOT show Index Reference
    await expect(page.getByText('Index Reference')).not.toBeVisible();

    // Should show Quick Actions
    await expect(page.getByText('Quick Actions')).toBeVisible();
  });

  test('should show footer with precompile mapping info', async ({ page }) => {
    // Footer should explain which index to use for which precompile
    await expect(page.getByText(/Perp Index.*markPx/)).toBeVisible();
    await expect(page.getByText(/Token Index.*spotBalance/)).toBeVisible();
    await expect(page.getByText(/Pair Index.*spotPx/)).toBeVisible();
  });
});
