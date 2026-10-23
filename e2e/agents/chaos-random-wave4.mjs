/**
 * Wave-4 random chaos: JWT/bearer fuzz, unicode/injection, status-skip,
 * cross-user address theft, Content-Type/method weirdness, pagination extremes,
 * duplicate cart lines, captain pickup-without-accept, vendor skip DELIVERED.
 * Usage: node e2e/agents/chaos-random-wave4.mjs [seed]
 */
const BASE = process.env.API_BASE_URL || 'https://makemytree.duckdns.org';
const OTP = process.env.TEST_OTP || '123456';
const SEED = parseInt(process.argv[2] || process.env.CHAOS_SEED || String(Date.now() % 1e9), 10);

const CUSTOMER = '7014065979';
const CUSTOMER_B = '9123456780';
const OWNER = '9900000004';
const CAPTAIN = '6375002348';
const DUMMIES = Array.from({ length: 8 }, (_, i) => String(9000000601 + i));

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

async function api(method, path, { token, body, rawBody, contentType, authHeader } = {}) {
  const headers = {};
  if (authHeader !== undefined) headers.Authorization = authHeader;
  else if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (rawBody !== undefined) {
    if (contentType !== undefined) headers['Content-Type'] = contentType;
    else headers['Content-Type'] = 'application/json';
    payload = rawBody;
  } else if (body !== undefined) {
    headers['Content-Type'] = contentType || 'application/json';
    payload = typeof body === 'string' ? body : JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${path}`, { method, headers, body: payload });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text.slice(0, 200) }; }
  return { status: res.status, json, text };
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
  console.log(`CHAOS-W4 seed=${SEED} BASE=${BASE}`);
  const t0 = Date.now();
  const tokens = {};
  const addrs = {};
  const tracked = [];

  // ---- T: Token / bearer fuzz (before bootstrap needs) ----
  {
    const fake = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIn0.deadbeef';
    const r1 = await api('GET', '/api/FoodOrders', { token: fake });
    expectStatus('W4-T01 forged jwt', r1.status, [401, 403], '');

    const r2 = await api('GET', '/api/FoodOrders', { authHeader: `Bearer ${'x'.repeat(500)}` });
    expectStatus('W4-T02 huge garbage bearer', r2.status, [401, 403], '');

    const r3 = await api('GET', '/api/FoodOrders', { authHeader: 'Basic dXNlcjpwYXNz' });
    expectStatus('W4-T03 basic auth scheme', r3.status, [401, 403], '');

    const r4 = await api('GET', '/api/FoodOrders', { authHeader: 'Bearer' });
    expectStatus('W4-T04 bearer no token', r4.status, [401, 403], '');

    const r5 = await api('GET', '/api/FoodOrders', { authHeader: `Token ${fake}` });
    expectStatus('W4-T05 Token scheme', r5.status, [401, 403], '');

    const r6 = await api('GET', '/api/addresses', { token: 'null' });
    expectStatus('W4-T06 literal null token', r6.status, [401, 403], '');
  }

  // ---- Bootstrap ----
  const actors = [CUSTOMER, CUSTOMER_B, OWNER, CAPTAIN, ...DUMMIES];
  const boot = await mapPool(actors, 8, async (m, idx) => {
    const token = await login(m);
    const addressId = await ensureAddress(token, `W4 ${SEED} ${idx}`);
    return { m, token, addressId };
  });
  for (const b of boot) {
    tokens[b.m] = b.token;
    addrs[b.m] = b.addressId;
  }
  pass('W4-B01 bootstrap', `n=${actors.length}`);

  // Tamper: truncate real token
  {
    const t = tokens[CUSTOMER];
    const cut = t.slice(0, Math.max(10, Math.floor(t.length * 0.5)));
    const r = await api('GET', '/api/FoodOrders', { token: cut });
    expectStatus('W4-T10 truncated real jwt', r.status, [401, 403], '');
  }

  const foods = unwrapList((await api('GET', '/api/restaurants/foods?pageSize=80', { token: tokens[CUSTOMER] })).json);
  const byRest = new Map();
  for (const f of foods) if (f?.restaurantId && f?.id) byRest.set(f.restaurantId, f);
  const foodR2 = byRest.get(2) || foods[0];
  if (!foodR2?.id) { fail('W4-C01 foods', 'empty'); process.exit(1); }
  pass('W4-C01 foods', `n=${foods.length} r2=${foodR2.id}`);

  // ---- M: Method / Content-Type weirdness ----
  {
    // fetch forbids GET+body; probe via raw Request-like path using POST-as-wrong and OPTIONS
    try {
      await fetch(`${BASE}/api/FoodOrders`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${tokens[CUSTOMER]}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ unexpected: true }),
      });
      fail('W4-M01 GET with body', 'fetch allowed GET body (unexpected)');
    } catch (e) {
      pass('W4-M01 GET with body blocked by client', String(e.message || e).slice(0, 80));
    }

    const opt = await api('OPTIONS', '/api/FoodOrders', { token: tokens[CUSTOMER] });
    expectStatus('W4-M01b OPTIONS FoodOrders', opt.status, [200, 204, 404, 405], '');

    const r2 = await api('POST', '/api/FoodOrders', {
      token: tokens[CUSTOMER],
      rawBody: JSON.stringify({
        restaurantId: Number(foodR2.restaurantId),
        addressId: addrs[CUSTOMER],
        paymentMethod: 'COD',
        items: [{ foodItemId: foodR2.id, quantity: 1 }],
      }),
      contentType: 'text/plain',
    });
    expectStatus('W4-M02 place text/plain CT', r2.status, [400, 415, 500], '');

    const r3 = await api('POST', '/api/FoodOrders', {
      token: tokens[CUSTOMER],
      rawBody: JSON.stringify({
        restaurantId: Number(foodR2.restaurantId),
        addressId: addrs[CUSTOMER],
        paymentMethod: 'COD',
        items: [{ foodItemId: foodR2.id, quantity: 1 }],
      }),
      contentType: '',
    });
    expectStatus('W4-M03 place empty CT', r3.status, [200, 400, 415], '');
    if (r3.status === 200 && r3.json?.data?.id) tracked.push({ id: r3.json.data.id, token: tokens[CUSTOMER] });

    const r4 = await api('DELETE', `/api/FoodOrders/${tracked[0]?.id || 1}`, { token: tokens[CUSTOMER] });
    expectStatus('W4-M04 DELETE order (should not allow)', r4.status, [404, 405, 401, 403], '');

    const r5 = await api('PATCH', `/api/vendor/orders/1/status`, {
      token: tokens[OWNER],
      body: { status: 'ACCEPTED' },
    });
    expectStatus('W4-M05 PATCH vendor status', r5.status, [404, 405], '');
  }

  // ---- P: Pagination extremes ----
  {
    const q = [
      ['page=-1&pageSize=10', [200, 400]],
      ['page=0&pageSize=0', [200, 400]],
      ['page=1&pageSize=99999', [200, 400]],
      ['page=999999&pageSize=20', [200]],
      ['pageSize=abc', [200, 400]],
    ];
    for (const [qs, want] of q) {
      const r = await api('GET', `/api/restaurants/foods?${qs}`, { token: tokens[CUSTOMER] });
      expectStatus(`W4-P foods ${qs}`, r.status, want, '');
    }
    const mp = await api('GET', '/api/marketplace?page=-5&pageSize=-1', { token: tokens[CUSTOMER] });
    expectStatus('W4-P marketplace neg page', mp.status, [200, 400], '');
  }

  // ---- U: Unicode / injection in notes & address ----
  {
    const payloads = [
      `W4 emoji 🍕🔥 seed=${SEED}`,
      `W4 <script>alert(1)</script>`,
      `W4 '; DROP TABLE food_orders;--`,
      `W4 ${'न'.repeat(40)}`,
      `W4 zero\u0000width`,
    ];
    for (let i = 0; i < payloads.length; i++) {
      const notes = payloads[i];
      const r = await api('POST', '/api/FoodOrders', {
        token: tokens[CUSTOMER],
        body: {
          restaurantId: Number(foodR2.restaurantId),
          addressId: addrs[CUSTOMER],
          paymentMethod: 'COD',
          notes,
          items: [{ foodItemId: foodR2.id, quantity: 1 }],
        },
      });
      expectStatus(`W4-U0${i + 1} notes fuzz`, r.status, [200, 400], notes.slice(0, 40));
      if (r.status === 200 && r.json?.data?.id) {
        tracked.push({ id: r.json.data.id, token: tokens[CUSTOMER] });
        await api('POST', `/api/FoodOrders/${r.json.data.id}/cancel`, { token: tokens[CUSTOMER], body: {} });
      }
    }

    const addr = await api('POST', '/api/addresses', {
      token: tokens[CUSTOMER_B],
      body: {
        label: `💉${SEED}`,
        addressLine1: `Lane <b>${SEED}</b>`,
        city: 'Jaipur',
        state: 'Rajasthan',
        pinCode: '302017',
        isDefault: false,
      },
    });
    expectStatus('W4-U10 xss label address', addr.status, [200, 400], '');
  }

  // ---- X: Cross-user address theft ----
  {
    const place = await api('POST', '/api/FoodOrders', {
      token: tokens[CUSTOMER],
      body: {
        restaurantId: Number(foodR2.restaurantId),
        addressId: addrs[CUSTOMER_B],
        paymentMethod: 'COD',
        notes: `W4-theft-${SEED}`,
        items: [{ foodItemId: foodR2.id, quantity: 1 }],
      },
    });
    // Must not silently use another user's address
    expectStatus('W4-X01 place with foreign addressId', place.status, [400, 403, 404], place.json?.message || '');
    if (place.status === 200 && place.json?.data?.id) {
      tracked.push({ id: place.json.data.id, token: tokens[CUSTOMER] });
      fail('W4-X01b foreign address accepted', `order=${place.json.data.id}`);
    }
  }

  // ---- D: Duplicate / weird cart lines ----
  {
    const r = await api('POST', '/api/FoodOrders', {
      token: tokens[CUSTOMER],
      body: {
        restaurantId: Number(foodR2.restaurantId),
        addressId: addrs[CUSTOMER],
        paymentMethod: 'COD',
        notes: `W4-dup-${SEED}`,
        items: [
          { foodItemId: foodR2.id, quantity: 1 },
          { foodItemId: foodR2.id, quantity: 2 },
          { foodItemId: foodR2.id, quantity: 1 },
        ],
      },
    });
    expectStatus('W4-D01 duplicate item lines', r.status, [200, 400], '');
    if (r.status === 200 && r.json?.data?.id) {
      tracked.push({ id: r.json.data.id, token: tokens[CUSTOMER] });
      await api('POST', `/api/FoodOrders/${r.json.data.id}/cancel`, { token: tokens[CUSTOMER], body: {} });
    }

    const r2 = await api('POST', '/api/FoodOrders', {
      token: tokens[CUSTOMER],
      body: {
        restaurantId: Number(foodR2.restaurantId),
        addressId: addrs[CUSTOMER],
        paymentMethod: 'COD',
        items: [{ foodItemId: foodR2.id, quantity: -3 }],
      },
    });
    expectStatus('W4-D02 negative qty', r2.status, [400, 422], '');

    const r3 = await api('POST', '/api/FoodOrders', {
      token: tokens[CUSTOMER],
      body: {
        restaurantId: Number(foodR2.restaurantId),
        addressId: addrs[CUSTOMER],
        paymentMethod: 'COD',
        items: [{ foodItemId: foodR2.id, quantity: 9999 }],
      },
    });
    expectStatus('W4-D03 huge qty', r3.status, [400, 422], '');
  }

  // ---- S: Vendor status skip / illegal jumps ----
  {
    const place = await api('POST', '/api/FoodOrders', {
      token: tokens[CUSTOMER],
      body: {
        restaurantId: Number(foodR2.restaurantId),
        addressId: addrs[CUSTOMER],
        paymentMethod: 'COD',
        notes: `W4-skip-${SEED}`,
        items: [{ foodItemId: foodR2.id, quantity: 1 }],
      },
    });
    expectStatus('W4-S01 place for skip', place.status, 200, '');
    if (place.status === 200) {
      const oid = place.json.data.id;
      tracked.push({ id: oid, token: tokens[CUSTOMER] });

      const skipDel = await api('PUT', `/api/vendor/orders/${oid}/status`, {
        token: tokens[OWNER],
        body: { status: 'DELIVERED' },
      });
      expectStatus('W4-S02 PENDING→DELIVERED blocked', skipDel.status, [400, 409], '');

      const junk = await api('PUT', `/api/vendor/orders/${oid}/status`, {
        token: tokens[OWNER],
        body: { status: 'YEETED' },
      });
      expectStatus('W4-S03 junk status', junk.status, [400, 422], '');

      const lower = await api('PUT', `/api/vendor/orders/${oid}/status`, {
        token: tokens[OWNER],
        body: { status: 'accepted' },
      });
      expectStatus('W4-S04 lowercase status', lower.status, [200, 400], '');

      await api('POST', `/api/FoodOrders/${oid}/cancel`, { token: tokens[CUSTOMER], body: {} });
    }
  }

  // ---- C: Captain pickup without accept ----
  {
    const place = await api('POST', '/api/FoodOrders', {
      token: tokens[CUSTOMER],
      body: {
        restaurantId: Number(foodR2.restaurantId),
        addressId: addrs[CUSTOMER],
        paymentMethod: 'COD',
        notes: `W4-cap-${SEED}`,
        items: [{ foodItemId: foodR2.id, quantity: 1 }],
      },
    });
    if (place.status === 200) {
      const oid = place.json.data.id;
      tracked.push({ id: oid, token: tokens[CUSTOMER] });
      await api('PUT', `/api/vendor/orders/${oid}/status`, { token: tokens[OWNER], body: { status: 'ACCEPTED' } });
      await api('PUT', `/api/vendor/orders/${oid}/status`, { token: tokens[OWNER], body: { status: 'READY' } });
      await api('POST', '/api/driver/toggle-online', { token: tokens[CAPTAIN], body: { isOnline: true } });

      const pickup = await api('POST', `/api/driver/food-orders/${oid}/pickup`, { token: tokens[CAPTAIN], body: {} });
      expectStatus('W4-C10 pickup without accept', pickup.status, [400, 403, 404, 409], '');

      const deliver = await api('POST', `/api/driver/food-orders/${oid}/deliver`, { token: tokens[CAPTAIN], body: {} });
      expectStatus('W4-C11 deliver without accept', deliver.status, [400, 403, 404, 409], '');

      await api('POST', `/api/FoodOrders/${oid}/cancel`, { token: tokens[CUSTOMER], body: {} });
    }
  }

  // ---- R: Role boundary extras ----
  {
    const r1 = await api('GET', '/api/vendor/orders', { token: tokens[CUSTOMER] });
    expectStatus('W4-R01 customer vendor list', r1.status, [401, 403], '');

    const r2 = await api('GET', '/api/driver/available-food-orders', { token: tokens[CUSTOMER] });
    expectStatus('W4-R02 customer driver food', r2.status, [401, 403], '');

    const r3 = await api('POST', '/api/driver/toggle-online', {
      token: tokens[OWNER],
      body: { isOnline: true },
    });
    expectStatus('W4-R03 owner toggle-online', r3.status, [401, 403], '');

    const r4 = await api('GET', '/api/admin/users', { token: tokens[CUSTOMER] });
    expectStatus('W4-R04 customer admin users', r4.status, [401, 403, 404], '');
  }

  // ---- N: Notifications / coupons junk ----
  {
    const n1 = await api('GET', '/api/notifications', { token: tokens[CUSTOMER] });
    expectStatus('W4-N01 notifications list', n1.status, [200, 404], '');

    const n2 = await api('PUT', '/api/notifications/999999/read', { token: tokens[CUSTOMER], body: {} });
    expectStatus('W4-N02 read missing notif', n2.status, [200, 404], '');

    const c1 = await api('POST', '/api/coupons/validate', {
      token: tokens[CUSTOMER],
      body: { code: `FAKE${SEED}`, restaurantId: 2, orderAmount: 100 },
    });
    expectStatus('W4-N03 coupon validate fake', c1.status, [200, 400, 404], '');

    const c2 = await api('POST', '/api/coupons/validate', {
      token: tokens[CUSTOMER],
      body: { code: '', orderAmount: -50 },
    });
    expectStatus('W4-N04 coupon empty/neg', c2.status, [400, 422], '');
  }

  // Cleanup leftover open orders
  await mapPool(tracked, 6, async (o) => {
    try { await api('POST', `/api/FoodOrders/${o.id}/cancel`, { token: o.token, body: {} }); } catch { /* ignore */ }
  });

  const failed = results.filter((r) => !r.ok);
  const ok = results.filter((r) => r.ok);
  console.log(`\n=== CHAOS-W4 DONE seed=${SEED} PASS=${ok.length} FAIL=${failed.length} ms=${Date.now() - t0} ===`);
  if (failed.length) {
    for (const f of failed) console.log(`  FAIL ${f.name}: ${f.detail}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(2);
});
