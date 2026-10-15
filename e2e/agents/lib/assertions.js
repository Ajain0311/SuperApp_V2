export function statusMatches(actual, expected) {
  if (Array.isArray(expected)) return expected.includes(actual);
  return actual === expected;
}

/** Unwrap ApiResponse.data / Data. Leaves raw arrays and plain objects alone. */
export function payload(res) {
  const body = res?.data;
  if (body == null || typeof body !== 'object') return body ?? null;
  if (Array.isArray(body)) return body;
  if (Object.prototype.hasOwnProperty.call(body, 'data')) return body.data;
  if (Object.prototype.hasOwnProperty.call(body, 'Data')) return body.Data;
  return body;
}

/** Lists from a raw array, ApiResponse list, or paged { items | Items }. */
export function asList(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') {
    if (Array.isArray(value.items)) return value.items;
    if (Array.isArray(value.Items)) return value.Items;
    if (Array.isArray(value.data)) return value.data;
    if (Array.isArray(value.Data)) return value.Data;
  }
  return null;
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
