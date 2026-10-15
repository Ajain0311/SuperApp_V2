export const adminActions = {
  dashboard(agent) {
    return agent.client.request('GET', '/api/admin/dashboard');
  },
  users(agent) {
    return agent.client.request('GET', '/api/admin/users');
  },
  assignRole(agent, userId, roleName, restaurantId) {
    return agent.client.request('POST', '/api/admin/users', {
      action: 'ROLE',
      userId,
      roleName,
      restaurantId,
    });
  },
  addRestaurant(agent, name) {
    return agent.client.request('POST', '/api/admin/restaurants', {
      action: 'ADD',
      name,
      city: 'Indore',
      description: 'Agent framework restaurant',
      minOrderAmount: 0,
      deliveryFee: 0,
    });
  },
  drivers(agent) {
    return agent.client.request('GET', '/api/admin/drivers');
  },
  verifyDriver(agent, driverId) {
    return agent.client.request('POST', '/api/admin/drivers', { action: 'VERIFY', driverId, isVerified: true });
  },
  foodOrders(agent) {
    return agent.client.request('GET', '/api/admin/food-orders');
  },
  rides(agent) {
    return agent.client.request('GET', '/api/admin/rides');
  },
  listings(agent) {
    return agent.client.request('GET', '/api/admin/marketplace/listings');
  },
  settings(agent) {
    return agent.client.request('GET', '/api/admin/settings');
  },
  reports(agent) {
    return agent.client.request('GET', '/api/admin/reports');
  },
  broadcast(agent, runId) {
    return agent.client.request('POST', '/api/admin/notifications/broadcast', {
      title: `Agent ${runId}`,
      message: 'Framework broadcast',
    });
  },
};
