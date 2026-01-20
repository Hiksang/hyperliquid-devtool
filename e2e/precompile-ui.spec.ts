import { test, expect } from '@playwright/test';

test.describe('Precompile Panel UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173');
  });

  test('should show L1Read Precompiles section', async ({ page }) => {
    await expect(page.getByText('L1Read Precompiles')).toBeVisible();
  });

  test('should have Test All Precompiles button', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Test All Precompiles' })).toBeVisible();
  });

  test('Test All Precompiles should work and show results', async ({ page }) => {
    // Click Test All Precompiles
    await page.getByRole('button', { name: 'Test All Precompiles' }).click();

    // Wait for precompiles to finish (they run sequentially)
    await page.waitForTimeout(15000);

    // Get the entire page content
    const pageContent = await page.textContent('body');

    // Check that results appeared for key precompiles
    // Withdrawable should show $ amount
    expect(pageContent).toContain('$0.00'); // At least one $ value

    // Spot Balance should show Total: X.XXXXXX
    expect(pageContent).toContain('Total:');
    expect(pageContent).toContain('Hold:');

    // Check precompile addresses are correct
    expect(pageContent).toContain('0x0000000000000000000000000000000000000800'); // Position
    expect(pageContent).toContain('0x0000000000000000000000000000000000000801'); // Spot Balance
    expect(pageContent).toContain('0x0000000000000000000000000000000000000803'); // Withdrawable
    expect(pageContent).toContain('0x0000000000000000000000000000000000000807'); // Oracle Price
    expect(pageContent).toContain('0x0000000000000000000000000000000000000809'); // L1 Block
  });

  test('should show Spot Balance result with USDC balance', async ({ page }) => {
    // Click Test All
    await page.getByRole('button', { name: 'Test All Precompiles' }).click();
    await page.waitForTimeout(8000);

    // Check for Spot Balance result - USDC uses weiDecimals=8, so /1e8
    // Previous: 50.669224 (wrong, /1e6), Now: 0.506692 (correct, /1e8)
    const pageContent = await page.textContent('body');
    expect(pageContent).toContain('Total: 0.506692'); // Known test address USDC balance
  });

  test('should show Position result with leverage', async ({ page }) => {
    await page.getByRole('button', { name: 'Test All Precompiles' }).click();
    await page.waitForTimeout(8000);

    const pageContent = await page.textContent('body');
    expect(pageContent).toContain('Leverage:'); // Position result format
  });

  test('precompile panel should not require wallet connection', async ({ page }) => {
    // The page should show results even without wallet connected
    // Check that "Connect Wallet" is visible (meaning no wallet connected)
    await expect(page.getByText('Connect Wallet')).toBeVisible();

    // But precompiles should still work
    await page.getByRole('button', { name: 'Test All Precompiles' }).click();
    await page.waitForTimeout(8000);

    // Should still get results
    const pageContent = await page.textContent('body');
    expect(pageContent).toContain('Total:'); // Spot Balance result
  });
});
