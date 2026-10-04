export async function loginCitizen(client, { mobile, fullName, fallbackOtp }) {
  const send = await client.request('POST', '/api/auth/send-otp', { mobileNumber: mobile }, { retry: false });
  if (send.status !== 200 || send.data?.success === false) {
    return { ok: false, send, verify: null, otp: null };
  }
  const otp = send.data?.devOtp || send.data?.DevOtp || fallbackOtp;
  if (!otp) return { ok: false, send, verify: null, otp: null, reason: 'no dev OTP and no fallback configured' };
  const verify = await client.request('POST', '/api/auth/verify-otp', {
    mobileNumber: mobile,
    otpCode: otp,
    fullName,
  }, { retry: false });
  return { ok: verify.status === 200 && !!verify.data?.token, send, verify, otp };
}

export async function loginAdmin(client, { mobile, password, fallbackOtp }) {
  const send = await client.request('POST', '/api/auth/send-otp', { mobileNumber: mobile }, { retry: false });
  const otp = send.data?.devOtp || send.data?.DevOtp || fallbackOtp;
  if (!otp) return { ok: false, send, verify: null, reason: 'admin OTP unavailable' };
  const verify = await client.request('POST', '/api/auth/admin-login', {
    mobileNumber: mobile,
    password,
    otpCode: otp,
  }, { retry: false });
  return { ok: verify.status === 200 && !!verify.data?.token, send, verify, otp };
}
