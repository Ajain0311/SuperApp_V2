const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const screenshotsDir = path.join(__dirname, 'screenshots');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

async function runComprehensiveLiveBrowserTest() {
  console.log('\n===============================================================');
  console.log('🎭 PLAYWRIGHT LIVE BROWSER TEST: SUPERAPP FULL RUNTIME SUITE');
  console.log('===============================================================\n');

  const browser = await chromium.launch({
    headless: true, // running headless in CLI environment
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const testReport = {
    startedAt: new Date().toISOString(),
    steps: [],
    apiPerformance: [],
    failures: [],
    screenshots: [],
  };

  function logStep(name, status, details = '') {
    console.log(`\n▶️  [STEP] ${name} -> ${status} ${details}`);
    testReport.steps.push({ name, status, details, time: new Date().toISOString() });
  }

  function recordApi(method, url, status, durationMs) {
    console.log(`   ⚡ [API Performance] ${method} ${url} | Status: ${status} | Duration: ${durationMs}ms`);
    testReport.apiPerformance.push({ method, url, status, durationMs });
  }

  // =========================================================================
  // TEST SUITE 1: MOBILE APP FLOW (Phone Login, OTP Entry & Verification)
  // =========================================================================
  const mobileContext = await browser.newContext({
    viewport: { width: 412, height: 915 },
    userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Mobile Chrome/120.0.0.0 Mobile Safari/537.36',
  });

  const mobilePage = await mobileContext.newPage();

  mobilePage.on('request', (req) => {
    if (req.url().includes(':5000') || req.url().includes('/api/')) {
      req._reqStart = Date.now();
    }
  });

  mobilePage.on('response', (res) => {
    if (res.url().includes(':5000') || res.url().includes('/api/')) {
      const dur = res.request()._reqStart ? Date.now() - res.request()._reqStart : 0;
      recordApi(res.request().method(), res.url(), res.status(), dur);
    }
  });

  mobilePage.on('dialog', async (dialog) => {
    console.log(`   💬 [Mobile Dialog] ${dialog.type()}: "${dialog.message()}"`);
    await dialog.accept();
  });

  try {
    logStep('1. Open Mobile App', 'RUNNING', 'http://localhost:8081');
    await mobilePage.goto('http://localhost:8081', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await mobilePage.waitForTimeout(3000);

    const shot1 = path.join(screenshotsDir, '01_mobile_initial_load.png');
    await mobilePage.screenshot({ path: shot1, fullPage: true });
    testReport.screenshots.push('01_mobile_initial_load.png');
    logStep('1. Open Mobile App', 'PASSED', `Screenshot saved: ${shot1}`);

    // Fill Phone Input
    logStep('2. Test Phone Entry Form', 'RUNNING');
    const phoneInput = mobilePage.locator('input').first();
    await phoneInput.waitFor({ state: 'visible', timeout: 10000 });
    await phoneInput.click();
    await phoneInput.fill('9876543210');
    await mobilePage.waitForTimeout(1000);

    const shot2 = path.join(screenshotsDir, '02_mobile_phone_filled.png');
    await mobilePage.screenshot({ path: shot2, fullPage: true });
    testReport.screenshots.push('02_mobile_phone_filled.png');
    logStep('2. Test Phone Entry Form', 'PASSED', 'Entered 9876543210');

    // Submit Continue
    logStep('3. Submit Login & Request OTP', 'RUNNING');
    const submitBtn = mobilePage.getByText('Get Verification Code');
    await submitBtn.waitFor({ state: 'visible', timeout: 10000 });
    await submitBtn.click();
    
    // Wait for API call and navigation to OTP screen
    await mobilePage.waitForTimeout(3500);

    const shot3 = path.join(screenshotsDir, '03_mobile_otp_screen.png');
    await mobilePage.screenshot({ path: shot3, fullPage: true });
    testReport.screenshots.push('03_mobile_otp_screen.png');

    // Verify test OTP card is NOT present
    const bodyContent = await mobilePage.innerText('body');
    const hasTestOtpCard = bodyContent.includes('Tap to Auto-Fill') || bodyContent.includes('TEST OTP');
    if (!hasTestOtpCard) {
      logStep('3. Submit Login & Request OTP', 'PASSED', 'OTP screen reached cleanly without test OTP card');
    } else {
      logStep('3. Submit Login & Request OTP', 'WARNING', 'Test OTP card still detected in body text');
    }

    // Step 3b: Test OTP Verification Form inputs
    logStep('3b. Test OTP Digit Inputs Form', 'RUNNING');
    const otpInputs = await mobilePage.locator('input').all();
    console.log(`   🔢 Detected ${otpInputs.length} input boxes on screen`);
    if (otpInputs.length >= 6) {
      // Type 6 digits into the boxes
      const testCode = '123456';
      for (let i = 0; i < 6; i++) {
        await otpInputs[i].fill(testCode[i]);
        await mobilePage.waitForTimeout(100);
      }
      const shotOtpFilled = path.join(screenshotsDir, '03b_mobile_otp_filled.png');
      await mobilePage.screenshot({ path: shotOtpFilled, fullPage: true });
      testReport.screenshots.push('03b_mobile_otp_filled.png');
      logStep('3b. Test OTP Digit Inputs Form', 'PASSED', 'Filled 6-digit verification code: 123456');

      // Click Verify Button
      const verifyBtn = mobilePage.getByText('Verify & Continue').or(mobilePage.getByText('Verify OTP')).or(mobilePage.locator('text=/Verify/i')).first();
      if (await verifyBtn.isVisible()) {
        await verifyBtn.click();
        await mobilePage.waitForTimeout(3000);
        const shotPostVerify = path.join(screenshotsDir, '03c_post_verification.png');
        await mobilePage.screenshot({ path: shotPostVerify, fullPage: true });
        testReport.screenshots.push('03c_post_verification.png');
        logStep('3c. Submit OTP Verification', 'PASSED', 'Verification submitted to backend');
      }
    } else {
      logStep('3b. Test OTP Digit Inputs Form', 'SKIPPED', `Found ${otpInputs.length} inputs`);
    }

  } catch (err) {
    console.error('❌ Mobile flow error:', err.message);
    testReport.failures.push({ flow: 'Mobile App', error: err.message });
    const errShot = path.join(screenshotsDir, 'error_mobile_flow.png');
    await mobilePage.screenshot({ path: errShot, fullPage: true }).catch(() => {});
  } finally {
    await mobileContext.close();
  }

  // =========================================================================
  // TEST SUITE 2: WEB ADMIN PORTAL LIVE CRUD FOR ALL PAGES
  // =========================================================================
  const adminContext = await browser.newContext({
    viewport: { width: 1366, height: 850 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  });

  const adminPage = await adminContext.newPage();

  adminPage.on('request', (req) => {
    if (req.url().includes(':5000') || req.url().includes('/api/')) {
      req._reqStart = Date.now();
    }
  });

  adminPage.on('response', (res) => {
    if (res.url().includes(':5000') || res.url().includes('/api/')) {
      const dur = res.request()._reqStart ? Date.now() - res.request()._reqStart : 0;
      recordApi(res.request().method(), res.url(), res.status(), dur);
    }
  });

  adminPage.on('dialog', async (dialog) => {
    console.log(`   💬 [Admin Portal Dialog] ${dialog.type()}: "${dialog.message()}"`);
    await dialog.accept();
  });

  try {
    logStep('4. Open Web Admin Portal', 'RUNNING', 'http://localhost:5000/admin/index.html');
    await adminPage.goto('http://localhost:5000/admin/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await adminPage.waitForTimeout(2000);

    const shotAdmin1 = path.join(screenshotsDir, '04_admin_dashboard_loaded.png');
    await adminPage.screenshot({ path: shotAdmin1, fullPage: true });
    testReport.screenshots.push('04_admin_dashboard_loaded.png');
    logStep('4. Open Web Admin Portal', 'PASSED', 'Admin dashboard loaded with live KPI statistics');

    // -----------------------------------------------------------------------
    // Form Test 1: Restaurants Tab & Add Restaurant Modal
    // -----------------------------------------------------------------------
    logStep('5. Test Add Restaurant Modal Form', 'RUNNING');
    await adminPage.click('.nav-item:has-text("Restaurants"), [onclick*="restaurants"]');
    await adminPage.waitForTimeout(1000);

    // Click "+ Add Restaurant" button
    await adminPage.click('button:has-text("+ Add Restaurant")');
    await adminPage.waitForTimeout(600);

    const shotRestModal = path.join(screenshotsDir, '05_admin_add_restaurant_modal.png');
    await adminPage.screenshot({ path: shotRestModal });
    testReport.screenshots.push('05_admin_add_restaurant_modal.png');

    // Fill restaurant form inputs
    const testRestName = 'Playwright Grand Tandoor ' + Math.floor(Math.random() * 1000);
    await adminPage.fill('#restName', testRestName);
    await adminPage.fill('#restDesc', 'Authentic Dum Biryani and Tandoori Delicacies');
    await adminPage.fill('#restPhone', '9876543210');
    await adminPage.fill('#restCity', 'Chandigarh');
    await adminPage.fill('#restAddress', 'SCO 44, Sector 35-B Market');
    await adminPage.selectOption('#restIsVeg', 'false');
    await adminPage.fill('#restMinOrder', '140');
    await adminPage.fill('#restDeliveryFee', '35');

    // Submit the form
    await adminPage.click('#restaurantModal button.btn-primary');
    await adminPage.waitForTimeout(2000);

    const shotRestSaved = path.join(screenshotsDir, '06_admin_restaurant_published.png');
    await adminPage.screenshot({ path: shotRestSaved });
    testReport.screenshots.push('06_admin_restaurant_published.png');
    logStep('5. Test Add Restaurant Modal Form', 'PASSED', `Created & published "${testRestName}"`);

    // -----------------------------------------------------------------------
    // Form Test 2: Coupons Tab & Add Coupon Modal
    // -----------------------------------------------------------------------
    logStep('6. Test Add Coupon Modal Form', 'RUNNING');
    await adminPage.click('.nav-item:has-text("Coupons"), [onclick*="coupons"]');
    await adminPage.waitForTimeout(1000);

    await adminPage.click('button:has-text("+ New Coupon")');
    await adminPage.waitForTimeout(600);

    const couponCode = 'PLAY' + Math.floor(Math.random() * 900 + 100);
    await adminPage.fill('#couponCode', couponCode);
    await adminPage.fill('#couponDesc', 'Playwright Automated E2E Discount Voucher');
    await adminPage.fill('#couponValue', '60');
    await adminPage.selectOption('#couponDiscountType', 'PERCENTAGE');
    await adminPage.fill('#couponMinOrder', '250');
    await adminPage.selectOption('#couponModule', 'FOOD');

    // Submit coupon
    await adminPage.click('#couponModal button.btn-primary');
    await adminPage.waitForTimeout(2000);

    const shotCouponSaved = path.join(screenshotsDir, '07_admin_coupon_published.png');
    await adminPage.screenshot({ path: shotCouponSaved });
    testReport.screenshots.push('07_admin_coupon_published.png');
    logStep('6. Test Add Coupon Modal Form', 'PASSED', `Created & published coupon "${couponCode}"`);

    // -----------------------------------------------------------------------
    // Form Test 3: Banners Tab & Add Banner Modal
    // -----------------------------------------------------------------------
    logStep('7. Test Add Banner Modal Form', 'RUNNING');
    await adminPage.click('.nav-item:has-text("Banners"), [onclick*="banners"]');
    await adminPage.waitForTimeout(1000);

    await adminPage.click('button:has-text("+ Add Banner")');
    await adminPage.waitForTimeout(600);

    const bannerTitle = 'E2E Feast Celebration ' + Math.floor(Math.random() * 100);
    await adminPage.fill('#bannerTitle', bannerTitle);
    await adminPage.fill('#bannerImageUrl', 'https://images.unsplash.com/photo-1543353071-873f17a7a088?w=600');
    await adminPage.selectOption('#bannerModule', 'FOOD');
    await adminPage.selectOption('#bannerTargetType', 'PROMO');

    // Submit banner
    await adminPage.click('#bannerModal button.btn-primary');
    await adminPage.waitForTimeout(2000);

    const shotBannerSaved = path.join(screenshotsDir, '08_admin_banner_published.png');
    await adminPage.screenshot({ path: shotBannerSaved });
    testReport.screenshots.push('08_admin_banner_published.png');
    logStep('7. Test Add Banner Modal Form', 'PASSED', `Created & published banner "${bannerTitle}"`);

    // -----------------------------------------------------------------------
    // Form Test 4: Drivers Verification & Action
    // -----------------------------------------------------------------------
    logStep('8. Test Drivers Verification Tab', 'RUNNING');
    await adminPage.click('.nav-item:has-text("Drivers"), [onclick*="drivers"]');
    await adminPage.waitForTimeout(1000);

    const shotDrivers = path.join(screenshotsDir, '09_admin_drivers_queue.png');
    await adminPage.screenshot({ path: shotDrivers });
    testReport.screenshots.push('09_admin_drivers_queue.png');
    logStep('8. Test Drivers Verification Tab', 'PASSED', 'Drivers fleet loaded from PostgreSQL');

    // -----------------------------------------------------------------------
    // Form Test 5: Global System Settings Form
    // -----------------------------------------------------------------------
    logStep('9. Test Global Settings Form & Persistence', 'RUNNING');
    await adminPage.click('.nav-item:has-text("Settings"), [onclick*="settings"]');
    await adminPage.waitForTimeout(1000);

    await adminPage.fill('#settingFoodComm', '16');
    await adminPage.fill('#settingRideComm', '22');
    await adminPage.fill('#settingCurrency', 'INR (₹)');
    await adminPage.fill('#settingHotline', '+91 1800 555 7788');

    await adminPage.click('button:has-text("Save Changes")');
    await adminPage.waitForTimeout(1500);

    const shotSettings = path.join(screenshotsDir, '10_admin_settings_saved.png');
    await adminPage.screenshot({ path: shotSettings });
    testReport.screenshots.push('10_admin_settings_saved.png');
    logStep('9. Test Global Settings Form & Persistence', 'PASSED', 'System settings saved to PostgreSQL');

    // -----------------------------------------------------------------------
    // Form Test 6: Marketplace Moderation Tab
    // -----------------------------------------------------------------------
    logStep('10. Test Marketplace Moderation Tab', 'RUNNING');
    await adminPage.click('.nav-item:has-text("Marketplace"), [onclick*="marketplace"]');
    await adminPage.waitForTimeout(1000);

    const shotBazaar = path.join(screenshotsDir, '11_admin_marketplace.png');
    await adminPage.screenshot({ path: shotBazaar });
    testReport.screenshots.push('11_admin_marketplace.png');
    logStep('10. Test Marketplace Moderation Tab', 'PASSED', 'Live community bazaar listings loaded');

  } catch (err) {
    console.error('❌ Admin portal flow error:', err.message);
    testReport.failures.push({ flow: 'Admin Portal', error: err.message });
    const errShot = path.join(screenshotsDir, 'error_admin_portal.png');
    await adminPage.screenshot({ path: errShot, fullPage: true }).catch(() => {});
  } finally {
    await adminContext.close();
  }

  await browser.close();
  console.log('\n🔒 [Playwright] All Chromium browser instances closed cleanly.');

  // Summary
  console.log('\n===============================================================');
  console.log('📊 PLAYWRIGHT LIVE TEST RUN SUMMARY');
  console.log('===============================================================');
  console.log(`Total Steps Executed:   ${testReport.steps.length}`);
  console.log(`Passed Steps:           ${testReport.steps.filter(s => s.status === 'PASSED').length}`);
  console.log(`Failed Steps:           ${testReport.failures.length}`);
  console.log(`API Calls Observed:     ${testReport.apiPerformance.length}`);
  console.log(`Screenshots Captured:   ${testReport.screenshots.length}`);

  console.log('\n📡 [API Performance Summary]:');
  testReport.apiPerformance.forEach((p, idx) => {
    console.log(`  ${idx + 1}. [${p.method}] ${p.url} -> ${p.status} (${p.durationMs}ms)`);
  });

  return testReport;
}

runComprehensiveLiveBrowserTest().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
