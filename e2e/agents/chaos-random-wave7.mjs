/**
 * Wave-7 random chaos: multi-hotel checkout edges, coupon+ONLINE combo,
 * captain unassign, vendor status after cancel, listing create junk,
 * profile probes, concurrent address create, food cancel after READY.
 * Usage: node e2e/agents/chaos-random-wave7.mjs [seed]
 */
const BASE = process.env.API_BASE_URL || 'https://makemytree.duckdns.org';
const OTP = process.env.TEST_OTP || '123456';
const SEED = parseInt(process.argv[2] || process.env.CHAOS_SEED || String(Date.now() % 1e9), 10);

const CUSTOMER = '7014065979';
const CUSTOMER_B = '9123456780';
const OWNER = '9900000004';
const CAPTAIN = '6375002348';
const DUMMIES = Array.from({ length: 6 }, (_, i) => String(9000000901 + i));

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

async function api(method, path, { token, body } = {}) {
  const headers = { ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  let payload;
  if (body !== undefined) {
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
  console.log(`CHAOS-W7 seed=${SEED} BASE=${BASE}`);
  const t0 = Date.now();
  const tokens = {};
  const addrs = {};
  const tracked = [];

  const actors = [CUSTOMER, CUSTOMER_B, OWNER, CAPTAIN, ...DUMMIES];
  const boot = await mapPool(actors, 8, async (m, idx) => {
    const token = await login(m);
    const addressId = await ensureAddress(token, `W7 ${SEED} ${idx}`);
    return { m, token, addressId };
  });
  for (const b of boot) {
    tokens[b.m] = b.token;
    addrs[b.m] = b.addressId;
  }
  pass('W7-B01 bootstrap', `n=${actors.length}`);
  await api('POST', '/api/vendor/toggle-status', { token: tokens[OWNER], body: { isOpen: true } });

  const foods = unwrapList((await api('GET', '/api/restaurants/foods?pageSize=80', { token: tokens[CUSTOMER] })).json);
  const byRest = new Map();
  for (const f of foods) if (f?.restaurantId && f?.id) byRest.set(f.restaurantId, f);
  const rids = [...byRest.keys()];
  if (rids.length < 2) { fail('W7-C01', 'need 2 restaurants'); process.exit(1); }
  const foodA = byRest.get(rids[0]);
  const foodB = byRest.get(rids[1]);
  const foodR2 = byRest.get(2) || foodA;
  pass('W7-C01 restaurants', `${rids.length}`);

  // Multi-hotel COD checkout
  {
    const r = await api('POST', '/api/foodorders/checkout', {
      token: tokens[CUSTOMER],
      body: {
        addressId: addrs[CUSTOMER],
        paymentMethod: 'COD',
        notes: `W7-multi-${SEED}`,
        items: [
          { foodItemId: foodA.id, quantity: 1 },
          { foodItemId: foodB.id, quantity: 1 },
        ],
      },
    });
    expectStatus('W7-M01 multi COD checkout', r.status, [200], r.json?.message || '');
    const orders = r.json?.data?.orders || (r.json?.data?.id ? [r.json.data] : []);
    for (const o of orders) if (o?.id) tracked.push({ id: o.id, token: tokens[CUSTOMER] });
    if (r.status === 200 && orders.length >= 2) pass('W7-M01b split count', String(orders.length));
    else if (r.status === 200) pass('W7-M01b single-or-split', String(orders.length));
  }

  // Multi + ONLINE blocked
  {
    const r = await api('POST', '/api/foodorders/checkout', {
      token: tokens[CUSTOMER],
      body: {
        addressId: addrs[CUSTOMER],
        paymentMethod: 'ONLINE',
        items: [
          { foodItemId: foodA.id, quantity: 1 },
          { foodItemId: foodB.id, quantity: 1 },
        ],
      },
    });
    expectStatus('W7-M02 multi ONLINE blocked', r.status, [400], r.json?.message || '');
  }

  // Multi + coupon blocked
  {
    const r = await api('POST', '/api/foodorders/checkout', {
      token: tokens[CUSTOMER],
      body: {
        addressId: addrs[CUSTOMER],
        paymentMethod: 'COD',
        couponCode: `X${SEED}`,
        items: [
          { foodItemId: foodA.id, quantity: 1 },
          { foodItemId: foodB.id, quantity: 1 },
        ],
      },
    });
    expectStatus('W7-M03 multi coupon blocked', r.status, [400], r.json?.message || '');
  }

  // Cancel after READY still allowed; vendor status after cancel blocked
  {
    const place = await api('POST', '/api/FoodOrders', {
      token: tokens[CUSTOMER],
      body: {
        restaurantId: Number(foodR2.restaurantId),
        addressId: addrs[CUSTOMER],
        paymentMethod: 'COD',
        notes: `W7-ready-cancel-${SEED}`,
        items: [{ foodItemId: foodR2.id, quantity: 1 }],
      },
    });
    expectStatus('W7-K01 place', place.status, 200, '');
    if (place.status === 200) {
      const oid = place.json.data.id;
      tracked.push({ id: oid, token: tokens[CUSTOMER] });
      await api('PUT', `/api/vendor/orders/${oid}/status`, { token: tokens[OWNER], body: { status: 'ACCEPTED' } });
      await api('PUT', `/api/vendor/orders/${oid}/status`, { token: tokens[OWNER], body: { status: 'READY' } });
      const cancel = await api('POST', `/api/FoodOrders/${oid}/cancel`, { token: tokens[CUSTOMER], body: {} });
      expectStatus('W7-K02 cancel after READY', cancel.status, [200, 400], '');
      const adv = await api('PUT', `/api/vendor/orders/${oid}/status`, { token: tokens[OWNER], body: { status: 'PREPARING' } });
      expectStatus('W7-K03 vendor after cancel', adv.status, [400, 404, 409], '');
    }
  }

  // Captain accept then unassign
  {
    const place = await api('POST', '/api/FoodOrders', {
      token: tokens[CUSTOMER],
      body: {
        restaurantId: Number(foodR2.restaurantId),
        addressId: addrs[CUSTOMER],
        paymentMethod: 'COD',
        notes: `W7-unassign-${SEED}`,
        items: [{ foodItemId: foodR2.id, quantity: 1 }],
      },
    });
    if (place.status === 200) {
      const oid = place.json.data.id;
      tracked.push({ id: oid, token: tokens[CUSTOMER] });
      await api('PUT', `/api/vendor/orders/${oid}/status`, { token: tokens[OWNER], body: { status: 'ACCEPTED' } });
      await api('PUT', `/api/vendor/orders/${oid}/status`, { token: tokens[OWNER], body: { status: 'READY' } });
      await api('POST', '/api/driver/toggle-online', { token: tokens[CAPTAIN], body: { isOnline: true } });
      const acc = await api('POST', `/api/driver/food-orders/${oid}/accept`, { token: tokens[CAPTAIN], body: {} });
      expectStatus('W7-U01 accept', acc.status, [200, 409], '');
      if (acc.status === 200) {
        const un = await api('POST', `/api/driver/food-orders/${oid}/unassign`, { token: tokens[CAPTAIN], body: {} });
        expectStatus('W7-U02 unassign', un.status, [200, 400, 404], '');
      }
      await api('POST', `/api/FoodOrders/${oid}/cancel`, { token: tokens[CUSTOMER], body: {} });
    }
  }

  // Concurrent address creates
  {
    const storm = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        api('POST', '/api/addresses', {
          token: tokens[CUSTOMER_B],
          body: {
            label: `Storm${i}`,
            addressLine1: `W7 storm ${SEED} ${i}`,
            city: 'Jaipur',
            state: 'Rajasthan',
            pinCode: '302020',
            isDefault: i === 0,
          },
        }),
      ),
    );
    const okN = storm.filter((s) => s.status === 200).length;
    if (okN >= 3) pass('W7-A01 addr storm', `ok=${okN}/5`);
    else fail('W7-A01 addr storm', storm.map((s) => s.status).join(','));
  }

  // Marketplace listing create junk
  {
    const cats = unwrapList((await api('GET', '/api/marketplace/categories', { token: tokens[CUSTOMER] })).json);
    const catId = cats[0]?.id || 1;
    const junk = [
      { title: '', price: 10, categoryId: catId },
      { title: 'x', price: -1, categoryId: catId },
      { title: 'ok', price: 50, categoryId: 0 },
      { title: 'x'.repeat(500), price: 10, categoryId: catId },
    ];
    for (let i = 0; i < junk.length; i++) {
      const r = await api('POST', '/api/marketplace/listings', { token: tokens[CUSTOMER], body: junk[i] });
      expectStatus(`W7-L0${i + 1} listing junk`, r.status, [200, 201, 400, 422], '');
      // cleanup if created
      if ((r.status === 200 || r.status === 201) && r.json?.data?.id) {
        // no delete endpoint assumed — leave
      }
    }
  }

  // Profile / me style probes
  {
    const paths = ['/api/auth/me', '/api/users/me', '/api/profile', '/api/driver/profile'];
    for (const p of paths) {
      const r = await api('GET', p, { token: tokens[CUSTOMER] });
      expectStatus(`W7-P ${p}`, r.status, [200, 401, 403, 404], '');
    }
    const cap = await api('GET', '/api/driver/profile', { token: tokens[CAPTAIN] });
    expectStatus('W7-P captain profile', cap.status, [200], '');
  }

  // Owner cannot cancel customer order via FoodOrders cancel
  {
    const place = await api('POST', '/api/FoodOrders', {
      token: tokens[CUSTOMER],
      body: {
        restaurantId: Number(foodR2.restaurantId),
        addressId: addrs[CUSTOMER],
        paymentMethod: 'COD',
        notes: `W7-ownercancel-${SEED}`,
        items: [{ foodItemId: foodR2.id, quantity: 1 }],
      },
    });
    if (place.status === 200) {
      const oid = place.json.data.id;
      tracked.push({ id: oid, token: tokens[CUSTOMER] });
      const oc = await api('POST', `/api/FoodOrders/${oid}/cancel`, { token: tokens[OWNER], body: {} });
      expectStatus('W7-X01 owner customer-cancel', oc.status, [403, 404], '');
      await api('POST', `/api/FoodOrders/${oid}/cancel`, { token: tokens[CUSTOMER], body: {} });
    }
  }

  await mapPool(tracked, 8, async (o) => {
    try { await api('POST', `/api/FoodOrders/${o.id}/cancel`, { token: o.token, body: {} }); } catch { /* ignore */ }
  });

  const failed = results.filter((r) => !r.ok);
  const ok = results.filter((r) => r.ok);
  console.log(`\n=== CHAOS-W7 DONE seed=${SEED} PASS=${ok.length} FAIL=${failed.length} ms=${Date.now() - t0} ===`);
  if (failed.length) {
    for (const f of failed) console.log(`  FAIL ${f.name}: ${f.detail}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(2);
});
