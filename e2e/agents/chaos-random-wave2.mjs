/**
 * Wave-2 random chaos: shuffled food/auth/ride/mp cases with fresh seed each run.
 * Usage: node e2e/agents/chaos-random-wave2.mjs [seed]
 */
const BASE = process.env.API_BASE_URL || 'https://makemytree.duckdns.org';
const OTP = process.env.TEST_OTP || '123456';
const SEED = parseInt(process.argv[2] || process.env.CHAOS_SEED || String(Date.now() % 1e9), 10);

const CUSTOMER = '7014065979';
const OWNER = '9900000004';
const CAPTAIN = '6375002348';
const DUMMIES = Array.from({ length: 12 }, (_, i) => String(9000000401 + i));

const results = [];
const pass = (name, detail = '') => { results.push({ ok: true, name, detail }); console.log(`[PASS] ${name} :: ${detail}`); };
const fail = (name, detail = '') => { results.push({ ok: false, name, detail }); console.log(`[FAIL] ${name} :: ${detail}`); };
const expectStatus = (name, got, want, detail = '') => {
  const ok = Array.isArray(want) ? want.includes(got) : got === want;
  if (ok) pass(name, `status=${got} ${detail}`);
  else fail(name, `got=${got} want=${JSON.stringify(want)} ${detail}`);
};

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(SEED);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

async function api(method, path, { token, body, rawBody } = {}) {
  const headers = { ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  let payload;
  if (rawBody !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = rawBody;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${path}`, { method, headers, body: payload });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text.slice(0, 200) }; }
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
    await new Promise((x) => setTimeout(x, 200 * attempt));
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

function unwrapList(json) {
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json?.data?.items)) return json.data.items;
  return [];
}

async function main() {
  console.log(`CHAOS-W2 seed=${SEED} BASE=${BASE}`);
  const t0 = Date.now();
  const tokens = {};
  const addrs = {};
  const tracked = [];

  const actors = shuffle([CUSTOMER, OWNER, CAPTAIN, ...DUMMIES]);
  const boot = await mapPool(actors, 10, async (m, idx) => {
    const token = await login(m);
    const addressId = await ensureAddress(token, `W2 ${SEED} ${idx}`);
    return { m, token, addressId };
  });
  for (const b of boot) {
    tokens[b.m] = b.token;
    addrs[b.m] = b.addressId;
  }
  pass('W2-B01 bootstrap', `n=${actors.length} ms=${Date.now() - t0}`);

  const foodsRes = await api('GET', '/api/restaurants/foods?pageSize=80', { token: tokens[CUSTOMER] });
  const foods = unwrapList(foodsRes.json);
  const byRest = new Map();
  for (const f of foods) if (f?.restaurantId && f?.id) byRest.set(f.restaurantId, f);
  const rids = [...byRest.keys()];
  if (rids.length < 2) {
    fail('W2-C01 restaurants', `only ${rids.length}`);
    process.exit(1);
  }
  pass('W2-C01 restaurants', `${rids.length}`);

  const foodA = byRest.get(rids[0]);
  const foodB = byRest.get(rids[1]);

  // Random negative cases shuffled
  const negCases = shuffle([
    { name: 'N01 huge qty total', body: () => ({ restaurantId: rids[0], addressId: addrs[CUSTOMER], paymentMethod: 'COD', items: Array.from({ length: 10 }, () => ({ foodItemId: foodA.id, quantity: 12 })) }), want: 400 },
    { name: 'N02 51 line items', body: () => ({ restaurantId: rids[0], addressId: addrs[CUSTOMER], paymentMethod: 'COD', items: Array.from({ length: 51 }, () => ({ foodItemId: foodA.id, quantity: 1 })) }), want: 400 },
    { name: 'N03 unicode notes', body: () => ({ restaurantId: rids[0], addressId: addrs[CUSTOMER], paymentMethod: 'COD', notes: '🔥Chaosनमस्ते' + 'x'.repeat(500), items: [{ foodItemId: foodA.id, quantity: 1 }] }), want: [200, 400] },
    { name: 'N04 duplicate line same item', body: () => ({ restaurantId: rids[0], addressId: addrs[CUSTOMER], paymentMethod: 'COD', items: [{ foodItemId: foodA.id, quantity: 1 }, { foodItemId: foodA.id, quantity: 2 }] }), want: [200, 400] },
    { name: 'N05 sql-ish notes', body: () => ({ restaurantId: rids[0], addressId: addrs[CUSTOMER], paymentMethod: 'COD', notes: "'; DROP TABLE food_orders;--", items: [{ foodItemId: foodA.id, quantity: 1 }] }), want: 200 },
    { name: 'N06 restaurantId 0', body: () => ({ restaurantId: 0, addressId: addrs[CUSTOMER], paymentMethod: 'COD', items: [{ foodItemId: foodA.id, quantity: 1 }] }), want: [400, 404] },
    { name: 'N07 foodItemId 0', body: () => ({ restaurantId: rids[0], addressId: addrs[CUSTOMER], paymentMethod: 'COD', items: [{ foodItemId: 0, quantity: 1 }] }), want: 400 },
    { name: 'N08 lowercase online', body: () => ({ restaurantId: rids[0], addressId: addrs[CUSTOMER], paymentMethod: 'online', items: [{ foodItemId: foodA.id, quantity: 1 }] }), want: [200, 400] },
  ]);

  for (const c of negCases) {
    const r = await api('POST', '/api/FoodOrders', { token: tokens[CUSTOMER], body: c.body() });
    expectStatus(c.name, r.status, c.want, r.json?.message || '');
    if (r.status === 200 && r.json?.data?.id) tracked.push({ id: r.json.data.id, token: tokens[CUSTOMER] });
  }

  // Random PIN attempts
  for (const pin of shuffle(['12', '99999', '302001', '000000', '110011', 'abc123', ''])) {
    const r = await api('POST', '/api/addresses', {
      token: tokens[CUSTOMER],
      body: { label: `Pin${pin}`, addressLine1: 'Pin Test', city: 'Jaipur', state: 'Rajasthan', pinCode: pin, isDefault: false },
    });
    const valid = /^\d{6}$/.test(pin);
    if (valid) expectStatus(`PIN ok ${pin}`, r.status, 200, '');
    else expectStatus(`PIN bad ${pin || 'empty'}`, r.status, [400, 422], '');
  }

  // Concurrent mixed: place + multi + list
  const storm = shuffle(DUMMIES).slice(0, 8);
  const placed = await mapPool(storm, 8, async (m, idx) => {
    const mode = idx % 3;
    if (mode === 0) {
      const rid = rids[idx % rids.length];
      const r = await api('POST', '/api/FoodOrders', {
        token: tokens[m],
        body: {
          restaurantId: rid,
          addressId: addrs[m],
          paymentMethod: 'COD',
          notes: `W2-place-${SEED}-${idx}`,
          items: [{ foodItemId: byRest.get(rid).id, quantity: 1 + (idx % 3) }],
        },
      });
      return { kind: 'place', m, status: r.status, orders: r.json?.data ? [r.json.data] : [] };
    }
    if (mode === 1) {
      const r = await api('POST', '/api/foodorders/checkout', {
        token: tokens[m],
        body: {
          addressId: addrs[m],
          paymentMethod: 'COD',
          notes: `W2-multi-${SEED}-${idx}`,
          items: [
            { foodItemId: foodA.id, quantity: 1 },
            { foodItemId: foodB.id, quantity: 1 },
          ],
        },
      });
      return { kind: 'multi', m, status: r.status, orders: r.json?.data?.orders || [] };
    }
    const r = await api('GET', '/api/FoodOrders', { token: tokens[m] });
    return { kind: 'list', m, status: r.status, orders: [] };
  });

  const placeOk = placed.filter((p) => p.kind === 'place').every((p) => p.status === 200 && p.orders[0]?.id);
  const multiOk = placed.filter((p) => p.kind === 'multi').every((p) => p.status === 200 && p.orders.length === 2);
  const listOk = placed.filter((p) => p.kind === 'list').every((p) => p.status === 200);
  if (placeOk) pass('W2-S01 mixed place', ''); else fail('W2-S01 mixed place', JSON.stringify(placed.filter((p) => p.kind === 'place' && p.status !== 200).slice(0, 2)));
  if (multiOk) pass('W2-S02 mixed multi', ''); else fail('W2-S02 mixed multi', JSON.stringify(placed.filter((p) => p.kind === 'multi' && (p.status !== 200 || p.orders.length !== 2)).slice(0, 2)));
  if (listOk) pass('W2-S03 mixed list', ''); else fail('W2-S03 mixed list', '');

  for (const p of placed) {
    for (const o of p.orders || []) if (o?.id) tracked.push({ id: o.id, token: tokens[p.m] });
  }

  // Captain race: two READY orders, accept both sequentially after online
  await api('POST', '/api/driver/toggle-online', { token: tokens[CAPTAIN], body: { isOnline: true } });
  const foodR2 = byRest.get(2) || foodA;
  const lifeIds = [];
  for (let i = 0; i < 2; i++) {
    const place = await api('POST', '/api/FoodOrders', {
      token: tokens[CUSTOMER],
      body: {
        restaurantId: Number(foodR2.restaurantId),
        addressId: addrs[CUSTOMER],
        paymentMethod: 'COD',
        notes: `W2-life-${SEED}-${i}`,
        items: [{ foodItemId: foodR2.id, quantity: 1 }],
      },
    });
    if (place.status === 200) {
      const oid = place.json.data.id;
      lifeIds.push(oid);
      tracked.push({ id: oid, token: tokens[CUSTOMER] });
      for (const st of ['ACCEPTED', 'PREPARING', 'READY']) {
        await api('PUT', `/api/vendor/orders/${oid}/status`, { token: tokens[OWNER], body: { status: st } });
      }
    }
  }
  if (lifeIds.length === 2) {
    const a1 = await api('POST', `/api/driver/food-orders/${lifeIds[0]}/accept`, { token: tokens[CAPTAIN], body: {} });
    expectStatus('W2-L01 first accept', a1.status, 200, '');
    const a2 = await api('POST', `/api/driver/food-orders/${lifeIds[1]}/accept`, { token: tokens[CAPTAIN], body: {} });
    // second should conflict while first active
    expectStatus('W2-L02 second accept while active', a2.status, [400, 409], a2.json?.message || '');
    await api('POST', `/api/FoodOrders/${lifeIds[0]}/cancel`, { token: tokens[CUSTOMER], body: {} });
    await api('POST', `/api/FoodOrders/${lifeIds[1]}/cancel`, { token: tokens[CUSTOMER], body: {} });
    pass('W2-L03 cleared both', '');
  } else {
    fail('W2-L01 place life orders', `n=${lifeIds.length}`);
  }

  // Marketplace random
  const mpPaths = shuffle([
    '/api/marketplace?page=1&pageSize=5',
    '/api/marketplace?search=phone',
    '/api/marketplace?minPrice=0&maxPrice=1',
    '/api/marketplace/categories',
    '/api/marketplace/favorites',
    '/api/marketplace/99999999',
  ]);
  for (const path of mpPaths) {
    const r = await api('GET', path, { token: tokens[CUSTOMER] });
    if (r.status >= 500) fail(`W2-M ${path}`, `status=${r.status}`);
    else pass(`W2-M ${path}`, `status=${r.status}`);
  }

  const fakeFav = await api('POST', '/api/marketplace/favorites/99999999', { token: tokens[CUSTOMER] });
  expectStatus('W2-M fav missing', fakeFav.status, [400, 404], fakeFav.json?.message || '');

  // Auth token junk
  const badTok = await api('GET', '/api/FoodOrders', { token: 'not.a.jwt' });
  expectStatus('W2-A bad jwt', badTok.status, [401, 403], '');

  // Cleanup
  let cleaned = 0;
  await mapPool(tracked, 10, async (o) => {
    const det = await api('GET', `/api/FoodOrders/${o.id}`, { token: o.token });
    const st = det.json?.data?.status;
    if (['PENDING', 'ACCEPTED', 'PREPARING', 'READY'].includes(st)) {
      const c = await api('POST', `/api/FoodOrders/${o.id}/cancel`, { token: o.token, body: {} });
      if (c.status === 200) cleaned++;
    }
  });
  pass('W2-Z90 cleanup', `cleaned=${cleaned} tracked=${tracked.length}`);

  await api('POST', '/api/driver/toggle-online', { token: tokens[CAPTAIN], body: { isOnline: false } });
  const health = await api('GET', '/health');
  expectStatus('W2-Z99 health', health.status, 200, '');

  const failed = results.filter((r) => !r.ok);
  console.log(`\n==== CHAOS-W2 seed=${SEED} PASS=${results.length - failed.length} FAIL=${failed.length} TOTAL=${results.length} elapsedMs=${Date.now() - t0} ====`);
  for (const f of failed) console.log(`[FAIL] ${f.name} :: ${f.detail}`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
