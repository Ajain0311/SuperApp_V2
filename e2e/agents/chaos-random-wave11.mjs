/**
 * Wave-11 random chaos: multi-hotel checkout COD/ONLINE/coupon edges,
 * IDOR food-order detail, vendor category create junk, captain pickup
 * without accept, mock-complete payment junk, SignalR-ish unknown paths,
 * address PUT unicode/pin, marketplace my-offers pagination, burst
 * verify-otp wrong codes, restaurant closed place, driver active-ride
 * while offline, webhook/easebuzz probes, reviews GET filters.
 * Usage: node e2e/agents/chaos-random-wave11.mjs [seed]
 */
const BASE = process.env.API_BASE_URL || 'https://makemytree.duckdns.org';
const OTP = process.env.TEST_OTP || '123456';
const SEED = parseInt(process.argv[2] || process.env.CHAOS_SEED || String(Date.now() % 1e9), 10);

const CUSTOMER = '7014065979';
const CUSTOMER_B = '9123456780';
const OWNER = '9900000004';
const CAPTAIN = '6375002348';
const DUMMIES = Array.from({ length: 8 }, (_, i) => String(9000001301 + i));

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

async function api(method, path, { token, body, rawBody, contentType } = {}) {
  const headers = { ...(token ? { Authorization: `Bearer ${token}` } : {}) };
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
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text.slice(0, 240) }; }
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
  console.log(`CHAOS-W11 seed=${SEED} BASE=${BASE}`);
  const t0 = Date.now();
  const tokens = {};
  const addrs = {};
  const tracked = [];

  const actors = [CUSTOMER, CUSTOMER_B, OWNER, CAPTAIN, ...DUMMIES];
  const boot = await mapPool(actors, 8, async (m, idx) => {
    const token = await login(m);
    const addressId = await ensureAddress(token, `W11 ${SEED} ${idx}`);
    return { m, token, addressId };
  });
  for (const b of boot) {
    tokens[b.m] = b.token;
    addrs[b.m] = b.addressId;
  }
  pass('W11-B01 bootstrap', `n=${actors.length}`);
  await api('POST', '/api/vendor/toggle-status', { token: tokens[OWNER], body: { isOpen: true } });
  await api('POST', '/api/driver/toggle-online', { token: tokens[CAPTAIN], body: { isOnline: true } });

  const foods = unwrapList((await api('GET', '/api/restaurants/foods?pageSize=100', { token: tokens[CUSTOMER] })).json);
  const byRest = new Map();
  for (const f of foods) {
    if (!f?.id || !f.restaurantId) continue;
    if (!byRest.has(f.restaurantId)) byRest.set(f.restaurantId, f);
  }
  const foodR2 = foods.find((f) => f.restaurantId === 2) || foods[0];
  const otherFood = [...byRest.values()].find((f) => f.restaurantId !== foodR2.restaurantId) || foods.find((f) => f.id !== foodR2.id);
  if (!foodR2?.id) { fail('W11-C01 foods', 'none'); process.exit(1); }
  pass('W11-C01 foods', `n=${foods.length} hotels=${byRest.size}`);

  // --- Multi-hotel checkout edges ---
  {
    if (otherFood?.id) {
      const multiCod = await api('POST', '/api/FoodOrders/checkout', {
        token: tokens[CUSTOMER],
        body: {
          addressId: addrs[CUSTOMER],
          paymentMethod: 'COD',
          notes: `W11-multi-${SEED}`,
          items: [
            { foodItemId: foodR2.id, quantity: 1 },
            { foodItemId: otherFood.id, quantity: 1 },
          ],
        },
      });
      expectStatus('W11-MH01 multi COD', multiCod.status, [200, 400], '');
      if (multiCod.status === 200) {
        const orders = multiCod.json?.data?.orders || multiCod.json?.data?.Orders || [];
        for (const o of orders) {
          if (o?.id) tracked.push({ id: o.id, token: tokens[CUSTOMER] });
        }
      }

      const multiOnline = await api('POST', '/api/FoodOrders/checkout', {
        token: tokens[CUSTOMER],
        body: {
          addressId: addrs[CUSTOMER],
          paymentMethod: 'ONLINE',
          items: [
            { foodItemId: foodR2.id, quantity: 1 },
            { foodItemId: otherFood.id, quantity: 1 },
          ],
        },
      });
      expectStatus('W11-MH02 multi ONLINE block', multiOnline.status, [400], '');

      const multiCoupon = await api('POST', '/api/FoodOrders/checkout', {
        token: tokens[CUSTOMER],
        body: {
          addressId: addrs[CUSTOMER],
          paymentMethod: 'COD',
          couponCode: 'SAVE50',
          items: [
            { foodItemId: foodR2.id, quantity: 1 },
            { foodItemId: otherFood.id, quantity: 1 },
          ],
        },
      });
      expectStatus('W11-MH03 multi coupon block', multiCoupon.status, [400], '');
    } else {
      pass('W11-MH skip', 'single hotel only');
    }

    const empty = await api('POST', '/api/FoodOrders/checkout', {
      token: tokens[CUSTOMER],
      body: { addressId: addrs[CUSTOMER], paymentMethod: 'COD', items: [] },
    });
    expectStatus('W11-MH04 empty cart', empty.status, [400], '');

    const stealAddr = await api('POST', '/api/FoodOrders/checkout', {
      token: tokens[CUSTOMER_B],
      body: {
        addressId: addrs[CUSTOMER],
        paymentMethod: 'COD',
        items: [{ foodItemId: foodR2.id, quantity: 1 }],
      },
    });
    expectStatus('W11-MH05 stolen address', stealAddr.status, [403, 400], '');
  }

  // --- IDOR food order detail ---
  {
    const place = await api('POST', '/api/FoodOrders', {
      token: tokens[CUSTOMER],
      body: {
        restaurantId: Number(foodR2.restaurantId),
        addressId: addrs[CUSTOMER],
        paymentMethod: 'COD',
        notes: `W11-idor-${SEED}`,
        items: [{ foodItemId: foodR2.id, quantity: 1 }],
      },
    });
    expectStatus('W11-I01 place', place.status, 200, '');
    if (place.status === 200) {
      const oid = place.json.data.id;
      tracked.push({ id: oid, token: tokens[CUSTOMER] });
      const self = await api('GET', `/api/FoodOrders/${oid}`, { token: tokens[CUSTOMER] });
      expectStatus('W11-I02 self get', self.status, 200, '');
      const other = await api('GET', `/api/FoodOrders/${oid}`, { token: tokens[CUSTOMER_B] });
      expectStatus('W11-I03 IDOR get', other.status, [403, 404], '');
      const cap = await api('GET', `/api/FoodOrders/${oid}`, { token: tokens[CAPTAIN] });
      expectStatus('W11-I04 captain get', cap.status, [200, 403, 404], '');
      const cancelOther = await api('POST', `/api/FoodOrders/${oid}/cancel`, {
        token: tokens[CUSTOMER_B],
        body: {},
      });
      expectStatus('W11-I05 IDOR cancel', cancelOther.status, [403, 404], '');
    }
  }

  // --- Vendor category create junk ---
  {
    const cases = [
      {},
      { name: '' },
      { name: 'W11 cat ' + SEED },
      { name: 'x'.repeat(500) },
      { name: '<script>alert(1)</script>' },
      { name: "'; DROP TABLE categories;--" },
    ];
    for (let i = 0; i < cases.length; i++) {
      const r = await api('POST', '/api/vendor/categories', { token: tokens[OWNER], body: cases[i] });
      expectStatus(`W11-VC${i} category`, r.status, [200, 201, 400, 409, 422], '');
    }
    const cust = await api('POST', '/api/vendor/categories', {
      token: tokens[CUSTOMER],
      body: { name: 'hack' },
    });
    expectStatus('W11-VC cust', cust.status, [401, 403], '');
  }

  // --- Captain pickup without accept ---
  {
    const place = await api('POST', '/api/FoodOrders', {
      token: tokens[CUSTOMER_B],
      body: {
        restaurantId: Number(foodR2.restaurantId),
        addressId: addrs[CUSTOMER_B],
        paymentMethod: 'COD',
        notes: `W11-nopick-${SEED}`,
        items: [{ foodItemId: foodR2.id, quantity: 1 }],
      },
    });
    expectStatus('W11-CP01 place', place.status, 200, '');
    if (place.status === 200) {
      const oid = place.json.data.id;
      tracked.push({ id: oid, token: tokens[CUSTOMER_B] });
      await api('PUT', `/api/vendor/orders/${oid}/status`, { token: tokens[OWNER], body: { status: 'ACCEPTED' } });
      await api('PUT', `/api/vendor/orders/${oid}/status`, { token: tokens[OWNER], body: { status: 'READY' } });
      const pick = await api('POST', `/api/driver/food-orders/${oid}/pickup`, {
        token: tokens[CAPTAIN],
        body: {},
      });
      expectStatus('W11-CP02 pickup w/o accept', pick.status, [400, 403, 404, 409], '');
      const del = await api('POST', `/api/driver/food-orders/${oid}/deliver`, {
        token: tokens[CAPTAIN],
        body: {},
      });
      expectStatus('W11-CP03 deliver w/o accept', del.status, [400, 403, 404, 409], '');
    }
  }

  // --- Payment mock-complete / webhook junk ---
  {
    const mocks = [
      {},
      { transactionId: 'nope' },
      { orderId: 'x', transactionId: 'y' },
      { transactionId: 'z'.repeat(400) },
    ];
    for (let i = 0; i < mocks.length; i++) {
      const r = await api('POST', '/api/payments/mock-complete', { token: tokens[CUSTOMER], body: mocks[i] });
      expectStatus(`W11-PM${i} mock`, r.status, [200, 400, 403, 404, 422], '');
    }
    const wh = await api('POST', '/api/payments/webhook', { body: { event: 'payment.success', id: String(SEED) } });
    expectStatus('W11-PM webhook', wh.status, [200, 400, 401, 403, 404, 422], '');
    const er = await api('GET', '/api/payments/easebuzz-return?status=success');
    expectStatus('W11-PM easebuzz GET', er.status, [200, 302, 400, 404], '');
    const kit = await api('GET', '/api/payments/kit', { token: tokens[CUSTOMER] });
    expectStatus('W11-PM kit', kit.status, [200, 401], '');
  }

  // --- Unknown / hub paths (no 500) ---
  {
    const paths = [
      ['GET', '/api/does-not-exist'],
      ['POST', '/api/null'],
      ['GET', '/hubs/ride'],
      ['GET', '/swagger/v1/swagger.json'],
      ['GET', '/api/../etc/passwd'],
      ['GET', '/api/FoodOrders/%00'],
    ];
    for (let i = 0; i < paths.length; i++) {
      const [method, path] = paths[i];
      const r = await api(method, path, { token: tokens[CUSTOMER], body: method === 'POST' ? {} : undefined });
      if (r.status >= 500) fail(`W11-H${i} ${path}`, `status=${r.status}`);
      else pass(`W11-H${i} ${path}`, `status=${r.status}`);
    }
  }

  // --- Address PUT unicode / pin ---
  {
    const id = addrs[DUMMIES[0]];
    const bodies = [
      { label: ' घर ', addressLine1: 'मार्ग १२', city: 'Jaipur', state: 'Rajasthan', pinCode: '302001' },
      { label: 'Home', addressLine1: 'A'.repeat(2000), city: 'Jaipur', state: 'Rajasthan', pinCode: '302001' },
      { label: 'Home', addressLine1: 'X', city: 'Jaipur', state: 'Rajasthan', pinCode: '12' },
      { label: 'Home', addressLine1: 'X', city: 'Jaipur', state: 'Rajasthan', pinCode: 'abcdef' },
      { label: 'Home', addressLine1: 'X', city: 'Jaipur', state: 'Rajasthan', pinCode: '302001', latitude: 26.9, longitude: 75.8 },
    ];
    for (let i = 0; i < bodies.length; i++) {
      const r = await api('PUT', `/api/addresses/${id}`, { token: tokens[DUMMIES[0]], body: bodies[i] });
      expectStatus(`W11-A${i} put`, r.status, [200, 400, 422], '');
    }
    const foreign = await api('PUT', `/api/addresses/${addrs[CUSTOMER]}`, {
      token: tokens[DUMMIES[1]],
      body: { label: 'steal', addressLine1: 'X', city: 'Jaipur', state: 'Rajasthan', pinCode: '302001' },
    });
    expectStatus('W11-A foreign put', foreign.status, [403, 404], '');
  }

  // --- Marketplace my-offers / my-listings ---
  {
    const mine = await api('GET', '/api/marketplace/my-listings', { token: tokens[CUSTOMER] });
    expectStatus('W11-M my-listings', mine.status, [200], '');
    const offers = await api('GET', '/api/marketplace/my-offers', { token: tokens[CUSTOMER] });
    expectStatus('W11-M my-offers', offers.status, [200], '');
    const favs = await api('GET', '/api/marketplace/favorites', { token: tokens[CUSTOMER] });
    expectStatus('W11-M favorites', favs.status, [200], '');
    const qs = ['?page=-1', '?page=1&pageSize=0', '?page=1&pageSize=9999'];
    for (const q of qs) {
      const r = await api('GET', `/api/marketplace${q}`, { token: tokens[CUSTOMER] });
      expectStatus(`W11-M list${q}`, r.status, [200, 400], '');
    }
  }

  // --- Burst wrong OTP (no 500) ---
  {
    const mobile = DUMMIES[2];
    await api('POST', '/api/auth/send-otp', { body: { mobileNumber: mobile } });
    const storm = await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        api('POST', '/api/auth/verify-otp', { body: { mobileNumber: mobile, otpCode: String(100000 + i) } }),
      ),
    );
    const bad = storm.filter((s) => s.status >= 500);
    if (bad.length === 0) pass('W11-OTP wrong burst', storm.map((s) => s.status).join(','));
    else fail('W11-OTP wrong burst', bad.map((s) => s.status).join(','));
  }

  // --- Restaurant closed place ---
  {
    await api('POST', '/api/vendor/toggle-status', { token: tokens[OWNER], body: { isOpen: false } });
    const closed = await api('POST', '/api/FoodOrders', {
      token: tokens[CUSTOMER],
      body: {
        restaurantId: Number(foodR2.restaurantId),
        addressId: addrs[CUSTOMER],
        paymentMethod: 'COD',
        notes: `W11-closed-${SEED}`,
        items: [{ foodItemId: foodR2.id, quantity: 1 }],
      },
    });
    expectStatus('W11-CL closed place', closed.status, [400, 409, 422], '');
    if (closed.status === 200) tracked.push({ id: closed.json.data.id, token: tokens[CUSTOMER] });
    await api('POST', '/api/vendor/toggle-status', { token: tokens[OWNER], body: { isOpen: true } });
  }

  // --- Driver active-ride / active-food while offline ---
  {
    await api('POST', '/api/driver/toggle-online', { token: tokens[CAPTAIN], body: { isOnline: false } });
    const ar = await api('GET', '/api/driver/active-ride', { token: tokens[CAPTAIN] });
    expectStatus('W11-DR active-ride offline', ar.status, [200, 204, 404], '');
    const af = await api('GET', '/api/driver/active-food-order', { token: tokens[CAPTAIN] });
    expectStatus('W11-DR active-food offline', af.status, [200, 204, 404], '');
    const avail = await api('GET', '/api/driver/available-rides', { token: tokens[CAPTAIN] });
    expectStatus('W11-DR avail rides offline', avail.status, [200, 400], '');
    await api('POST', '/api/driver/toggle-online', { token: tokens[CAPTAIN], body: { isOnline: true } });
  }

  // --- Reviews GET filters ---
  {
    const qs = [
      '',
      '?targetType=RESTAURANT&targetId=2',
      '?targetType=HACK&targetId=1',
      '?targetType=RESTAURANT&targetId=-1',
      '?page=-1&pageSize=9999',
    ];
    for (const q of qs) {
      const r = await api('GET', `/api/reviews${q}`, { token: tokens[CUSTOMER] });
      expectStatus(`W11-RV get${q || '(def)'}`, r.status, [200, 400], '');
    }
  }

  // --- Vendor dashboard / earnings as roles ---
  {
    const dash = await api('GET', '/api/vendor/dashboard', { token: tokens[OWNER] });
    expectStatus('W11-VD owner dash', dash.status, [200], '');
    const earn = await api('GET', '/api/vendor/earnings', { token: tokens[OWNER] });
    expectStatus('W11-VD owner earn', earn.status, [200], '');
    const cd = await api('GET', '/api/vendor/dashboard', { token: tokens[CUSTOMER] });
    expectStatus('W11-VD cust dash', cd.status, [401, 403], '');
    const menu = await api('GET', '/api/vendor/menu', { token: tokens[OWNER] });
    expectStatus('W11-VD menu', menu.status, [200], '');
  }

  // --- Profile GET/PUT race-ish ---
  {
    const gets = await Promise.all(
      Array.from({ length: 4 }, () => api('GET', '/api/auth/profile', { token: tokens[CUSTOMER] })),
    );
    const bad = gets.filter((g) => g.status >= 500);
    if (bad.length === 0) pass('W11-PR profile get storm', gets.map((g) => g.status).join(','));
    else fail('W11-PR profile get storm', bad.map((g) => g.status).join(','));
    const put = await api('PUT', '/api/auth/profile', {
      token: tokens[CUSTOMER],
      body: { fullName: `W11 User ${SEED % 10000}` },
    });
    expectStatus('W11-PR put name', put.status, [200, 400], '');
  }

  // cleanup
  await mapPool(tracked, 8, async (o) => {
    try { await api('POST', `/api/FoodOrders/${o.id}/cancel`, { token: o.token, body: {} }); } catch { /* ignore */ }
  });
  await api('POST', '/api/vendor/toggle-status', { token: tokens[OWNER], body: { isOpen: true } });
  await api('POST', '/api/driver/toggle-online', { token: tokens[CAPTAIN], body: { isOnline: true } });

  const failed = results.filter((r) => !r.ok);
  const ok = results.filter((r) => r.ok);
  console.log(`\n=== CHAOS-W11 DONE seed=${SEED} PASS=${ok.length} FAIL=${failed.length} ms=${Date.now() - t0} ===`);
  if (failed.length) {
    for (const f of failed) console.log(`  FAIL ${f.name}: ${f.detail}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(2);
});
