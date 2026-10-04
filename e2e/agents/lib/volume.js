import { customerActions } from '../agents/customer.js';
import { ownerActions } from '../agents/restaurant-owner.js';
import { captainActions } from '../agents/captain.js';
import { sellerActions } from '../agents/marketplace-seller.js';
import { dataOf, expectHttp, listOf, runParallel } from './scenario-runner.js';
import { blockIfLoggedOut } from './flows.js';
import { countWhere } from './db-verifier.js';

function logged(agents) {
  return agents.filter((agent) => agent.login === 'PASS');
}

function recordDb(ctx, agent, scenario, ok, details, latencyMs) {
  ctx.record(agent, {
    suite: 'DATABASE',
    scenario,
    endpoint: 'postgres',
    method: 'SELECT',
    expected: true,
    actual: ok,
    status: ok ? 'PASS' : 'FAIL',
    details,
    latencyMs: latencyMs || 0,
  });
  ctx.dbStats ??= { created: {}, verified: 0, mismatch: 0, orphan: 0 };
  if (ok) ctx.dbStats.verified += 1;
  else ctx.dbStats.mismatch += 1;
}

async function menus(agent) {
  const list = await customerActions.listRestaurants(agent);
  const rows = listOf(list) || [];
  const ready = [];
  for (const row of rows) {
    const detailRes = await customerActions.restaurantDetail(agent, row.id);
    const detail = dataOf(detailRes);
    const categories = detail?.categories || detail?.Categories || [];
    let item = null;
    for (const category of categories) {
      item = (category.items || category.Items || []).find((entry) => entry.isAvailable !== false);
      if (item) break;
    }
    if (detailRes.status === 200 && item) ready.push({ restaurant: detail, item });
  }
  return ready;
}

export async function runScaled(ctx, selected) {
  const wantFood = selected.includes('food-order') || selected.includes('restaurant-isolation');
  const wantRide = selected.includes('ride');
  const wantMarket = selected.includes('marketplace');
  if (wantFood) await scaleFood(ctx);
  if (wantRide) await scaleRides(ctx);
  if (wantMarket) await scaleMarket(ctx);
  await consistency(ctx);
}

async function scaleFood(ctx) {
  const customers = logged(ctx.agents.filter((agent) => agent.role === 'CUSTOMER'));
  const owners = logged(ctx.agents.filter((agent) => agent.role === 'RESTAURANT_OWNER'));
  if (customers.length < 2 || owners.length < 1) {
    blockIfLoggedOut(ctx, 'FOOD_ORDER', 'scaled-orders', ctx.agents.filter((agent) => agent.role === 'CUSTOMER').slice(0, 2));
    return;
  }
  const ready = await menus(customers[0]);
  if (!ready.length) {
    ctx.record(customers[0], { suite: 'FOOD_ORDER', scenario: 'restaurants-with-menu', status: 'BLOCKED', expected: 'menu', actual: 0, details: 'No restaurant with an available item' });
    return;
  }
  const admin = ctx.agents.find((agent) => agent.role === 'ADMIN' && agent.login === 'PASS');
  const kitchen = owners.slice(0, ready.length);
  for (const extra of owners.slice(ready.length)) {
    ctx.record(extra, { suite: 'RESTAURANT_OWNER', scenario: 'no-menu-restaurant', status: 'BLOCKED', expected: 'restaurant with a menu', actual: ready.length, details: 'Not enough seeded restaurants with an available item to map this owner. No restaurant was invented.' });
  }
  for (let index = 0; index < kitchen.length; index++) {
    kitchen[index].resources.restaurantId = ready[index].restaurant.id;
    if (admin) await admin.client.request('POST', '/api/admin/users', { action: 'ROLE', userId: kitchen[index].user.id, roleName: 'RESTAURANT_OWNER', restaurantId: ready[index].restaurant.id });
  }
  const before = ctx.db?.ok ? await countWhere(ctx.db, 'food_orders', 'notes', ctx.runId) : null;
  const placed = await runParallel(customers, ctx.concurrency, ctx.thinkTimeMs, ctx.rampUpMs, async (customer, index) => {
    const menu = ready[index % ready.length];
    const addressRes = await customerActions.createAddress(customer, `${ctx.runId}-${customer.id}`);
    expectHttp(ctx.record, customer, { suite: 'FOOD_ORDER', scenario: 'create-address', endpoint: '/api/Addresses', method: 'POST', expected: 200, details: 'Address saved' }, addressRes);
    const address = dataOf(addressRes);
    if (!address?.id) return null;
    const updated = await customer.client.request('PUT', `/api/Addresses/${address.id}`, {
      label: 'Work', addressLine1: `${ctx.runId} updated ${customer.id}`, city: 'Indore', state: 'Madhya Pradesh', pinCode: '452010', latitude: 22.72, longitude: 75.86, isDefault: true,
    });
    expectHttp(ctx.record, customer, { suite: 'FOOD_ORDER', scenario: 'update-address', endpoint: `/api/Addresses/${address.id}`, method: 'PUT', expected: 200, details: 'Address updated and set default' }, updated);
    const orderRes = await customerActions.placeOrder(customer, {
      restaurantId: menu.restaurant.id, foodItemId: menu.item.id, addressId: address.id, notes: `${ctx.runId} ${customer.id}`,
    });
    expectHttp(ctx.record, customer, { suite: 'FOOD_ORDER', scenario: 'place-cod-order', endpoint: '/api/FoodOrders', method: 'POST', expected: 200, details: 'COD order' }, orderRes);
    const order = dataOf(orderRes);
    if (order?.id) {
      customer.resources.orderIds.push(order.id);
      customer.resources.addressId = address.id;
      customer.resources.restaurantId = menu.restaurant.id;
    }
    return order?.id ? { customer, order, address } : null;
  });
  const orders = placed.filter(Boolean);
  ctx.shared.orders = orders;
  if (ctx.db?.ok) await verifyFood(ctx, orders, before);
  await isolationFood(ctx, orders, kitchen);
}

async function verifyFood(ctx, orders, before) {
  const after = await countWhere(ctx.db, 'food_orders', 'notes', ctx.runId);
  recordDb(ctx, null, 'food-order-count', after === before + orders.length, `before ${before} created ${orders.length} after ${after}`);
  ctx.concurrencyStats ??= [];
  ctx.concurrencyStats.push({ scenario: 'place-orders', agents: orders.length, operations: orders.length, expected: orders.length, actual: after - before, result: after - before === orders.length ? 'PASS' : 'FAIL' });
  await runParallel(orders, ctx.concurrency, 0, 0, async ({ customer, order }) => {
    const row = await ctx.db.query('select user_id, restaurant_id, status, payment_method, payment_status, grand_total, notes from food_orders where id = $1', [order.id]);
    const db = row.rows[0];
    const ok = db && Number(db.user_id) === Number(customer.user.id) && Number(db.restaurant_id) === Number(customer.resources.restaurantId) && db.payment_method === 'COD' && db.payment_status === 'PENDING' && db.status === 'PENDING' && Number(db.grand_total) >= 0 && String(db.notes).includes(ctx.runId);
    recordDb(ctx, customer, 'food-order-row', ok, ok ? `order ${order.id} matches customer ${customer.user.id}` : `API id ${order.id} DB ${JSON.stringify(db)}`);
    const address = await ctx.db.query('select user_id, city, state, pin_code, latitude, is_default from addresses where id = $1', [customer.resources.addressId]);
    const addr = address.rows[0];
    const addrOk = addr && Number(addr.user_id) === Number(customer.user.id) && addr.city === 'Indore' && addr.pin_code === '452010' && addr.is_default === true && addr.latitude != null;
    recordDb(ctx, customer, 'address-row', addrOk, addrOk ? `address ${customer.resources.addressId}` : `API address vs DB ${JSON.stringify(addr)}`);
    const user = await ctx.db.query(`select u.is_active, r.name as role from users u left join user_roles ur on ur.user_id = u.id left join roles r on r.id = ur.role_id where u.id = $1`, [customer.user.id]);
    const active = user.rows.some((entry) => entry.is_active === true);
    recordDb(ctx, customer, 'user-row', active, active ? 'user active' : 'user missing or inactive');
  });
}

async function isolationFood(ctx, orders, kitchen) {
  if (orders.length < 2) return;
  await runParallel(orders, ctx.concurrency, 0, 0, async (entry, index) => {
    const other = orders[(index + 1) % orders.length];
    const res = await entry.customer.client.request('GET', `/api/FoodOrders/${other.order.id}`);
    expectHttp(ctx.record, entry.customer, { suite: 'DATA_ISOLATION', scenario: 'customer-foreign-order', endpoint: `/api/FoodOrders/${other.order.id}`, method: 'GET', expected: [403, 404], security: true, details: 'Another customer order is denied' }, res);
    ctx.matrix.push({ Resource: `Order ${entry.order.id}`, Owner: entry.customer.id, Observer: other.customer.id, Result: [403, 404].includes(res.status) ? 'DENY' : `LEAK ${res.status}` });
  });
  if (kitchen.length < 2) return;
  const byRestaurant = new Map();
  for (const entry of orders) {
    const list = byRestaurant.get(entry.customer.resources.restaurantId) || [];
    list.push(entry);
    byRestaurant.set(entry.customer.resources.restaurantId, list);
  }
  for (const owner of kitchen) {
    const own = (byRestaurant.get(owner.resources.restaurantId) || [])[0];
    const foreign = orders.find((entry) => entry.customer.resources.restaurantId !== owner.resources.restaurantId);
    if (!own || !foreign) continue;
    const list = await ownerActions.orders(owner, owner.resources.restaurantId);
    const rows = listOf(list) || [];
    const seesOwn = rows.some((row) => row.id === own.order.id);
    const seesForeign = rows.some((row) => row.id === foreign.order.id);
    ctx.record(owner, { suite: 'RESTAURANT_OWNER', scenario: 'sees-own-order', endpoint: '/api/vendor/orders', method: 'GET', expected: true, actual: seesOwn, status: seesOwn ? 'PASS' : 'FAIL', details: 'Own restaurant order is listed', latencyMs: list.latencyMs });
    ctx.record(owner, { suite: 'DATA_ISOLATION', scenario: 'hides-other-restaurant', endpoint: '/api/vendor/orders', method: 'GET', expected: false, actual: seesForeign, status: seesForeign ? 'FAIL' : 'PASS', security: true, details: 'Other restaurant order is absent' });
    const denied = await ownerActions.setStatus(owner, foreign.order.id, 'ACCEPTED');
    expectHttp(ctx.record, owner, { suite: 'DATA_ISOLATION', scenario: 'cannot-update-other-order', endpoint: `/api/vendor/orders/${foreign.order.id}/status`, method: 'PUT', expected: [403, 404], security: true, details: 'Cross-restaurant status update denied' }, denied);
  }
  const primary = orders[0];
  const owner = kitchen.find((entry) => entry.resources.restaurantId === primary.customer.resources.restaurantId);
  if (!owner) return;
  const before = ctx.db?.ok ? (await ctx.db.query('select updated_at from food_orders where id = $1', [primary.order.id])).rows[0] : null;
  const accepted = await ownerActions.setStatus(owner, primary.order.id, 'ACCEPTED');
  expectHttp(ctx.record, owner, { suite: 'RESTAURANT_OWNER', scenario: 'lifecycle-ACCEPTED', endpoint: `/api/vendor/orders/${primary.order.id}/status`, method: 'PUT', expected: 200, details: 'Owner accepts own order' }, accepted);
  if (ctx.db?.ok) {
    const after = (await ctx.db.query('select status, user_id, restaurant_id, updated_at from food_orders where id = $1', [primary.order.id])).rows[0];
    const ok = after?.status === 'ACCEPTED' && Number(after.user_id) === Number(primary.customer.user.id) && String(after.updated_at) !== String(before?.updated_at);
    recordDb(ctx, owner, 'order-status-persisted', ok, ok ? 'ACCEPTED persisted' : `DB ${JSON.stringify(after)}`);
  }
}

async function scaleRides(ctx) {
  const customers = logged(ctx.agents.filter((agent) => agent.role === 'CUSTOMER'));
  const captains = logged(ctx.agents.filter((agent) => agent.role === 'DRIVER'));
  if (!customers.length || captains.length < 2) {
    blockIfLoggedOut(ctx, 'RIDE_CAPTAIN', 'scaled-rides', captains);
    return;
  }
  await runParallel(captains, ctx.concurrency, ctx.thinkTimeMs, ctx.rampUpMs, async (captain) => {
    const online = await captainActions.toggleOnline(captain, true);
    expectHttp(ctx.record, captain, { suite: 'RIDE_CAPTAIN', scenario: 'toggle-online', endpoint: '/api/driver/toggle-online', method: 'POST', expected: 200, details: 'Online' }, online);
    const location = await captainActions.location(captain);
    expectHttp(ctx.record, captain, { suite: 'RIDE_CAPTAIN', scenario: 'location-update', endpoint: '/api/driver/location', method: 'POST', expected: 200, details: 'Location' }, location);
  });
  const pairs = customers.slice(0, captains.length);
  const before = ctx.db?.ok ? await countWhere(ctx.db, 'rides', 'pickup_address', ctx.runId) : null;
  const booked = await runParallel(pairs, ctx.concurrency, 0, ctx.rampUpMs, async (customer, index) => {
    const res = await customerActions.bookRide(customer, `${ctx.runId}-${customer.id}`);
    expectHttp(ctx.record, customer, { suite: 'RIDE_CAPTAIN', scenario: 'book-ride', endpoint: '/api/rides/book', method: 'POST', expected: 200, details: 'Ride booked' }, res);
    const ride = dataOf(res);
    if (ride?.id) customer.resources.rideIds.push(ride.id);
    return ride?.id ? { customer, ride, captain: captains[index] } : null;
  });
  const rides = booked.filter(Boolean);
  ctx.shared.rides = rides;
  if (ctx.db?.ok && before != null) {
    const after = await countWhere(ctx.db, 'rides', 'pickup_address', ctx.runId);
    recordDb(ctx, null, 'ride-count', after === before + rides.length, `before ${before} created ${rides.length} after ${after}`);
    ctx.concurrencyStats.push({ scenario: 'book-rides', agents: rides.length, operations: rides.length, expected: rides.length, actual: after - before, result: after - before === rides.length ? 'PASS' : 'FAIL' });
    for (const entry of rides) {
      const row = (await ctx.db.query('select user_id, status, pickup_latitude, dropoff_latitude, estimated_fare, driver_id from rides where id = $1', [entry.ride.id])).rows[0];
      const ok = row && Number(row.user_id) === Number(entry.customer.user.id) && row.driver_id == null && row.pickup_latitude != null && row.dropoff_latitude != null;
      recordDb(ctx, entry.customer, 'ride-row', ok, ok ? `ride ${entry.ride.id} ${row.status}` : `DB ${JSON.stringify(row)}`);
    }
  }
  await runParallel(rides, ctx.concurrency, 0, 0, async (entry, index) => {
    const accepted = await captainActions.accept(entry.captain, entry.ride.id);
    expectHttp(ctx.record, entry.captain, { suite: 'RIDE_CAPTAIN', scenario: 'accept-ride', endpoint: `/api/driver/rides/${entry.ride.id}/accept`, method: 'POST', expected: 200, details: 'Accept' }, accepted);
    const other = rides[(index + 1) % rides.length];
    if (other && other.captain.id !== entry.captain.id) {
      const steal = await captainActions.complete(other.captain, entry.ride.id);
      expectHttp(ctx.record, other.captain, { suite: 'DATA_ISOLATION', scenario: 'captain-foreign-complete', endpoint: `/api/driver/rides/${entry.ride.id}/complete`, method: 'POST', expected: [403, 404], security: true, details: 'Other captain cannot complete' }, steal);
    }
  });
  const primary = rides[0];
  if (!primary) return;
  const started = await captainActions.start(primary.captain, primary.ride.id, primary.ride.otpCode);
  expectHttp(ctx.record, primary.captain, { suite: 'RIDE_CAPTAIN', scenario: 'start-with-otp', endpoint: `/api/driver/rides/${primary.ride.id}/start`, method: 'POST', expected: 200, details: 'Start' }, started);
  const done = await captainActions.complete(primary.captain, primary.ride.id);
  expectHttp(ctx.record, primary.captain, { suite: 'RIDE_CAPTAIN', scenario: 'complete-ride', endpoint: `/api/driver/rides/${primary.ride.id}/complete`, method: 'POST', expected: 200, details: 'Complete' }, done);
  if (ctx.db?.ok) {
    const row = (await ctx.db.query('select status, driver_id, user_id from rides where id = $1', [primary.ride.id])).rows[0];
    const ok = row?.status === 'COMPLETED' && Number(row.driver_id) === Number(primary.captain.resources.driverId) && Number(row.user_id) === Number(primary.customer.user.id);
    recordDb(ctx, primary.captain, 'ride-completed-row', ok, ok ? 'completed row matches captain' : `DB ${JSON.stringify(row)} driver ${primary.captain.resources.driverId}`);
  }
  if (rides[1]) {
    const cancel = await captainActions.cancel(rides[1].captain, rides[1].ride.id);
    expectHttp(ctx.record, rides[1].captain, { suite: 'RIDE_CAPTAIN', scenario: 'cancel-own-ride', endpoint: `/api/driver/rides/${rides[1].ride.id}/cancel`, method: 'POST', expected: 200, details: 'Cancel second ride' }, cancel);
  }
  const offline = await captainActions.toggleOnline(captains[captains.length - 1], false);
  expectHttp(ctx.record, captains[captains.length - 1], { suite: 'RIDE_CAPTAIN', scenario: 'toggle-offline', endpoint: '/api/driver/toggle-online', method: 'POST', expected: 200, details: 'Offline' }, offline);
}

async function scaleMarket(ctx) {
  const sellers = logged(ctx.agents.filter((agent) => agent.role === 'MARKETPLACE_SELLER'));
  const customers = logged(ctx.agents.filter((agent) => agent.role === 'CUSTOMER'));
  if (sellers.length < 2) {
    blockIfLoggedOut(ctx, 'MARKETPLACE', 'scaled-listings', sellers);
    return;
  }
  const categories = listOf(await sellerActions.categories(sellers[0]));
  const categoryId = categories?.[0]?.id;
  if (!categoryId) {
    ctx.record(sellers[0], { suite: 'MARKETPLACE', scenario: 'categories', status: 'BLOCKED', expected: 'category', actual: 0, details: 'No marketplace category' });
    return;
  }
  const before = ctx.db?.ok ? await countWhere(ctx.db, 'marketplace_listings', 'title', ctx.runId) : null;
  const created = await runParallel(sellers, ctx.concurrency, ctx.thinkTimeMs, ctx.rampUpMs, async (seller) => {
    const res = await sellerActions.add(seller, { categoryId, title: `${ctx.runId} ${seller.id}`, description: 'volume', price: 120, condition: 'USED', location: 'Indore' });
    expectHttp(ctx.record, seller, { suite: 'MARKETPLACE', scenario: 'create-listing', endpoint: '/api/marketplace/listings', method: 'POST', expected: 200, details: 'Listing created' }, res);
    const listing = dataOf(res);
    if (listing?.id) seller.resources.listingIds.push(listing.id);
    return listing?.id ? { seller, listing, categoryId } : null;
  });
  const listings = created.filter(Boolean);
  ctx.shared.listings = listings;
  if (ctx.db?.ok && before != null) {
    const after = await countWhere(ctx.db, 'marketplace_listings', 'title', ctx.runId);
    recordDb(ctx, null, 'listing-count', after === before + listings.length, `before ${before} created ${listings.length} after ${after}`);
    ctx.concurrencyStats.push({ scenario: 'create-listings', agents: listings.length, operations: listings.length, expected: listings.length, actual: after - before, result: after - before === listings.length ? 'PASS' : 'FAIL' });
  }
  await runParallel(listings, ctx.concurrency, 0, 0, async (entry, index) => {
    const other = listings[(index + 1) % listings.length];
    const denied = await sellerActions.edit(other.seller, entry.listing.id, 'stolen');
    expectHttp(ctx.record, other.seller, { suite: 'DATA_ISOLATION', scenario: 'seller-foreign-edit', endpoint: '/api/marketplace/listings', method: 'POST', expected: [403, 404], security: true, details: 'Other seller cannot edit' }, denied);
    const edited = await sellerActions.edit(entry.seller, entry.listing.id, `${ctx.runId} edited ${entry.seller.id}`);
    expectHttp(ctx.record, entry.seller, { suite: 'MARKETPLACE', scenario: 'edit-own-listing', endpoint: '/api/marketplace/listings', method: 'POST', expected: 200, details: 'Own edit' }, edited);
    if (ctx.db?.ok) {
      const row = (await ctx.db.query('select user_id, title, price, status, is_active, category_id from marketplace_listings where id = $1', [entry.listing.id])).rows[0];
      const ok = row && Number(row.user_id) === Number(entry.seller.user.id) && String(row.title).includes('edited') && Number(row.category_id) === Number(categoryId) && row.is_active === true;
      recordDb(ctx, entry.seller, 'listing-row', ok, ok ? `listing ${entry.listing.id}` : `DB ${JSON.stringify(row)}`);
    }
  });
  if (customers[0] && listings[0]) {
    const fav = await sellerActions.favorite(customers[0], listings[0].listing.id);
    expectHttp(ctx.record, customers[0], { suite: 'MARKETPLACE', scenario: 'favorite', endpoint: `/api/marketplace/favorites/${listings[0].listing.id}`, method: 'POST', expected: 200, details: 'Favorite' }, fav);
  }
  const removed = listings[0];
  if (removed) {
    const del = await sellerActions.remove(removed.seller, removed.listing.id);
    expectHttp(ctx.record, removed.seller, { suite: 'MARKETPLACE', scenario: 'delete-own-listing', endpoint: '/api/marketplace/listings', method: 'POST', expected: 200, details: 'Removed' }, del);
    if (ctx.db?.ok) {
      const row = (await ctx.db.query('select is_active, status from marketplace_listings where id = $1', [removed.listing.id])).rows[0];
      const ok = row && row.is_active === false;
      recordDb(ctx, removed.seller, 'listing-removed', ok, ok ? `status ${row.status}` : `DB ${JSON.stringify(row)}`);
    }
  }
}

async function consistency(ctx) {
  if (!ctx.db?.ok) {
    ctx.record(null, { suite: 'DATABASE', scenario: 'connection', status: 'BLOCKED', expected: 'postgres', actual: ctx.db?.reason || 'unavailable', details: 'DB verifier did not connect. HTTP results were not treated as DB proof.' });
    return;
  }
  const orders = await ctx.db.query(`select count(*)::int as n from food_orders o left join users u on u.id = o.user_id left join restaurants r on r.id = o.restaurant_id where o.notes like $1 and (u.id is null or r.id is null or o.grand_total < 0)`, [`%${ctx.runId}%`]);
  const rides = await ctx.db.query(`select count(*)::int as n from rides d left join users u on u.id = d.user_id where d.pickup_address like $1 and u.id is null`, [`%${ctx.runId}%`]);
  const listings = await ctx.db.query(`select count(*)::int as n from marketplace_listings l left join users u on u.id = l.user_id where l.title like $1 and u.id is null`, [`%${ctx.runId}%`]);
  const orphan = orders.rows[0].n + rides.rows[0].n + listings.rows[0].n;
  ctx.dbStats.orphan += orphan;
  recordDb(ctx, null, 'consistency', orphan === 0, `orphan or invalid rows ${orphan}`);
}

export async function cleanupRunData(ctx) {
  if (!ctx.cleanup) return { skipped: true };
  if (!ctx.db?.ok) return { status: 'CLEANUP_BLOCKED', reason: 'no database connection' };
  const run = `%${ctx.runId}%`;
  const tables = [
    { entity: 'food_order_items', count: 'select count(*)::int as n from food_order_items where food_order_id in (select id from food_orders where notes like $1)', sql: 'delete from food_order_items where food_order_id in (select id from food_orders where notes like $1)' },
    { entity: 'food_orders', count: 'select count(*)::int as n from food_orders where notes like $1', sql: 'delete from food_orders where notes like $1' },
    { entity: 'rides', count: 'select count(*)::int as n from rides where pickup_address like $1', sql: 'delete from rides where pickup_address like $1' },
    { entity: 'marketplace_listings', count: 'select count(*)::int as n from marketplace_listings where title like $1', sql: 'delete from marketplace_listings where title like $1' },
    { entity: 'addresses', count: 'select count(*)::int as n from addresses where address_line1 like $1', sql: 'delete from addresses where address_line1 like $1' },
  ];
  const report = [];
  for (const table of tables) {
    try {
      const before = await ctx.db.query(table.count, [run]);
      const removed = await ctx.db.query(table.sql, [run]);
      const after = await ctx.db.query(table.count, [run]);
      report.push({ entity: table.entity, created: before.rows[0].n, deleted: removed.rowCount, remaining: after.rows[0].n, result: after.rows[0].n === 0 ? 'PASS' : 'FAIL' });
    } catch (err) {
      report.push({ entity: table.entity, created: null, deleted: 0, remaining: null, result: 'CLEANUP_BLOCKED', reason: err.message });
    }
  }
  ctx.cleanupReport = report;
  const blocked = report.some((row) => row.result === 'CLEANUP_BLOCKED');
  ctx.record(null, { suite: 'CLEANUP', scenario: 'run-filter', status: blocked ? 'BLOCKED' : 'PASS', expected: 'only this run id', actual: blocked ? 'CLEANUP_BLOCKED' : 'removed', details: 'Deletes are filtered by the run id. Users are not bulk-deleted.' });
  return report;
}
