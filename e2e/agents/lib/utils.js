export const FRAMEWORK_VERSION = '1.0.0';

export function createRunId() {
  return `run-${Date.now().toString(36)}`;
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 10-digit mobiles unique to this run. roleDigit is 1-4. */
export function mobileFor(runStamp, roleDigit, index) {
  const tail = String(runStamp % 1_000_000).padStart(6, '0');
  const idx = String(index).padStart(2, '0');
  return `9${roleDigit}${tail}${idx}`.slice(0, 10);
}

export function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

export function median(values) {
  return percentile(values, 50);
}

export function letterLabel(index) {
  return String.fromCharCode(65 + (index % 26)) + (index >= 26 ? String(index) : '');
}

export async function mapPool(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.max(1, Math.min(limit, items.length || 1)) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await worker(items[i], i);
    }
  });
  await Promise.all(runners);
  return results;
}

export function redact(value) {
  if (value == null) return value;
  if (typeof value === 'string') {
    if (value.length > 40 && value.includes('.')) return '[redacted]';
    return value;
  }
  if (Array.isArray(value)) return value.map(redact);
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (/token|password|authorization|otp/i.test(k)) out[k] = v ? '[redacted]' : v;
      else out[k] = redact(v);
    }
    return out;
  }
  return value;
}
