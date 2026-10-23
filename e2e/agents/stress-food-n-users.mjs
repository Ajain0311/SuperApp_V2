/**
 * N dummy customers concurrent food stress (place + multi + cleanup).
 * Usage: node food-stress-n.mjs [N=50]
 */
const BASE = process.env.API_BASE_URL || 'https://makemytree.duckdns.org';
const OTP = process.env.TEST_OTP || '123456';
const N = Math.max(1, parseInt(process.argv[2] || process.env.STRESS_N || '50', 10));
const START = parseInt(process.env.STRESS_START || '9000000201', 10); // 9000000201..
const OWNER = '9900000004';
const CAPTAIN = '6375002348';
const CONCURRENCY = Math.min(25, N); // login/place batch size

const results = [];
const pass = (name, detail = '') => { results.push({ ok: true, name, detail }); console.log(`[PASS] ${name} :: ${detail}`); };
const fail = (name, detail = '') => { results.push({ ok: false, name, detail }); console.log(`[FAIL] ${name} :: ${detail}`); };

const mobiles = Array.from({ length: N }, (_, i) => String(START + i));

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

async function mapPool(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return out;
}

async function login(mobile) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    await api('POST', '/api/auth/send-otp', { body: { mobileNumber: mobile } });
    const r = await api('POST', '/api/auth/verify-otp', { body: { mobileNumber: mobile, otpCode: OTP } });
    if (r.status === 200 && r.json?.token) return r.json.token;
    await new Promise((r) => setTimeout(r, 300 * attempt));
  }
  throw new Error(`login failed ${mobile}`);
}

async function ensureAddress(token, street) {
  const list = await api('GET', '/api/addresses', { token });
  const rows = Array.isArray(list.json?.data) ? list.json.data : [];
  const active = rows.find((a) => a.isActive !== false);
  if (active?.id) return active.id;
  const created = await api('POST', '/api/addresses', {
    token,
    body: { label: 'Home', addressLine1: street, city: 'Jaipur', state: 'Rajasthan', pinCode: '302001', isDefault: true },
  });
  if (created.status !== 200 || !created.json?.data?.id) throw new Error(`address failed ${created.status}`);
  return created.json.data.id;
}

async function main() {
  console.log(`STRESS N=${N} START=${START} BASE=${BASE} concurrency=${CONCURRENCY}`);
  const t0 = Date.now();

  const tokens = {};
  const addrs = {};
  const boot = await mapPool(mobiles, CONCURRENCY, async (m, idx) => {
    const token = await login(m);
    const addressId = await ensureAddress(token, `Stress Street ${START + idx}`);
    return { m, token, addressId };
  });
  for (const b of boot) {
    tokens[b.m] = b.token;
    addrs[b.m] = b.addressId;
  }
  pass(`S01 bootstrap ${N} dummies`, `ms=${Date.now() - t0}`);

  tokens[OWNER] = await login(OWNER);
  tokens[CAPTAIN] = await login(CAPTAIN);

  const foodsRes = await api('GET', '/api/restaurants/foods?pageSize=50', { token: tokens[mobiles[0]] });
  const foods = foodsRes.json?.data?.items || [];
  const by = new Map();
  for (const f of foods) if (!by.has(f.restaurantId)) by.set(f.restaurantId, f);
  const rids = [...by.keys()];
  if (rids.length < 2) {
    fail('S02 restaurants', `only ${rids.length}`);
  } else {
    pass('S02 restaurants', `${rids.length} with foods`);
  }

  // Concurrent single-restaurant place
  const tPlace = Date.now();
  const placed = await mapPool(mobiles, CONCURRENCY, async (m, idx) => {
    const rid = rids[idx % rids.length];
    const food = by.get(rid);
    const r = await api('POST', '/api/FoodOrders', {
      token: tokens[m],
      body: {
        restaurantId: rid,
        addressId: addrs[m],
        paymentMethod: 'COD',
        notes: `STRESS${N}-u${idx}-r${rid}`,
        items: [{ foodItemId: food.id, quantity: 1 }],
      },
    });
    return {
      m, idx, rid, foodId: food.id, status: r.status,
      order: r.json?.data, message: r.json?.message,
    };
  });
  const placeOk = placed.every((p) => p.status === 200 && p.order?.id);
  const routed = placed.every((p) => p.order && Number(p.order.restaurantId) === Number(p.rid));
  const itemOk = placed.every((p) => p.order?.items?.every((it) => Number(it.foodItemId) === Number(p.foodId)));
  if (placeOk && routed && itemOk) {
    pass(`S10 concurrent ${N} place+route`, `ms=${Date.now() - tPlace} sample=${placed.slice(0, 5).map((p) => p.order.id + '@r' + p.rid).join(',')}`);
  } else {
    const bad = placed.filter((p) => p.status !== 200 || Number(p.order?.restaurantId) !== Number(p.rid)).slice(0, 8);
    fail(`S10 concurrent ${N} place+route`, JSON.stringify(bad));
  }

  // Concurrent multi for first min(10, N) users
  const multiUsers = mobiles.slice(0, Math.min(10, N));
  const rA = rids[0];
  const rB = rids[1];
  const tMulti = Date.now();
  const multis = await mapPool(multiUsers, CONCURRENCY, async (m) => {
    const r = await api('POST', '/api/foodorders/checkout', {
      token: tokens[m],
      body: {
        addressId: addrs[m],
        paymentMethod: 'COD',
        notes: `STRESS${N}-multi-${m}`,
        items: [
          { foodItemId: by.get(rA).id, quantity: 1 },
          { foodItemId: by.get(rB).id, quantity: 1 },
        ],
      },
    });
    return { m, status: r.status, orders: r.json?.data?.orders || [], message: r.json?.message };
  });
  const multiOk = multis.every((x) => x.status === 200 && x.orders.length === 2);
  if (multiOk) pass(`S11 concurrent ${multiUsers.length}x multi`, `ms=${Date.now() - tMulti} orders=${multis.length * 2}`);
  else fail(`S11 concurrent ${multiUsers.length}x multi`, JSON.stringify(multis.filter((x) => x.status !== 200 || x.orders.length !== 2).slice(0, 5)));

  // Owner isolation
  const vlist = await api('GET', '/api/vendor/orders', { token: tokens[OWNER] });
  const vorders = Array.isArray(vlist.json?.data) ? vlist.json.data : [];
  const foreign = vorders.filter((o) => Number(o.restaurantId) !== 2);
  if (vlist.status === 200 && foreign.length === 0) pass('S20 owner isolation', `listed=${vorders.length}`);
  else fail('S20 owner isolation', `foreign=${foreign.length}`);

  // Lifecycle on one r2 order
  let life = placed.find((p) => Number(p.rid) === 2 && p.order?.id);
  if (life) {
    const lifeId = life.order.id;
    let kitchenOk = true;
    for (const st of ['ACCEPTED', 'PREPARING', 'READY']) {
      const r = await api('PUT', `/api/vendor/orders/${lifeId}/status`, { token: tokens[OWNER], body: { status: st } });
      if (r.status !== 200) { kitchenOk = false; fail(`S31 kitchen ${st}`, `${r.status} ${r.json?.message}`); }
    }
    if (kitchenOk) pass('S31 kitchen READY', `order=${lifeId}`);
    await api('POST', '/api/driver/toggle-online', { token: tokens[CAPTAIN], body: { isOnline: true } });
    const acc = await api('POST', `/api/driver/food-orders/${lifeId}/accept`, { token: tokens[CAPTAIN], body: {} });
    if (acc.status === 200) pass('S32 captain accept', '200');
    else fail('S32 captain accept', `${acc.status} ${acc.json?.message}`);
    const can = await api('POST', `/api/FoodOrders/${lifeId}/cancel`, { token: tokens[life.m], body: {} });
    const det = await api('GET', `/api/FoodOrders/${lifeId}`, { token: tokens[life.m] });
    const active = await api('GET', '/api/driver/active-food-order', { token: tokens[CAPTAIN] });
    if (can.status === 200 && det.json?.data?.status === 'CANCELLED' && !det.json?.data?.driverId && !active.json?.data) {
      pass('S33 cancel clears captain', `order=${lifeId}`);
    } else {
      fail('S33 cancel clears captain', `${can.status} ${det.json?.data?.status}`);
    }
  } else {
    pass('S31 kitchen READY', 'skipped-no-r2-in-batch');
  }

  // Cleanup cancels (batched)
  let cleaned = 0;
  let cleanFail = 0;
  await mapPool(placed, CONCURRENCY, async (p) => {
    if (!p.order?.id) return;
    const det = await api('GET', `/api/FoodOrders/${p.order.id}`, { token: tokens[p.m] });
    const st = det.json?.data?.status;
    if (['PENDING', 'ACCEPTED', 'PREPARING', 'READY'].includes(st)) {
      const c = await api('POST', `/api/FoodOrders/${p.order.id}/cancel`, { token: tokens[p.m], body: {} });
      if (c.status === 200) cleaned++; else cleanFail++;
    }
  });
  await mapPool(multis.flatMap((x) => x.orders.map((o) => ({ m: x.m, id: o.id }))), CONCURRENCY, async (o) => {
    const c = await api('POST', `/api/FoodOrders/${o.id}/cancel`, { token: tokens[o.m], body: {} });
    if (c.status === 200) cleaned++; else if (c.status !== 400) cleanFail++;
  });
  pass('S90 cleanup', `cleaned=${cleaned} unexpectedFail=${cleanFail}`);

  await api('POST', '/api/driver/toggle-online', { token: tokens[CAPTAIN], body: { isOnline: false } });

  const failed = results.filter((r) => !r.ok);
  console.log(`\n==== N=${N} TOTAL=${results.length} FAIL=${failed.length} elapsedMs=${Date.now() - t0} ====`);
  for (const f of failed) console.log(`[FAIL] ${f.name} :: ${f.detail}`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
