export const captainActions = {
  toggleOnline(agent, isOnline = true) {
    return agent.client.request('POST', '/api/driver/toggle-online', { isOnline });
  },
  available(agent) {
    return agent.client.request('GET', '/api/driver/available-rides');
  },
  accept(agent, id) {
    return agent.client.request('POST', `/api/driver/rides/${id}/accept`);
  },
  arriving(agent, id) {
    return agent.client.request('POST', `/api/driver/rides/${id}/arriving`);
  },
  start(agent, id, otpCode) {
    return agent.client.request('POST', `/api/driver/rides/${id}/start`, { otpCode });
  },
  complete(agent, id) {
    return agent.client.request('POST', `/api/driver/rides/${id}/complete`);
  },
  cancel(agent, id) {
    return agent.client.request('POST', `/api/driver/rides/${id}/cancel`, { reason: 'agent test' });
  },
  location(agent) {
    return agent.client.request('POST', '/api/driver/location', { latitude: 22.72, longitude: 75.86 });
  },
  earnings(agent) {
    return agent.client.request('GET', '/api/driver/earnings');
  },
  history(agent) {
    return agent.client.request('GET', '/api/driver/rides/history');
  },
};
