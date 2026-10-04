import { customerActions } from '../agents/customer.js';
import { ownerActions } from '../agents/restaurant-owner.js';
import { captainActions } from '../agents/captain.js';
import { sellerActions } from '../agents/marketplace-seller.js';
import { adminActions } from '../agents/admin.js';
import { dataOf, expectHttp, listOf, runParallel } from './scenario-runner.js';

export function blockIfLoggedOut(ctx, suite, scenario, agents) {
  const missing = agents.filter((agent) => agent?.login !== 'PASS');
  if (!missing.length) return false;
  const sample = missing[0];
  ctx.record(sample, {
    suite,
    scenario,
    endpoint: '',
    method: '',
    expected: 'authenticated agent',
    actual: missing.map((agent) => `${agent.id}:${agent.login}`).join(', '),
    status: 'BLOCKED',
    details: `Agent authentication failed; authenticated scenario was not executed. ${sample.authReason || ''}`.trim(),
  });
  return true;
}

function firstItem(detail) {
  const categories = detail?.categories || detail?.Categories || [];
  for (const cat of categories) {
    const items = cat.items || cat.Items || [];
    const hit = items.find((item) => item.isAvailable !== false && item.IsAvailable !== false);
    if (hit) return hit;
  }
  return null;
}

async function restaurantsWithMenu(agent) {
  const list = await customerActions.listRestaurants(agent);
  const items = listOf(list) || [];
  const ready = [];
  for (const row of items) {
    const detailRes = await customerActions.restaurantDetail(agent, row.id);
    const detail = dataOf(detailRes);
    const item = firstItem(detail);
    if (detailRes.status === 200 && item) ready.push({ restaurant: detail, item });
  }
  return { list, ready };
}

export async function runAuth(ctx) {
  const { agents, record } = ctx;
  await runParallel(agents.filter((a) => a.role !== 'ADMIN'), ctx.concurrency, ctx.thinkTimeMs, ctx.rampUpMs, async (agent) => {
    record(agent, {
      suite: 'AUTHENTICATION',
      scenario: 'citizen-login',
      endpoint: '/api/auth/verify-otp',
      method: 'POST',
      expected: 200,
      actual: agent.authMeta?.verifyStatus ?? agent.authMeta?.sendStatus ?? 0,
      status: agent.login === 'PASS' ? 'PASS' : agent.login === 'BLOCKED' ? 'BLOCKED' : 'FAIL',
      details: agent.login === 'PASS' ? 'JWT captured' : agent.authReason,
      latencyMs: 0,
    });
  });
  const admin = agents.find((a) => a.role === 'ADMIN');
  if (admin) {
    record(admin, {
      suite: 'AUTHENTICATION',
      scenario: 'admin-login',
      endpoint: '/api/auth/admin-login',
      method: 'POST',
      expected: 200,
      actual: admin.authMeta?.verifyStatus ?? 0,
      status: admin.login === 'PASS' ? 'PASS' : admin.login === 'FAIL' ? 'FAIL' : 'BLOCKED',
      details: admin.login === 'PASS' ? 'Admin JWT captured' : admin.authReason,
      latencyMs: 0,
    });
  }
}

async function placePair(ctx) {
  const customers = ctx.agents.filter((a) => a.role === 'CUSTOMER');
  const owners = ctx.agents.filter((a) => a.role === 'RESTAURANT_OWNER');
  if (customers.length < 2 || owners.length < 2) {
    ctx.record(null, {
      suite: 'FOOD_ORDER',
      scenario: 'provision-agents',
      endpoint: '',
      method: '',
      expected: '2 customers and 2 owners',
      actual: `${customers.length}/${owners.length}`,
      status: 'BLOCKED',
      details: 'Isolation needs at least two customers and two restaurant owners',
    });
    return null;
  }
  if (blockIfLoggedOut(ctx, 'FOOD_ORDER', 'place-cod-order', [customers[0], customers[1], owners[0], owners[1]])) return null;
  const probe = customers[0];
  const { ready } = await restaurantsWithMenu(probe);
  if (ready.length < 2) {
    ctx.record(probe, {
      suite: 'FOOD_ORDER',
      scenario: 'restaurants-with-menu',
      endpoint: '/api/restaurants',
      method: 'GET',
      expected: '>=2 restaurants with an available item',
      actual: ready.length,
      status: 'BLOCKED',
      details: 'Not enough seeded restaurants with menu items for owner isolation',
    });
    return null;
  }
  const admin = ctx.agents.find((a) => a.role === 'ADMIN' && a.login === 'PASS');
  for (let index = 0; index < 2; index++) {
    owners[index].resources.restaurantId = ready[index].restaurant.id;
    if (!admin) continue;
    const mapped = await adminActions.assignRole(admin, owners[index].user.id, 'RESTAURANT_OWNER', ready[index].restaurant.id);
    expectHttp(ctx.record, admin, {
      suite: 'RESTAURANT_OWNER',
      scenario: `map-owner-${index}`,
      endpoint: '/api/admin/users',
      method: 'POST',
      expected: 200,
      details: 'Admin binds the owner to a restaurant that has a menu',
    }, mapped);
  }
  const orders = await runParallel([0, 1], ctx.concurrency, ctx.thinkTimeMs, ctx.rampUpMs, async (index) => {
    const customer = customers[index];
    const menu = ready[index];
    const addressRes = await customerActions.createAddress(customer, ctx.runId);
    expectHttp(ctx.record, customer, {
      suite: 'FOOD_ORDER',
      scenario: 'create-address',
      endpoint: '/api/Addresses',
      method: 'POST',
      expected: 200,
      details: 'Saved delivery address',
    }, addressRes);
    const addressId = dataOf(addressRes)?.id;
    const orderRes = await customerActions.placeOrder(customer, {
      restaurantId: menu.restaurant.id,
      foodItemId: menu.item.id,
      addressId,
      notes: `${ctx.runId} customer ${customer.id}`,
    });
    expectHttp(ctx.record, customer, {
      suite: 'FOOD_ORDER',
      scenario: 'place-cod-order',
      endpoint: '/api/FoodOrders',
      method: 'POST',
      expected: 200,
      request: { restaurantId: menu.restaurant.id, paymentMethod: 'COD' },
      details: 'COD order placed',
    }, orderRes);
    const order = dataOf(orderRes);
    if (order?.id) customer.resources.orderIds.push(order.id);
    const pay = order?.paymentStatus || order?.PaymentStatus;
    ctx.record(customer, {
      suite: 'FOOD_ORDER',
      scenario: 'payment-status-cod',
      endpoint: '/api/FoodOrders',
      method: 'POST',
      expected: 'PENDING',
      actual: pay,
      status: pay === 'PENDING' ? 'PASS' : 'FAIL',
      details: 'COD orders start as PENDING payment',
      hint: 'PlaceOrder sets PENDING for COD and PENDING_PAYMENT for ONLINE',
      latencyMs: orderRes.latencyMs,
      res: orderRes,
    });
    return { customer, order, restaurantId: menu.restaurant.id };
  });
  return { customers, owners, orders };
}

export async function runFood(ctx) {
  const placed = await placePair(ctx);
  ctx.shared.food = placed;
  if (!placed) return;
  const { orders } = placed;
  await runParallel(orders, ctx.concurrency, ctx.thinkTimeMs, 0, async ({ customer, order }) => {
    if (!order?.id) return;
    const mine = await customerActions.myOrders(customer);
    const list = listOf(mine);
    const seen = Array.isArray(list) && list.some((row) => row.id === order.id);
    ctx.record(customer, {
      suite: 'FOOD_ORDER',
      scenario: 'order-in-my-orders',
      endpoint: '/api/FoodOrders/my-orders',
      method: 'GET',
      expected: true,
      actual: seen,
      status: mine.status === 200 && seen ? 'PASS' : 'FAIL',
      details: 'Own order is listed',
      latencyMs: mine.latencyMs,
      res: mine,
    });
    const detail = await customerActions.getOrder(customer, order.id);
    expectHttp(ctx.record, customer, {
      suite: 'FOOD_ORDER',
      scenario: 'get-order-details',
      endpoint: `/api/FoodOrders/${order.id}`,
      method: 'GET',
      expected: 200,
      details: 'Owner of the order can read it',
    }, detail);
  });
  await assertCustomerIsolation(ctx, orders);
}

async function assertCustomerIsolation(ctx, orders) {
  const [a, b] = orders;
  if (!a?.order?.id || !b?.order?.id) return;
  const pairs = [
    [b.customer, a.order.id, 'B-reads-A'],
    [a.customer, b.order.id, 'A-reads-B'],
  ];
  const matrix = [];
  for (const [actor, id, label] of pairs) {
    const res = await actor.client.request('GET', `/api/FoodOrders/${id}`);
    expectHttp(ctx.record, actor, {
      suite: 'DATA_ISOLATION',
      scenario: `cross-user-order-access-${label}`,
      endpoint: `/api/FoodOrders/${id}`,
      method: 'GET',
      expected: [403, 404],
      security: true,
      details: 'GetOrder returns Forbid when the caller is neither the customer, the restaurant owner, nor an admin',
      hint: 'FoodOrdersController.GetOrder',
    }, res);
    const mine = await customerActions.myOrders(actor);
    const mineRows = listOf(mine);
    const leaked = Array.isArray(mineRows) && mineRows.some((row) => row.id === id);
    ctx.record(actor, {
      suite: 'DATA_ISOLATION',
      scenario: `my-orders-hides-${label}`,
      endpoint: '/api/FoodOrders/my-orders',
      method: 'GET',
      expected: false,
      actual: leaked,
      status: leaked ? 'FAIL' : 'PASS',
      security: true,
      details: leaked ? 'Foreign order id appeared in my-orders' : 'Foreign order id absent from my-orders',
      latencyMs: mine.latencyMs,
    });
  }
  matrix.push({
    Resource: `Order ${a.order.id}`,
    'Customer A': 'ALLOW',
    'Customer B': 'DENY',
  });
  matrix.push({
    Resource: `Order ${b.order.id}`,
    'Customer A': 'DENY',
    'Customer B': 'ALLOW',
  });
  ctx.matrix.push(...matrix);
}

export async function runRestaurantIsolation(ctx) {
  const placed = ctx.shared.food || await placePair(ctx);
  ctx.shared.food = placed;
  if (!placed) return;
  const { owners, orders } = placed;
  await runParallel([0, 1], ctx.concurrency, 0, 0, async (index) => {
    const owner = owners[index];
    const own = orders[index];
    const other = orders[1 - index];
    const list = await ownerActions.orders(owner, owner.resources.restaurantId);
    const rows = listOf(list) || [];
    const seesOwn = list.status === 200 && rows.some((row) => row.id === own.order?.id);
    const seesOther = rows.some((row) => row.id === other.order?.id);
    ctx.record(owner, {
      suite: 'RESTAURANT_OWNER',
      scenario: 'sees-own-kitchen-order',
      endpoint: '/api/vendor/orders',
      method: 'GET',
      expected: true,
      actual: seesOwn,
      status: seesOwn ? 'PASS' : 'FAIL',
      details: 'Vendor orders are filtered to authorized restaurants',
      latencyMs: list.latencyMs,
    });
    ctx.record(owner, {
      suite: 'RESTAURANT_OWNER',
      scenario: 'hides-other-kitchen-order',
      endpoint: '/api/vendor/orders',
      method: 'GET',
      expected: false,
      actual: seesOther,
      status: seesOther ? 'FAIL' : 'PASS',
      security: true,
      details: seesOther ? 'Other restaurant order leaked into vendor list' : 'Other restaurant order absent',
      latencyMs: list.latencyMs,
    });
    if (own.order?.id) {
      const detail = await owner.client.request('GET', `/api/FoodOrders/${own.order.id}`);
      expectHttp(ctx.record, owner, {
        suite: 'RESTAURANT_OWNER',
        scenario: 'owner-reads-own-order',
        endpoint: `/api/FoodOrders/${own.order.id}`,
        method: 'GET',
        expected: 200,
        details: 'Restaurant user mapped to the order restaurant may read it',
      }, detail);
    }
    if (other.order?.id) {
      const denied = await ownerActions.setStatus(owner, other.order.id, 'ACCEPTED');
      expectHttp(ctx.record, owner, {
        suite: 'RESTAURANT_OWNER',
        scenario: 'cannot-update-other-order',
        endpoint: `/api/vendor/orders/${other.order.id}/status`,
        method: 'PUT',
        expected: [403, 404],
        security: true,
        details: 'UpdateOrderStatus returns Forbid when the order restaurant is not authorized',
      }, denied);
    }
  });
  const ownerA = owners[0];
  const orderA = orders[0].order;
  if (orderA?.id) {
    for (const status of ['ACCEPTED', 'PREPARING', 'READY']) {
      const res = await ownerActions.setStatus(ownerA, orderA.id, status);
      expectHttp(ctx.record, ownerA, {
        suite: 'RESTAURANT_OWNER',
        scenario: `lifecycle-${status}`,
        endpoint: `/api/vendor/orders/${orderA.id}/status`,
        method: 'PUT',
        expected: 200,
        request: { status },
        details: 'Kitchen transition on the owning restaurant',
      }, res);
    }
    const after = await customerActions.getOrder(orders[0].customer, orderA.id);
    const seen = dataOf(after)?.status;
    ctx.record(orders[0].customer, {
      suite: 'FOOD_ORDER',
      scenario: 'customer-sees-ready',
      endpoint: `/api/FoodOrders/${orderA.id}`,
      method: 'GET',
      expected: 'READY',
      actual: seen,
      status: seen === 'READY' ? 'PASS' : 'FAIL',
      details: 'Customer reads the kitchen status',
      latencyMs: after.latencyMs,
    });
  }
  ctx.matrix.push({
    Resource: `Order ${orders[0].order?.id}`,
    'Owner A': 'ALLOW',
    'Owner B': 'DENY',
    'Customer A': 'ALLOW',
    'Customer B': 'DENY',
  });
  ctx.matrix.push({
    Resource: `Order ${orders[1].order?.id}`,
    'Owner A': 'DENY',
    'Owner B': 'ALLOW',
    'Customer A': 'DENY',
    'Customer B': 'ALLOW',
  });
}

export async function runRides(ctx) {
  const customers = ctx.agents.filter((a) => a.role === 'CUSTOMER');
  const captains = ctx.agents.filter((a) => a.role === 'DRIVER');
  if (blockIfLoggedOut(ctx, 'RIDE_CAPTAIN', 'book-ride', [...customers.slice(0, 2), ...captains.slice(0, 2)])) return;
  if (customers.length < 1 || captains.length < 2) {
    ctx.record(null, {
      suite: 'RIDE_CAPTAIN',
      scenario: 'provision-captains',
      status: 'BLOCKED',
      expected: '2 captains',
      actual: captains.length,
      details: 'Ride isolation needs two captains',
    });
    return;
  }
  await runParallel(captains, ctx.concurrency, ctx.thinkTimeMs, ctx.rampUpMs, async (captain) => {
    const online = await captainActions.toggleOnline(captain);
    expectHttp(ctx.record, captain, {
      suite: 'RIDE_CAPTAIN',
      scenario: 'toggle-online',
      endpoint: '/api/driver/toggle-online',
      method: 'POST',
      expected: 200,
      details: 'Driver online toggle',
    }, online);
    const available = await captainActions.available(captain);
    expectHttp(ctx.record, captain, {
      suite: 'RIDE_CAPTAIN',
      scenario: 'available-rides',
      endpoint: '/api/driver/available-rides',
      method: 'GET',
      expected: 200,
      details: 'Available ride feed',
    }, available);
    const earnings = await captainActions.earnings(captain);
    expectHttp(ctx.record, captain, {
      suite: 'RIDE_CAPTAIN',
      scenario: 'earnings',
      endpoint: '/api/driver/earnings',
      method: 'GET',
      expected: 200,
      missingIs: 'NOT_IMPLEMENTED',
      details: 'Driver earnings',
    }, earnings);
    const history = await captainActions.history(captain);
    expectHttp(ctx.record, captain, {
      suite: 'RIDE_CAPTAIN',
      scenario: 'history',
      endpoint: '/api/driver/rides/history',
      method: 'GET',
      expected: 200,
      details: 'Driver history alias',
    }, history);
    const location = await captainActions.location(captain);
    expectHttp(ctx.record, captain, {
      suite: 'RIDE_CAPTAIN',
      scenario: 'location-update',
      endpoint: '/api/driver/location',
      method: 'POST',
      expected: 200,
      details: 'GPS update',
    }, location);
  });

  const booked = await runParallel([0, 1], ctx.concurrency, 0, 0, async (index) => {
    const customer = customers[index % customers.length];
    const res = await customerActions.bookRide(customer, `${ctx.runId}-${index}`);
    expectHttp(ctx.record, customer, {
      suite: 'RIDE_CAPTAIN',
      scenario: 'book-ride',
      endpoint: '/api/rides/book',
      method: 'POST',
      expected: 200,
      details: 'Customer books a BIKE ride',
    }, res);
    const ride = dataOf(res);
    if (ride?.id) customer.resources.rideIds.push(ride.id);
    return { customer, ride, captain: captains[index] };
  });

  const live = booked.filter((row) => row.ride?.id);
  if (live.length < 2) return;
  await runParallel(live, ctx.concurrency, 0, 0, async (row, index) => {
    const other = live[1 - index];
    const accepted = await captainActions.accept(row.captain, row.ride.id);
    expectHttp(ctx.record, row.captain, {
      suite: 'RIDE_CAPTAIN',
      scenario: 'accept-ride',
      endpoint: `/api/driver/rides/${row.ride.id}/accept`,
      method: 'POST',
      expected: 200,
      details: 'Assigned captain accepts',
    }, accepted);
    const steal = await captainActions.complete(other.captain, row.ride.id);
    expectHttp(ctx.record, other.captain, {
      suite: 'DATA_ISOLATION',
      scenario: 'captain-cannot-complete-other-ride',
      endpoint: `/api/driver/rides/${row.ride.id}/complete`,
      method: 'POST',
      expected: [403, 404],
      security: true,
      details: 'CompleteRide looks up ride by this driver id and returns 404 for another captain',
    }, steal);
    const startOther = await captainActions.start(other.captain, row.ride.id, row.ride.otpCode || '0000');
    expectHttp(ctx.record, other.captain, {
      suite: 'DATA_ISOLATION',
      scenario: 'captain-cannot-start-other-ride',
      endpoint: `/api/driver/rides/${row.ride.id}/start`,
      method: 'POST',
      expected: [403, 404],
      security: true,
      details: 'StartRide returns Forbid when DriverId does not match',
    }, startOther);
  });

  const primary = live[0];
  const arriving = await captainActions.arriving(primary.captain, primary.ride.id);
  expectHttp(ctx.record, primary.captain, {
    suite: 'RIDE_CAPTAIN',
    scenario: 'arriving',
    endpoint: `/api/driver/rides/${primary.ride.id}/arriving`,
    method: 'POST',
    expected: 200,
    details: 'Captain marks arriving',
  }, arriving);
  const started = await captainActions.start(primary.captain, primary.ride.id, primary.ride.otpCode);
  expectHttp(ctx.record, primary.captain, {
    suite: 'RIDE_CAPTAIN',
    scenario: 'start-with-otp',
    endpoint: `/api/driver/rides/${primary.ride.id}/start`,
    method: 'POST',
    expected: 200,
    details: 'OTP from the booking response starts the ride',
  }, started);
  const done = await captainActions.complete(primary.captain, primary.ride.id);
  expectHttp(ctx.record, primary.captain, {
    suite: 'RIDE_CAPTAIN',
    scenario: 'complete-ride',
    endpoint: `/api/driver/rides/${primary.ride.id}/complete`,
    method: 'POST',
    expected: 200,
    details: 'Captain completes own ride',
  }, done);

  const secondary = live[1];
  const cancel = await captainActions.cancel(secondary.captain, secondary.ride.id);
  expectHttp(ctx.record, secondary.captain, {
    suite: 'RIDE_CAPTAIN',
    scenario: 'cancel-own-ride',
    endpoint: `/api/driver/rides/${secondary.ride.id}/cancel`,
    method: 'POST',
    expected: 200,
    details: 'Captain cancels a ride they accepted',
  }, cancel);
  ctx.shared.rides = live;
}

export async function runMarketplace(ctx) {
  const sellers = ctx.agents.filter((a) => a.role === 'MARKETPLACE_SELLER');
  const customers = ctx.agents.filter((a) => a.role === 'CUSTOMER');
  if (blockIfLoggedOut(ctx, 'MARKETPLACE', 'create-listing', sellers.slice(0, 2))) return;
  if (sellers.length < 2) {
    ctx.record(null, {
      suite: 'MARKETPLACE',
      scenario: 'provision-sellers',
      status: 'BLOCKED',
      expected: 2,
      actual: sellers.length,
      details: 'Need two sellers',
    });
    return;
  }
  const cats = await sellerActions.categories(sellers[0]);
  const categories = listOf(cats);
  const categoryId = categories?.[0]?.id;
  if (!categoryId) {
    expectHttp(ctx.record, sellers[0], {
      suite: 'MARKETPLACE',
      scenario: 'categories',
      endpoint: '/api/marketplace/categories',
      method: 'GET',
      expected: 200,
      details: 'No marketplace category seeded',
    }, cats);
    return;
  }
  const created = await runParallel(sellers.slice(0, 2), ctx.concurrency, ctx.thinkTimeMs, ctx.rampUpMs, async (seller, index) => {
    const res = await sellerActions.add(seller, {
      categoryId,
      title: `${ctx.runId} listing ${seller.id}`,
      description: 'agent framework',
      price: 100 + index,
      condition: 'USED',
      location: 'Indore',
    });
    expectHttp(ctx.record, seller, {
      suite: 'MARKETPLACE',
      scenario: 'create-listing',
      endpoint: '/api/marketplace/listings',
      method: 'POST',
      expected: 200,
      details: 'Seller publishes a listing',
    }, res);
    const listing = dataOf(res);
    if (listing?.id) seller.resources.listingIds.push(listing.id);
    const mine = await sellerActions.mine(seller);
    const rows = listOf(mine);
    const seen = Array.isArray(rows) && rows.some((row) => row.id === listing?.id);
    ctx.record(seller, {
      suite: 'MARKETPLACE',
      scenario: 'view-my-listing',
      endpoint: '/api/marketplace/my-listings',
      method: 'GET',
      expected: true,
      actual: seen,
      status: seen ? 'PASS' : 'FAIL',
      details: 'Listing appears on the seller account',
      latencyMs: mine.latencyMs,
    });
    return { seller, listing };
  });
  const [a, b] = created;
  if (a?.listing?.id && b?.listing?.id) {
    const edit = await sellerActions.edit(b.seller, a.listing.id, 'stolen');
    expectHttp(ctx.record, b.seller, {
      suite: 'DATA_ISOLATION',
      scenario: 'seller-cannot-edit-other-listing',
      endpoint: '/api/marketplace/listings',
      method: 'POST',
      expected: [403, 404],
      security: true,
      request: { action: 'EDIT', id: a.listing.id },
      details: 'EDIT returns Forbid when UserId does not match and caller is not admin',
    }, edit);
    const renamed = await sellerActions.edit(a.seller, a.listing.id, `${ctx.runId} updated`);
    expectHttp(ctx.record, a.seller, {
      suite: 'MARKETPLACE',
      scenario: 'update-own-listing',
      endpoint: '/api/marketplace/listings',
      method: 'POST',
      expected: 200,
      details: 'Owner edits own listing',
    }, renamed);
    if (customers[0]) {
      const fav = await sellerActions.favorite(customers[0], a.listing.id);
      expectHttp(ctx.record, customers[0], {
        suite: 'MARKETPLACE',
        scenario: 'favorite',
        endpoint: `/api/marketplace/favorites/${a.listing.id}`,
        method: 'POST',
        expected: 200,
        details: 'Customer favorites a listing',
      }, fav);
      const report = await sellerActions.report(customers[0], a.listing.id);
      expectHttp(ctx.record, customers[0], {
        suite: 'MARKETPLACE',
        scenario: 'report',
        endpoint: `/api/marketplace/listings/${a.listing.id}/report`,
        method: 'POST',
        expected: [200, 400],
        details: 'Report endpoint exists; 400 is acceptable if reason validation rejects TEST',
      }, report);
    }
    const sold = await sellerActions.status(b.seller, b.listing.id, 'SOLD');
    expectHttp(ctx.record, b.seller, {
      suite: 'MARKETPLACE',
      scenario: 'mark-sold',
      endpoint: '/api/marketplace/listings',
      method: 'POST',
      expected: 200,
      details: 'STATUS action marks the listing sold',
    }, sold);
  }
  ctx.shared.listings = created;
}

export async function runAdmin(ctx) {
  const admin = ctx.agents.find((a) => a.role === 'ADMIN');
  const customer = ctx.agents.find((a) => a.role === 'CUSTOMER');
  if (!admin || admin.login !== 'PASS') {
    ctx.record(admin, {
      suite: 'ADMIN',
      scenario: 'admin-session',
      status: 'BLOCKED',
      expected: 'admin login',
      actual: admin?.login || 'missing',
      details: admin?.authReason || 'Admin password or OTP was not available',
    });
    return;
  }
  const calls = [
    ['dashboard', () => adminActions.dashboard(admin), 'GET', '/api/admin/dashboard'],
    ['users', () => adminActions.users(admin), 'GET', '/api/admin/users'],
    ['food-orders', () => adminActions.foodOrders(admin), 'GET', '/api/admin/food-orders'],
    ['rides', () => adminActions.rides(admin), 'GET', '/api/admin/rides'],
    ['marketplace', () => adminActions.listings(admin), 'GET', '/api/admin/marketplace/listings'],
    ['settings', () => adminActions.settings(admin), 'GET', '/api/admin/settings'],
    ['reports', () => adminActions.reports(admin), 'GET', '/api/admin/reports'],
  ];
  await runParallel(calls, ctx.concurrency, ctx.thinkTimeMs, ctx.rampUpMs, async ([name, run, method, endpoint]) => {
    const res = await run();
    expectHttp(ctx.record, admin, {
      suite: 'ADMIN',
      scenario: name,
      endpoint,
      method,
      expected: 200,
      details: 'Admin role can read the endpoint',
    }, res);
  });
  const broadcast = await admin.client.request('POST', '/api/admin/notifications/broadcast', {
    title: ctx.runId,
    message: 'agent framework',
    targetRole: 'CUSTOMER',
  });
  expectHttp(ctx.record, admin, {
    suite: 'ADMIN',
    scenario: 'broadcast',
    endpoint: '/api/admin/notifications/broadcast',
    method: 'POST',
    expected: 200,
    details: 'BroadcastNotificationRequest uses message, not body',
  }, broadcast);
  if (customer?.login === 'PASS') {
    const denied = await customer.client.request('GET', '/api/admin/dashboard');
    expectHttp(ctx.record, customer, {
      suite: 'SECURITY',
      scenario: 'customer-rejected-from-admin',
      endpoint: '/api/admin/dashboard',
      method: 'GET',
      expected: 403,
      security: true,
      details: 'AdminController requires the ADMIN role',
    }, denied);
  }
}

export async function runSecurity(ctx) {
  const customer = ctx.agents.find((a) => a.role === 'CUSTOMER');
  if (!customer) return;
  const anon = customer.client.request.bind(customer.client);
  const noToken = await customer.client.request('GET', '/api/FoodOrders/my-orders', undefined, { token: null });
  // token:null still falls through because bearer check is `if (bearer)`. Passing empty string.
  const bare = await customer.client.request('GET', '/api/FoodOrders/my-orders', undefined, { token: '' });
  expectHttp(ctx.record, customer, {
    suite: 'SECURITY',
    scenario: 'no-token',
    endpoint: '/api/FoodOrders/my-orders',
    method: 'GET',
    expected: 401,
    security: true,
    details: 'Missing bearer token',
  }, bare.status === 401 ? bare : noToken);
  const bad = await customer.client.request('GET', '/api/FoodOrders/my-orders', undefined, { token: 'not-a-jwt' });
  expectHttp(ctx.record, customer, {
    suite: 'SECURITY',
    scenario: 'malformed-bearer',
    endpoint: '/api/FoodOrders/my-orders',
    method: 'GET',
    expected: 401,
    security: true,
    details: 'Malformed bearer token',
  }, bad);
  const invalid = await customer.client.request('GET', '/api/FoodOrders/my-orders', undefined, {
    token: 'eyJhbGciOiJub25lIn0.eyJzdWIiOiIxIn0.sig',
  });
  expectHttp(ctx.record, customer, {
    suite: 'SECURITY',
    scenario: 'invalid-token',
    endpoint: '/api/FoodOrders/my-orders',
    method: 'GET',
    expected: 401,
    security: true,
    details: 'Token that is not signed by this API',
  }, invalid);
  ctx.record(customer, {
    suite: 'SECURITY',
    scenario: 'expired-token',
    endpoint: '/api/FoodOrders/my-orders',
    method: 'GET',
    expected: 401,
    actual: 'NOT_IMPLEMENTED',
    status: 'NOT_IMPLEMENTED',
    details: 'Minting an expired JWT requires the server signing key, which this framework does not store',
  });
  if (customer.login !== 'PASS') {
    ctx.record(customer, {
      suite: 'SECURITY',
      scenario: 'role-boundary',
      status: 'BLOCKED',
      expected: 'authenticated customer',
      actual: customer.login,
      details: 'Agent authentication failed; authenticated scenario was not executed.',
    });
    return;
  }
  const driverDenied = await customer.client.request('GET', '/api/driver/available-rides');
  expectHttp(ctx.record, customer, {
    suite: 'SECURITY',
    scenario: 'customer-rejected-from-driver',
    endpoint: '/api/driver/available-rides',
    method: 'GET',
    expected: 403,
    security: true,
    details: 'GetAuthorizedDriverAsync returns null and the action returns Forbid',
  }, driverDenied);
  const vendorDenied = await customer.client.request('GET', '/api/vendor/orders');
  expectHttp(ctx.record, customer, {
    suite: 'SECURITY',
    scenario: 'customer-rejected-from-vendor',
    endpoint: '/api/vendor/orders',
    method: 'GET',
    expected: 403,
    security: true,
    details: 'Vendor orders require a restaurant mapping',
  }, vendorDenied);
  const tamper = await customer.client.request('GET', '/api/FoodOrders/999999999');
  expectHttp(ctx.record, customer, {
    suite: 'SECURITY',
    scenario: 'unknown-order-id',
    endpoint: '/api/FoodOrders/999999999',
    method: 'GET',
    expected: [403, 404],
    security: true,
    details: 'Unknown id is NotFound before the owner check',
  }, tamper);
  void anon;
}

export async function cleanupRun(ctx) {
  if (!ctx.cleanup) return;
  for (const agent of ctx.agents) {
    for (const id of agent.resources.orderIds) {
      await agent.client.request('POST', `/api/FoodOrders/${id}/cancel`);
    }
    for (const id of agent.resources.listingIds) {
      await agent.client.request('POST', '/api/marketplace/listings', { action: 'DELETE', id });
    }
  }
}

export const FLOW_NAMES = {
  auth: runAuth,
  'food-order': runFood,
  'restaurant-isolation': runRestaurantIsolation,
  ride: runRides,
  marketplace: runMarketplace,
  authorization: runSecurity,
  admin: runAdmin,
  security: runSecurity,
};
