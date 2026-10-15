export const ownerActions = {
  orders(agent, restaurantId) {
    const q = restaurantId ? `?restaurantId=${restaurantId}` : '';
    return agent.client.request('GET', `/api/vendor/orders${q}`);
  },
  setStatus(agent, orderId, status) {
    return agent.client.request('PUT', `/api/vendor/orders/${orderId}/status`, { status });
  },
  menu(agent) {
    return agent.client.request('GET', '/api/vendor/menu');
  },
};
