const IDEMPOTENT = new Set(['GET', 'HEAD', 'OPTIONS']);

export function createApiClient({ baseUrl, timeoutMs = 20000, retries = 1, token = null }) {
  let auth = token;

  async function request(method, path, body = undefined, options = {}) {
    const started = Date.now();
    const maxAttempts = (options.retry ?? IDEMPOTENT.has(method)) ? retries + 1 : 1;
    let lastError = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? timeoutMs);
      try {
        const headers = { Accept: 'application/json', ...(options.headers || {}) };
        if (body !== undefined) headers['Content-Type'] = 'application/json';
        const bearer = options.token !== undefined ? options.token : auth;
        if (bearer) headers.Authorization = `Bearer ${bearer}`;
        const res = await fetch(`${baseUrl}${path}`, {
          method,
          headers,
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: controller.signal,
        });
        const text = await res.text();
        let data = null;
        try {
          data = text ? JSON.parse(text) : null;
        } catch {
          data = text;
        }
        clearTimeout(timer);
        return {
          status: res.status,
          ok: res.ok,
          data,
          latencyMs: Date.now() - started,
          method,
          path,
          attempt,
        };
      } catch (err) {
        clearTimeout(timer);
        lastError = err;
        if (attempt === maxAttempts) {
          return {
            status: 0,
            ok: false,
            data: null,
            error: err.name === 'AbortError' ? 'timeout' : err.message,
            latencyMs: Date.now() - started,
            method,
            path,
            attempt,
          };
        }
      }
    }
    return { status: 0, ok: false, error: lastError?.message || 'request failed', method, path, latencyMs: Date.now() - started };
  }

  return {
    request,
    setToken(next) {
      auth = next;
    },
    getToken() {
      return auth;
    },
  };
}
