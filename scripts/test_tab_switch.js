const { chromium } = require('playwright');

(async () => {
  console.log('Testing Tab Navigation on http://localhost:8081...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 412, height: 915 }
  });
  const page = await context.newPage();

  let pageReloadCount = 0;
  page.on('load', () => {
    pageReloadCount++;
    console.log(`[Event] Browser page loaded (count: ${pageReloadCount})`);
  });

  page.on('console', msg => {
    const text = msg.text();
    if (msg.type() === 'error' || text.includes('Error') || text.includes('reload')) {
      console.log(`[Browser ${msg.type()}]`, text.slice(0, 150));
    }
  });

  try {
    await page.goto('http://localhost:8081', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Login if needed
    const phoneInput = page.locator('input').first();
    if (await phoneInput.isVisible()) {
      console.log('Logging in with 9876543210...');
      await phoneInput.click();
      await phoneInput.pressSequentially('9876543210', { delay: 40 });
      await page.waitForTimeout(500);

      const getCodeBtn = page.getByText('Get Verification Code');
      await Promise.all([
        page.waitForResponse(r => r.url().includes('/api/auth/send-otp'), { timeout: 15000 }),
        getCodeBtn.click(),
      ]);
      await page.waitForSelector('text=Verify OTP', { timeout: 15000 });
      await page.waitForTimeout(1000);
      const allOtpInputs = await page.locator('input').all();
      let otpBoxOffset = allOtpInputs.length === 7 ? 1 : 0;
      if (otpBoxOffset === 1) await allOtpInputs[0].pressSequentially('Tester', { delay: 30 });
      for (let i = 0; i < 6; i++) {
        await allOtpInputs[otpBoxOffset + i].pressSequentially('123456'[i], { delay: 30 });
      }
      const verifyBtn = page.getByText('Verify & Continue');
      await Promise.all([
        page.waitForResponse(r => r.url().includes('/api/auth/verify-otp'), { timeout: 15000 }),
        verifyBtn.click(),
      ]);
      await page.waitForTimeout(3000);
    }

    console.log('Initial page reload count before tab switching:', pageReloadCount);

    // Now test clicking Food tab
    console.log('Clicking Food tab...');
    const foodTab = page.getByTestId('tab-food');
    await foodTab.click();
    await page.waitForTimeout(1500);

    // Now test clicking Rides tab
    console.log('Clicking Rides tab...');
    const ridesTab = page.getByTestId('tab-rides');
    await ridesTab.click();
    await page.waitForTimeout(1500);

    // Now test clicking Bazaar tab
    console.log('Clicking Bazaar tab...');
    const bazaarTab = page.getByTestId('tab-bazaar');
    await bazaarTab.click();
    await page.waitForTimeout(1500);

    // Now test clicking Home tab
    console.log('Clicking Home tab...');
    const homeTab = page.getByTestId('tab-home');
    await homeTab.click();
    await page.waitForTimeout(1500);

    console.log('Final page reload count after all tab switches:', pageReloadCount);
    if (pageReloadCount === 1) {
      console.log('SUCCESS: Tabs switched smoothly with ZERO full app reloads!');
    } else {
      console.log(`WARNING: Page reloaded ${pageReloadCount - 1} time(s) during tab switches!`);
    }
  } catch (err) {
    console.error('Error during tab switch test:', err.message);
  } finally {
    await browser.close();
  }
})();
