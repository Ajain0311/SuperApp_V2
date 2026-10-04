export function statusMatches(actual, expected) {
  if (Array.isArray(expected)) return expected.includes(actual);
  return actual === expected;
}

export function payload(res) {
  if (res?.data && typeof res.data === 'object' && 'data' in res.data) return res.data.data;
  return res?.data;
}

export function assertStatus(res, expected, message) {
  const ok = statusMatches(res.status, expected);
  return {
    ok,
    expected,
    actual: res.status,
    message: ok ? message : `${message} (expected ${expected}, got ${res.status})`,
  };
}
