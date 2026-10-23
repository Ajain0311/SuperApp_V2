/**
 * 10 dummy customers × multi-restaurant food stress + lifecycle edges.
 * Uses live API + TEST_OTP 123456.
 */
const BASE = process.env.API_BASE_URL || 'https://makemytree.duckdns.org';
const OTP = process.env.TEST_OTP || '123456';
const DUMMIES = Array.from({ length: 10 }, (_, i) => `90000001${String(i + 1).padStart(2, '0')}`); // 9000000101..0110
const OWNER = '9900000004';
const CAPTAIN = '6375002348';

const results = [];
const pass = (name, detail = '') => { results.push({ name, ok: true, detail }); console.log(`[PASS] ${name} :: ${detail}`); };
const fail = (name, detail = '') => { results.push({ name, ok: false, detail }); console.log(`[FAIL] ${name} :: ${detail}`); };

async function api(method, path, { token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
  return { status: res.status, json };
}

async function login(mobile) {
  await api('POST', '/api/auth/send-otp', { body: { mobileNumber: mobile } });
  const { status, json } = await api('POST', '/api/auth/verify-otp', { body: { mobileNumber: mobile, otpCode: OTP } });
  if (status !== 200 || !json?.token) throw new Error(`login ${mobile} failed ${status} ${JSON.stringify(json)}`);
  return json.token;
}

async function ensureAddress(token, street) {
  const list = await api('GET', '/api/addresses', { token });
  const rows = Array.isArray(list.json?.data) ? list.json.data : [];
  const active = rows.find((a) => a.isActive !== false);
  if (active?.id) return active.id;
  const created = await api('POST', '/api/addresses', {
    token,
    body: {
      label: 'Home',
      addressLine1: street,
      city: 'Jaipur',
      state: 'Rajasthan',
      pinCode: '302001',
      isDefault: true,
    },
  });
  if (created.status !== 200 || !created.json?.data?.id) {
    throw new Error(`address create failed ${created.status} ${JSON.stringify(created.json)}`);
  }
  return created.json.data.id;
}

async function foodsMap(token) {
  const { status, json } = await api('GET', '/api/restaurants/foods?pageSize=50', { token });
  if (status !== 200) throw new Error(`foods ${status}`);
  const items = json?.data?.items || [];
  const map = new Map();
  for (const f of items) {
    if (!map.has(f.restaurantId)) map.set(f.restaurantId, f);
  }
  return { items, map };
}

async function main() {
  console.log(`BASE=${BASE} dummies=${DUMMIES.join(',')}`);

  // --- bootstrap actors ---
  const tokens = {};
  await Promise.all(DUMMIES.map(async (m, idx) => {
    tokens[m] = await login(m);
    tokens[`addr_${m}`] = await ensureAddress(tokens[m], `Dummy Street ${101 + idx}`);
  }));
  tokens[OWNER] = await login(OWNER);
  tokens[CAPTAIN] = await login(CAPTAIN);
  pass('U01 bootstrap 10 dummies + owner + captain', `addrs ok`);

  const { map: foodByRest, items: allFoods } = await foodsMap(tokens[DUMMIES[0]]);
  const restaurantIds = [...foodByRest.keys()];
  if (restaurantIds.length < 3) {
    fail('U02 restaurants available', `only ${restaurantIds.length}`);
  } else {
    pass('U02 restaurants available', `${restaurantIds.length} with foods`);
  }

  // --- concurrent single-restaurant orders (10 users → rotating restaurants) ---
  const placed = await Promise.all(DUMMIES.map(async (m, idx) => {
    const rid = restaurantIds[idx % restaurantIds.length];
    const food = foodByRest.get(rid);
    const body = {
      restaurantId: rid,
      addressId: tokens[`addr_${m}`],
      paymentMethod: 'COD',
      notes: `STRESS10-u${idx + 1}-r${rid}`,
      items: [{ foodItemId: food.id, quantity: 1 }],
    };
    const { status, json } = await api('POST', '/api/FoodOrders', { token: tokens[m], body });
    return {
      mobile: m,
      idx,
      rid,
      foodId: food.id,
      status,
      order: json?.data,
      message: json?.message,
    };
  }));

  const placeOk = placed.every((p) => p.status === 200 && p.order?.id);
  const routed = placed.every((p) => p.order && Number(p.order.restaurantId) === Number(p.rid));
  const itemsMatch = placed.every((p) => p.order?.items?.every((it) => Number(it.foodItemId) === Number(p.foodId)));
  if (placeOk && routed && itemsMatch) {
    pass('U10 concurrent 10 place+route', placed.map((p) => `${p.order.id}@r${p.rid}`).join(','));
  } else {
    fail('U10 concurrent 10 place+route', JSON.stringify(placed.map((p) => ({ m: p.mobile, status: p.status, rid: p.rid, got: p.order?.restaurantId, msg: p.message }))));
  }

  // --- multi-hotel checkout from dummy #1 ---
  const rA = restaurantIds[0];
  const rB = restaurantIds.find((id) => id !== rA) || restaurantIds[1];
  const multiBody = {
    addressId: tokens[`addr_${DUMMIES[0]}`],
    paymentMethod: 'COD',
    notes: 'STRESS10-multi',
    items: [
      { foodItemId: foodByRest.get(rA).id, quantity: 1 },
      { foodItemId: foodByRest.get(rB).id, quantity: 1 },
    ],
  };
  const multi = await api('POST', '/api/foodorders/checkout', { token: tokens[DUMMIES[0]], body: multiBody });
  const mOrders = multi.json?.data?.orders || [];
  const multiOk = multi.status === 200 && mOrders.length === 2
    && mOrders.some((o) => Number(o.restaurantId) === Number(rA))
    && mOrders.some((o) => Number(o.restaurantId) === Number(rB));
  if (multiOk) pass('U11 multi-hotel checkout', mOrders.map((o) => `${o.id}@r${o.restaurantId}`).join(','));
  else fail('U11 multi-hotel checkout', `${multi.status} ${JSON.stringify(multi.json)}`);

  // ONLINE multi must fail
  const onlineMulti = await api('POST', '/api/foodorders/checkout', {
    token: tokens[DUMMIES[1]],
    body: { ...multiBody, addressId: tokens[`addr_${DUMMIES[1]}`], paymentMethod: 'ONLINE' },
  });
  if (onlineMulti.status === 400) pass('U12 ONLINE multi blocked', onlineMulti.json?.message || '400');
  else fail('U12 ONLINE multi blocked', `${onlineMulti.status}`);

  // --- owner isolation: vendor list only restaurant 2 ---
  const vlist = await api('GET', '/api/vendor/orders', { token: tokens[OWNER] });
  const vorders = Array.isArray(vlist.json?.data) ? vlist.json.data : [];
  const foreign = vorders.filter((o) => Number(o.restaurantId) !== 2);
  if (vlist.status === 200 && foreign.length === 0) pass('U20 owner list isolation', `n=${vorders.length}`);
  else fail('U20 owner list isolation', `foreign=${foreign.length} status=${vlist.status}`);

  // Owner must not advance another restaurant's order
  const otherPlaced = placed.find((p) => Number(p.rid) !== 2 && p.order?.id);
  if (otherPlaced) {
    const adv = await api('PUT', `/api/vendor/orders/${otherPlaced.order.id}/status`, {
      token: tokens[OWNER],
      body: { status: 'ACCEPTED' },
    });
    if ([400, 403, 404].includes(adv.status)) pass('U21 owner blocked on foreign order', `${adv.status}`);
    else fail('U21 owner blocked on foreign order', `${adv.status}`);
  } else {
    pass('U21 owner blocked on foreign order', 'skipped-no-foreign-placed');
  }

  // --- full lifecycle on one restaurant-2 order from dummies ---
  let life = placed.find((p) => Number(p.rid) === 2 && p.order?.id);
  if (!life) {
    // place dedicated
    const food = foodByRest.get(2);
    const { status, json } = await api('POST', '/api/FoodOrders', {
      token: tokens[DUMMIES[0]],
      body: {
        restaurantId: 2,
        addressId: tokens[`addr_${DUMMIES[0]}`],
        paymentMethod: 'COD',
        notes: 'STRESS10-lifecycle',
        items: [{ foodItemId: food.id, quantity: 1 }],
      },
    });
    life = { order: json?.data, status, rid: 2 };
  }
  const lifeId = life.order?.id;
  if (!lifeId) fail('U30 lifecycle seed', 'no r2 order');
  else {
    for (const st of ['ACCEPTED', 'PREPARING', 'READY']) {
      const r = await api('PUT', `/api/vendor/orders/${lifeId}/status`, { token: tokens[OWNER], body: { status: st } });
      if (r.status !== 200) fail(`U31 vendor ${st}`, `${r.status} ${r.json?.message}`);
    }
    if (!results.some((x) => !x.ok && x.name.startsWith('U31'))) pass('U31 kitchen ACCEPTED→READY', `order=${lifeId}`);

    await api('POST', '/api/driver/toggle-online', { token: tokens[CAPTAIN], body: { isOnline: true } });
    const acc = await api('POST', `/api/driver/food-orders/${lifeId}/accept`, { token: tokens[CAPTAIN], body: {} });
    if (acc.status === 200) pass('U32 captain accept', '200');
    else fail('U32 captain accept', `${acc.status} ${acc.json?.message}`);

    // race: second captain accept should fail (same captain retry / already assigned)
    const acc2 = await api('POST', `/api/driver/food-orders/${lifeId}/accept`, { token: tokens[CAPTAIN], body: {} });
    if ([400, 409].includes(acc2.status)) pass('U33 double accept blocked', `${acc2.status}`);
    else fail('U33 double accept blocked', `${acc2.status}`);

    const cancel = await api('POST', `/api/FoodOrders/${lifeId}/cancel`, { token: tokens[life.mobile || DUMMIES[0]], body: {} });
    // if life.mobile missing use DUMMIES that owns - for dedicated order it's DUMMIES[0]
    const ownerMobile = life.mobile || DUMMIES[0];
    const cancel2 = cancel.status === 200 ? cancel : await api('POST', `/api/FoodOrders/${lifeId}/cancel`, { token: tokens[ownerMobile], body: {} });
    const det = await api('GET', `/api/FoodOrders/${lifeId}`, { token: tokens[ownerMobile] });
    const active = await api('GET', '/api/driver/active-food-order', { token: tokens[CAPTAIN] });
    const okCancel = cancel2.status === 200 && det.json?.data?.status === 'CANCELLED' && !det.json?.data?.driverId && !active.json?.data;
    if (okCancel) pass('U34 cancel after accept clears captain', `order=${lifeId}`);
    else fail('U34 cancel after accept clears captain', `${cancel2.status} status=${det.json?.data?.status} driver=${det.json?.data?.driverId} active=${!!active.json?.data}`);
  }

  // --- pickup-block lifecycle ---
  {
    const food = foodByRest.get(2);
    const { json } = await api('POST', '/api/FoodOrders', {
      token: tokens[DUMMIES[2]],
      body: {
        restaurantId: 2, addressId: tokens[`addr_${DUMMIES[2]}`], paymentMethod: 'COD', notes: 'STRESS10-pickup',
        items: [{ foodItemId: food.id, quantity: 1 }],
      },
    });
    const oid = json?.data?.id;
    for (const st of ['ACCEPTED', 'PREPARING', 'READY']) {
      await api('PUT', `/api/vendor/orders/${oid}/status`, { token: tokens[OWNER], body: { status: st } });
    }
    await api('POST', '/api/driver/toggle-online', { token: tokens[CAPTAIN], body: { isOnline: true } });
    await api('POST', `/api/driver/food-orders/${oid}/accept`, { token: tokens[CAPTAIN], body: {} });
    const pk = await api('POST', `/api/driver/food-orders/${oid}/pickup`, { token: tokens[CAPTAIN], body: {} });
    const cb = await api('POST', `/api/FoodOrders/${oid}/cancel`, { token: tokens[DUMMIES[2]], body: {} });
    if (pk.status === 200 && cb.status === 400) pass('U35 cancel blocked after pickup', `order=${oid}`);
    else fail('U35 cancel blocked after pickup', `pickup=${pk.status} cancel=${cb.status}`);
    await api('POST', `/api/driver/food-orders/${oid}/deliver`, { token: tokens[CAPTAIN], body: {} });
  }

  // --- cleanup: cancel remaining PENDING/ACCEPTED/READY dummy orders (best effort) ---
  let cleaned = 0;
  for (const p of placed) {
    if (!p.order?.id) continue;
    const det = await api('GET', `/api/FoodOrders/${p.order.id}`, { token: tokens[p.mobile] });
    const st = det.json?.data?.status;
    if (['PENDING', 'ACCEPTED', 'PREPARING', 'READY'].includes(st)) {
      const c = await api('POST', `/api/FoodOrders/${p.order.id}/cancel`, { token: tokens[p.mobile], body: {} });
      if (c.status === 200) cleaned++;
    }
  }
  for (const o of mOrders) {
    const c = await api('POST', `/api/FoodOrders/${o.id}/cancel`, { token: tokens[DUMMIES[0]], body: {} });
    if (c.status === 200) cleaned++;
  }
  pass('U90 cleanup cancels', `cleaned=${cleaned}`);

  await api('POST', '/api/driver/toggle-online', { token: tokens[CAPTAIN], body: { isOnline: false } });

  const failed = results.filter((r) => !r.ok);
  console.log(`\n==== SUMMARY total=${results.length} FAIL=${failed.length} ====`);
  for (const f of failed) console.log(`[FAIL] ${f.name} :: ${f.detail}`);
  if (failed.length) process.exit(1);
  console.log('ALL STRESS CASES PASS');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
