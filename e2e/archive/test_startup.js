const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function testAppStartup() {
  const screenshotsDir = path.join(__dirname, 'screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  console.log('🚀 [Playwright] Launching Chromium browser...');
  const browser = await chromium.launch({
    headless: true, // run headless for autonomous verification
  });

  const context = await browser.newContext({
    viewport: { width: 412, height: 915 }, // Pixel 7 viewport
    userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  });

  const page = await context.newPage();

  // Monitor network requests and API timings
  const apiRequests = [];
  page.on('request', (req) => {
    if (req.url().includes(':5000') || req.url().includes('/api/')) {
      req._startTime = Date.now();
      console.log(`📡 [API Request] ${req.method()} ${req.url()}`);
    }
  });

  page.on('response', (res) => {
    if (res.url().includes(':5000') || res.url().includes('/api/')) {
      const duration = res.request()._startTime ? Date.now() - res.request()._startTime : 'N/A';
      console.log(`📥 [API Response] ${res.status()} ${res.url()} (${duration}ms)`);
      apiRequests.push({
        url: res.url(),
        method: res.request().method(),
        status: res.status(),
        duration,
      });
    }
  });

  page.on('console', (msg) => {
    const text = msg.text();
    if (!text.includes('deprecated') && !text.includes('Download the React DevTools')) {
      console.log(`🖥️  [Browser Console] ${msg.type()}: ${text}`);
    }
  });

  page.on('pageerror', (err) => {
    console.error(`❌ [Browser PageError] ${err.message}`);
  });

  try {
    console.log('🌐 [Playwright] Navigating to SuperApp frontend: http://localhost:8081 ...');
    const response = await page.goto('http://localhost:8081', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    console.log(`✅ [Playwright] Page loaded with HTTP status: ${response ? response.status() : 'Unknown'}`);

    // Wait 3 seconds for Expo React Native Web root to mount and initialize
    await page.waitForTimeout(3000);

    const initialScreenshotPath = path.join(screenshotsDir, '01_startup_screen.png');
    await page.screenshot({ path: initialScreenshotPath, fullPage: true });
    console.log(`📸 [Screenshot] Captured initial screen -> ${initialScreenshotPath}`);

    // Print page title and main container
    const title = await page.title();
    console.log(`📄 [Document Title]: "${title}"`);

    // Check visible text content
    const bodyText = await page.innerText('body');
    const preview = bodyText.replace(/\s+/g, ' ').substring(0, 300);
    console.log(`🔍 [Rendered Content Preview]: ${preview}...`);

    return { success: true, apiRequests };
  } catch (err) {
    console.error(`💥 [Playwright Error] Failed: ${err.message}`);
    const errScreenshotPath = path.join(screenshotsDir, 'error_startup.png');
    await page.screenshot({ path: errScreenshotPath, fullPage: true }).catch(() => {});
    return { success: false, error: err.message };
  } finally {
    await browser.close();
    console.log('🔒 [Playwright] Browser closed.');
  }
}

testAppStartup().then((res) => {
  console.log('\n🏁 [Result]:', res);
});
