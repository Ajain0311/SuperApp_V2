function devOtpFrom(send) {
  const value = send?.data?.devOtp ?? send?.data?.DevOtp ?? null;
  return value || null;
}

function messageOf(res) {
  const data = res?.data;
  if (!data) return res?.error || 'no response';
  if (typeof data === 'string') return data.slice(0, 180);
  return data.message || data.Message || '';
}

/**
 * OTP selection. Never logs the code.
 * devOtp from Mock send-otp wins. Otherwise TEST_OTP / config.
 * If the API hid devOtp, try the development test code once. PunjabGov
 * accepts that code outside Production. A rejected probe is BLOCKED, not a fake JWT.
 */
export function chooseOtp({ send, fallbackOtp, allowDevProbe }) {
  const fromApi = devOtpFrom(send);
  if (fromApi) return { otp: fromApi, source: 'devOtp' };
  if (fallbackOtp) return { otp: fallbackOtp, source: 'TEST_OTP' };
  if (allowDevProbe) return { otp: '123456', source: 'dev-probe' };
  return { otp: null, source: 'none' };
}

export function classifyLogin({ send, verify, otpSource }) {
  if (!send || send.status === 0) {
    return { login: 'FAIL', reason: `send-otp transport error: ${send?.error || 'unknown'}` };
  }
  if (send.status !== 200 || send.data?.success === false) {
    return { login: 'FAIL', reason: `send-otp status ${send.status}: ${messageOf(send)}` };
  }
  if (!verify) {
    return {
      login: 'BLOCKED',
      reason: 'send-otp status 200; devOtp available: false; TEST_OTP/OTP_TEST_MODE not configured',
    };
  }
  if (verify.status === 200 && verify.data?.token) {
    return { login: 'PASS', reason: `verify status 200 via ${otpSource}` };
  }
  if (otpSource === 'dev-probe' && (verify.status === 400 || verify.status === 401)) {
    return {
      login: 'BLOCKED',
      reason: `send-otp status 200; devOtp available: false; verify status ${verify.status}; reason: ${messageOf(verify) || 'test OTP rejected (real SMS or production)'}`,
    };
  }
  return {
    login: 'FAIL',
    reason: `send-otp status ${send.status}; devOtp available: ${otpSource === 'devOtp'}; verify status ${verify.status}; reason: ${messageOf(verify)}`,
  };
}

export async function loginCitizen(client, options) {
  const send = await client.request('POST', '/api/auth/send-otp', { mobileNumber: options.mobile }, { retry: false });
  const chosen = chooseOtp({ send, fallbackOtp: options.fallbackOtp, allowDevProbe: options.allowDevProbe });
  if (send.status !== 200 || !chosen.otp) {
    const outcome = classifyLogin({ send, verify: null, otpSource: chosen.source });
    return { ok: false, send, verify: null, ...outcome, otpSource: chosen.source };
  }
  const verify = await client.request('POST', '/api/auth/verify-otp', {
    mobileNumber: options.mobile,
    otpCode: chosen.otp,
    fullName: options.fullName,
  }, { retry: false });
  const outcome = classifyLogin({ send, verify, otpSource: chosen.source });
  return { ok: outcome.login === 'PASS', send, verify, ...outcome, otpSource: chosen.source };
}

export async function loginAdmin(client, options) {
  if (!options.password) {
    return { ok: false, send: null, verify: null, login: 'BLOCKED', reason: 'ADMIN_PASSWORD is not set', otpSource: 'none' };
  }
  const send = await client.request('POST', '/api/auth/send-otp', { mobileNumber: options.mobile }, { retry: false });
  const chosen = chooseOtp({ send, fallbackOtp: options.fallbackOtp, allowDevProbe: options.allowDevProbe });
  if (send.status !== 200 || !chosen.otp) {
    const outcome = classifyLogin({ send, verify: null, otpSource: chosen.source });
    return { ok: false, send, verify: null, ...outcome, otpSource: chosen.source };
  }
  const verify = await client.request('POST', '/api/auth/admin-login', {
    mobileNumber: options.mobile,
    password: options.password,
    otpCode: chosen.otp,
  }, { retry: false });
  const outcome = classifyLogin({ send, verify, otpSource: chosen.source });
  return { ok: outcome.login === 'PASS', send, verify, ...outcome, otpSource: chosen.source };
}
