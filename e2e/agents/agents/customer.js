/** Customer actions against the live SuperApp API. */
export const customerActions = {
  async listRestaurants(agent) {
    return agent.client.request('GET', '/api/restaurants?page=1&pageSize=20');
  },
  async restaurantDetail(agent, id) {
    return agent.client.request('GET', `/api/restaurants/${id}`);
  },
  async createAddress(agent, runId) {
    return agent.client.request('POST', '/api/Addresses', {
      label: 'Home',
      addressLine1: `${runId} Test Lane`,
      city: 'Indore',
      state: 'Madhya Pradesh',
      pinCode: '452001',
      latitude: 22.7196,
      longitude: 75.8577,
      isDefault: true,
    });
  },
  async placeOrder(agent, { restaurantId, foodItemId, addressId, notes }) {
    return agent.client.request('POST', '/api/FoodOrders', {
      restaurantId,
      addressId,
      paymentMethod: 'COD',
      notes,
      items: [{ foodItemId, quantity: 1 }],
    });
  },
  async myOrders(agent) {
    return agent.client.request('GET', '/api/FoodOrders/my-orders');
  },
  async getOrder(agent, id) {
    return agent.client.request('GET', `/api/FoodOrders/${id}`);
  },
  async bookRide(agent, notes) {
    return agent.client.request('POST', '/api/rides/book', {
      vehicleType: 'BIKE',
      pickupAddress: `${notes} pickup`,
      pickupLatitude: 22.7196,
      pickupLongitude: 75.8577,
      dropoffAddress: `${notes} drop`,
      dropoffLatitude: 22.7533,
      dropoffLongitude: 75.8937,
      paymentMethod: 'CASH',
    });
  },
  async getRide(agent, id) {
    return agent.client.request('GET', `/api/rides/${id}`);
  },
};
