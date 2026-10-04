import { createApiClient } from './api-client.js';

export function createAgent({ id, role, mobile, name, baseUrl, timeoutMs, retries }) {
  const client = createApiClient({ baseUrl, timeoutMs, retries });
  return {
    id,
    role,
    mobile,
    name,
    token: null,
    user: null,
    login: 'PENDING',
    client,
    resources: { orderIds: [], rideIds: [], listingIds: [], restaurantId: null, driverId: null },
    counts: { tests: 0, passed: 0, failed: 0 },
    setToken(token) {
      this.token = token;
      client.setToken(token);
    },
  };
}
