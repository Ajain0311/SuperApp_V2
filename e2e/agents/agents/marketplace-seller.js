export const sellerActions = {
  categories(agent) {
    return agent.client.request('GET', '/api/marketplace/categories');
  },
  add(agent, body) {
    return agent.client.request('POST', '/api/marketplace/listings', { action: 'ADD', ...body });
  },
  edit(agent, id, title) {
    return agent.client.request('POST', '/api/marketplace/listings', { action: 'EDIT', id, title });
  },
  status(agent, id, status) {
    return agent.client.request('POST', '/api/marketplace/listings', { action: 'STATUS', id, status });
  },
  remove(agent, id) {
    return agent.client.request('POST', '/api/marketplace/listings', { action: 'DELETE', id });
  },
  mine(agent) {
    return agent.client.request('GET', '/api/marketplace/my-listings');
  },
  favorite(agent, id) {
    return agent.client.request('POST', `/api/marketplace/favorites/${id}`);
  },
  report(agent, id) {
    return agent.client.request('POST', `/api/marketplace/listings/${id}/report`, { reason: 'TEST', details: 'agent framework' });
  },
};
