import { test, expect } from '@playwright/test';

test.describe('SuperApp V2 — Auth Flow & App Entry', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load application container and brand presentation', async ({ page }) => {
    // React Navigation sets document title dynamically to the active route (e.g. PhoneEntry / Splash)
    await expect(page).toHaveTitle(/PhoneEntry|Splash|SuperApp|HTTP-EXPNAT-NET/i);

    // Verify main brand header / hero title is displayed
    const body = page.locator('body');
    await expect(body).toBeVisible();

    // Verify key brand elements exist
    const brandElement = page.getByText(/SuperApp/i).first();
    await expect(brandElement).toBeVisible({ timeout: 15000 });
  });

  test('should display phone entry screen with service badges', async ({ page }) => {
    // Service categories should be advertised on welcome screen
    const foodBadge = page.getByText(/Food Delivery|🍕/i).first();
    await expect(foodBadge).toBeVisible({ timeout: 15000 });

    const phoneInput = page.getByPlaceholder(/Mobile Number/i);
    await expect(phoneInput).toBeVisible();
    await expect(phoneInput).toBeEnabled();
  });

  test('validates 10-digit mobile number input', async ({ page }) => {
    const phoneInput = page.getByPlaceholder(/Mobile Number/i);
    await expect(phoneInput).toBeVisible();

    // Type partial phone number
    await phoneInput.fill('98765');
    await expect(page.getByText(/5\/10 digits entered/i)).toBeVisible();

    // Type full 10-digit mobile number
    await phoneInput.fill('9876543210');
    await expect(page.getByText(/Ready to send code/i)).toBeVisible();

    // Continue / Send OTP button with label "Get Verification Code"
    const continueBtn = page.getByText(/Get Verification Code/i).first();
    await expect(continueBtn).toBeVisible();
  });

  test('verifies security trust and privacy indicators on login', async ({ page }) => {
    await expect(page.getByText(/100% Secure/i)).toBeVisible();
    await expect(page.getByText(/End-to-End Encrypted/i)).toBeVisible();
    await expect(page.getByText(/Terms of Service/i)).toBeVisible();
  });
});
