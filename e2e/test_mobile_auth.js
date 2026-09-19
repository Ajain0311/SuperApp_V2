const { chromium } = require('playwright');
const path = require('path');

async function testMobileFullLogin() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 412, height: 915 },
  });

  page.on('console', (msg) => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('dialog', async (dialog) => {
    console.log('BROWSER DIALOG:', dialog.type(), dialog.message());
    await dialog.accept();
  });
  page.on('request', (req) => {
    if (req.url().includes(':5000') || req.url().includes('/api/')) {
      console.log('API REQ:', req.method(), req.url());
    }
  });
  page.on('response', (res) => {
    if (res.url().includes(':5000') || res.url().includes('/api/')) {
      console.log('API RES:', res.status(), res.url());
    }
  });

  await page.goto('http://localhost:8081', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  console.log('--- Step 1: Entering phone number ---');
  const phoneInput = page.locator('input').first();
  await phoneInput.click();
  await phoneInput.pressSequentially('9876543210', { delay: 50 });
  await page.waitForTimeout(500);

  console.log('--- Step 2: Submitting phone number ---');
  const btn = page.getByText('Get Verification Code');
  
  // Wait for the send-otp response
  const [response] = await Promise.all([
    page.waitForResponse(res => res.url().includes('/api/auth/send-otp'), { timeout: 15000 }),
    btn.click(),
  ]);
  console.log('Send-otp response received with status:', response.status());

  // Wait for OTP verification header to appear
  await page.waitForSelector('text=Verify OTP', { timeout: 10000 });
  // Wait for digit input boxes to mount
  await page.waitForFunction(() => document.querySelectorAll('input').length >= 6, { timeout: 10000 });

  console.log('--- Step 3: Inspecting inputs on OTP screen ---');
  const allInputs = await page.locator('input').all();
  console.log(`Found ${allInputs.length} inputs on screen`);

  let otpStartIndex = 0;
  if (allInputs.length === 7) {
    console.log('Filling Full Name...');
    await allInputs[0].pressSequentially('Aditya Live Tester', { delay: 30 });
    otpStartIndex = 1;
  }

  console.log('Filling 6-digit OTP: 123456...');
  const otpCode = '123456';
  for (let i = 0; i < 6; i++) {
    const box = allInputs[otpStartIndex + i];
    await box.click();
    await box.pressSequentially(otpCode[i], { delay: 40 });
    await page.waitForTimeout(50);
  }

  await page.screenshot({ path: path.join(__dirname, 'screenshots', '03b_otp_digits_entered.png') });

  console.log('--- Step 4: Submitting OTP Verification ---');
  const verifyBtn = page.getByText('Verify & Continue');
  
  const [verifyRes] = await Promise.all([
    page.waitForResponse(res => res.url().includes('/api/auth/verify-otp'), { timeout: 15000 }),
    verifyBtn.click(),
  ]);
  console.log('Verify-otp response status:', verifyRes.status());
  const verifyData = await verifyRes.json().catch(() => ({}));
  console.log('Verify response data:', JSON.stringify(verifyData));

  await page.waitForTimeout(4000);

  const finalBody = await page.innerText('body');
  console.log('Post-verify body text preview:', finalBody.substring(0, 300).replace(/\n+/g, ' '));
  await page.screenshot({ path: path.join(__dirname, 'screenshots', '04_mobile_home_maintabs.png') });

  await browser.close();
  console.log('✅ Mobile Auth Flow Completed Successfully!');
}

testMobileFullLogin().catch(console.error);
