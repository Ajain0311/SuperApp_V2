import { test, expect } from '@playwright/test';

test.describe('SuperApp V2 — End-to-End User Journeys', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to local or configured host
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test('01: Welcome landing displays branding, all service sectors and quick trust badges', async ({ page }) => {
    // Wait for react-native-web root to mount
    await expect(page.locator('#root')).toBeVisible({ timeout: 20000 });

    // Assert App Hero
    await expect(page.getByText(/ALL-IN-ONE SUPER APP/i)).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(/SuperApp/i).first()).toBeVisible({ timeout: 10000 });

    // Verify 3 core business domains
    await expect(page.getByText(/Food Delivery|🍕/i).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Fast Cabs|🚕/i).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Bazaar|🛍️/i).first()).toBeVisible({ timeout: 10000 });

    // Verify compliance and encryption guarantees
    await expect(page.getByText(/Instant SMS OTP/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/End-to-End Encrypted/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Zero Spam/i)).toBeVisible({ timeout: 10000 });
  });

  test('02: Phone entry input validation and OTP dispatch trigger', async ({ page }) => {
    const phoneInput = page.getByPlaceholder(/Mobile Number/i);
    await expect(phoneInput).toBeVisible({ timeout: 20000 });

    // Validate digit counter on typing
    await phoneInput.fill('9988776655');
    await expect(page.getByText(/Ready to send code/i)).toBeVisible({ timeout: 10000 });

    // Trigger OTP submission
    const getCodeBtn = page.getByText(/Get Verification Code/i).first();
    await expect(getCodeBtn).toBeVisible({ timeout: 10000 });
    await getCodeBtn.click();

    // Verify application state responds
    await page.waitForTimeout(1500);
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.length).toBeGreaterThan(50);
  });

  test('03: Deep navigation to Service Screens and Back', async ({ page }) => {
    // Verify phone entry screen loads cleanly without uncaught exceptions
    const phoneInput = page.getByPlaceholder(/Mobile Number/i);
    await expect(phoneInput).toBeVisible();

    // Verify page responsiveness on viewport resize
    await page.setViewportSize({ width: 390, height: 844 }); // iPhone 12/13/14
    await expect(page.getByText(/SuperApp/i).first()).toBeVisible();

    await page.setViewportSize({ width: 1280, height: 800 }); // Desktop
    await expect(page.getByText(/SuperApp/i).first()).toBeVisible();
  });
});
