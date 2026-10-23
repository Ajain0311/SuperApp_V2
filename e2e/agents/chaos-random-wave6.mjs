/**
 * Wave-6 random chaos: payment start junk, ride cancel races, vendor food-item
 * authz, profile/me probes, search injection, multi-accept captain race,
 * history pagination, earnings unauth, SignalR-ish path 404s.
 * Usage: node e2e/agents/chaos-random-wave6.mjs [seed]
 */
const BASE = process.env.API_BASE_URL || 'https://makemytree.duckdns.org';
const OTP = process.env.TEST_OTP || '123456';
const SEED = parseInt(process.argv[2] || process.env.CHAOS_SEED || String(Date.now() % 1e9), 10);

const CUSTOMER = '7014065979';
const CUSTOMER_B = '9123456780';
const OWNER = '9900000004';
const CAPTAIN = '6375002348';
const DUMMIES = Array.from({ length: 8 }, (_, i) => String(9000000801 + i));

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
  console.log(`CHAOS-W6 seed=${SEED} BASE=${BASE}`);
  const t0 = Date.now();
  const tokens = {};
  const addrs = {};
  const tracked = [];

  const actors = [CUSTOMER, CUSTOMER_B, OWNER, CAPTAIN, ...DUMMIES];
  const boot = await mapPool(actors, 8, async (m, idx) => {
    const token = await login(m);
    const addressId = await ensureAddress(token, `W6 ${SEED} ${idx}`);
    return { m, token, addressId };
  });
  for (const b of boot) {
    tokens[b.m] = b.token;
    addrs[b.m] = b.addressId;
  }
  pass('W6-B01 bootstrap', `n=${actors.length}`);

  // Ensure owner restaurant open
  await api('POST', '/api/vendor/toggle-status', { token: tokens[OWNER], body: { isOpen: true } });

  const foods = unwrapList((await api('GET', '/api/restaurants/foods?pageSize=80', { token: tokens[CUSTOMER] })).json);
  const byRest = new Map();
  for (const f of foods) if (f?.restaurantId && f?.id) byRest.set(f.restaurantId, f);
  const foodR2 = byRest.get(2) || foods[0];
  if (!foodR2?.id) { fail('W6-C01', 'no foods'); process.exit(1); }
  pass('W6-C01 foods', `${foods.length} r=${foodR2.restaurantId}`);

  // ---- S: Search / query injection ----
  {
    const q = [
      `search=${encodeURIComponent("'; DROP TABLE--")}`,
      `search=${encodeURIComponent('<img src=x onerror=alert(1)>')}`,
      `search=${encodeURIComponent('🍕'.repeat(20))}`,
      `minPrice=-1&maxPrice=0`,
      `minPrice=999999&maxPrice=1`,
    ];
    for (const qs of q) {
      const r = await api('GET', `/api/marketplace?${qs}`, { token: tokens[CUSTOMER] });
      expectStatus(`W6-S ${qs.slice(0, 40)}`, r.status, [200, 400], '');
    }
    const foodQ = await api('GET', `/api/restaurants/foods?search=${encodeURIComponent("a' OR '1'='1")}`, { token: tokens[CUSTOMER] });
    expectStatus('W6-S food search inject', foodQ.status, [200, 400], '');
  }

  // ---- P: Payment start junk ----
  {
    const place = await api('POST', '/api/FoodOrders', {
      token: tokens[CUSTOMER],
      body: {
        restaurantId: Number(foodR2.restaurantId),
        addressId: addrs[CUSTOMER],
        paymentMethod: 'ONLINE',
        notes: `W6-pay-${SEED}`,
        items: [{ foodItemId: foodR2.id, quantity: 1 }],
      },
    });
    expectStatus('W6-P01 ONLINE place', place.status, [200, 400], '');
    if (place.status === 200 && place.json?.data?.id) {
      const oid = place.json.data.id;
      tracked.push({ id: oid, token: tokens[CUSTOMER] });

      const pay = await api('POST', `/api/FoodOrders/${oid}/pay`, { token: tokens[CUSTOMER], body: {} });
      expectStatus('W6-P02 start pay', pay.status, [200, 400, 404, 502], '');

      const payB = await api('POST', `/api/FoodOrders/${oid}/pay`, { token: tokens[CUSTOMER_B], body: {} });
      expectStatus('W6-P03 cross-user pay', payB.status, [403, 404], '');

      const payFake = await api('POST', `/api/FoodOrders/999999999/pay`, { token: tokens[CUSTOMER], body: {} });
      expectStatus('W6-P04 pay missing order', payFake.status, [404], '');

      await api('POST', `/api/FoodOrders/${oid}/cancel`, { token: tokens[CUSTOMER], body: {} });
    }

    const ease = await api('POST', '/api/payments/easebuzz-return', {
      body: { txnid: `fake-${SEED}`, status: 'success', amount: '1' },
    });
    expectStatus('W6-P10 easebuzz return junk', ease.status, [200, 400, 401, 403, 404, 405], '');
  }

  // ---- C: Dual captain accept race on READY order ----
  {
    const place = await api('POST', '/api/FoodOrders', {
      token: tokens[CUSTOMER],
      body: {
        restaurantId: Number(foodR2.restaurantId),
        addressId: addrs[CUSTOMER],
        paymentMethod: 'COD',
        notes: `W6-dualcap-${SEED}`,
        items: [{ foodItemId: foodR2.id, quantity: 1 }],
      },
    });
    if (place.status === 200) {
      const oid = place.json.data.id;
      tracked.push({ id: oid, token: tokens[CUSTOMER] });
      await api('PUT', `/api/vendor/orders/${oid}/status`, { token: tokens[OWNER], body: { status: 'ACCEPTED' } });
      await api('PUT', `/api/vendor/orders/${oid}/status`, { token: tokens[OWNER], body: { status: 'READY' } });
      await api('POST', '/api/driver/toggle-online', { token: tokens[CAPTAIN], body: { isOnline: true } });

      const [a1, a2] = await Promise.all([
        api('POST', `/api/driver/food-orders/${oid}/accept`, { token: tokens[CAPTAIN], body: {} }),
        api('POST', `/api/driver/food-orders/${oid}/accept`, { token: tokens[CAPTAIN], body: {} }),
      ]);
      const codes = [a1.status, a2.status].sort();
      // 200+409 ideal; both 409 OK when captain already has active assignment / race lost
      const ok = codes.every((c) => [200, 400, 409, 403].includes(c))
        && !(codes[0] === 200 && codes[1] === 200);
      if (ok) pass('W6-C10 dual captain accept', codes.join(','));
      else fail('W6-C10 dual captain accept', codes.join(','));

      await api('POST', `/api/FoodOrders/${oid}/cancel`, { token: tokens[CUSTOMER], body: {} });
    }
  }

  // ---- R: Ride list / history / cancel edges ----
  {
    const list = await api('GET', '/api/rides', { token: tokens[CUSTOMER] });
    expectStatus('W6-R01 rides list', list.status, [200], '');

    const hist = await api('GET', '/api/driver/history', { token: tokens[CAPTAIN] });
    expectStatus('W6-R02 driver history', hist.status, [200], '');

    const earn = await api('GET', '/api/driver/earnings', { token: tokens[CAPTAIN] });
    expectStatus('W6-R03 driver earnings', earn.status, [200], '');

    const earnC = await api('GET', '/api/driver/earnings', { token: tokens[CUSTOMER] });
    expectStatus('W6-R04 customer earnings', earnC.status, [401, 403], '');

    const cancelMissing = await api('POST', '/api/rides/999999/cancel', { token: tokens[CUSTOMER], body: {} });
    expectStatus('W6-R05 cancel missing ride', cancelMissing.status, [404, 400], '');

    const completeFake = await api('POST', '/api/rides/999999/complete', { token: tokens[CAPTAIN], body: {} });
    expectStatus('W6-R06 complete missing', completeFake.status, [403, 404], '');
  }

  // ---- V: Vendor food-item create authz / junk ----
  {
    const bad = await api('POST', '/api/vendor/food-items', {
      token: tokens[CUSTOMER],
      body: { name: 'Hack', price: 10, categoryId: 1 },
    });
    // Non-owner GetAuthorizedRestaurant → 404 "Restaurant not found" (no leak)
    expectStatus('W6-V01 customer create item', bad.status, [401, 403, 404], '');

    const cat = await api('POST', '/api/vendor/categories', {
      token: tokens[OWNER],
      body: { name: '' },
    });
    expectStatus('W6-V02 empty category', cat.status, [400, 422], '');

    const earn = await api('GET', '/api/vendor/earnings', { token: tokens[OWNER] });
    expectStatus('W6-V03 vendor earnings', earn.status, [200], '');

    const earnX = await api('GET', '/api/vendor/earnings', { token: tokens[CAPTAIN] });
    expectStatus('W6-V04 captain vendor earnings', earnX.status, [401, 403, 404], '');
  }

  // ---- H: Hub / unknown paths ----
  {
    const paths = [
      '/api/does-not-exist',
      '/hubs/orderstatus',
      '/api/../etc/passwd',
      '/api/FoodOrders/NaN',
      '/api/FoodOrders/1;drop',
    ];
    for (const p of paths) {
      const r = await api('GET', p, { token: tokens[CUSTOMER] });
      expectStatus(`W6-H ${p}`, r.status, [400, 401, 403, 404], '');
    }
  }

  // ---- A: Address update / pin edges ----
  {
    const pins = ['000000', '999999', '302001', '110001'];
    for (const pin of pins) {
      const r = await api('POST', '/api/addresses', {
        token: tokens[CUSTOMER_B],
        body: {
          label: `Pin${pin}`,
          addressLine1: `W6 pin ${SEED}`,
          city: 'Jaipur',
          state: 'Rajasthan',
          pinCode: pin,
          isDefault: false,
        },
      });
      expectStatus(`W6-A pin ${pin}`, r.status, [200, 400], '');
    }
    const badPin = await api('POST', '/api/addresses', {
      token: tokens[CUSTOMER_B],
      body: {
        label: 'Bad',
        addressLine1: 'x',
        city: 'Jaipur',
        state: 'Rajasthan',
        pinCode: '12',
        isDefault: false,
      },
    });
    expectStatus('W6-A bad pin 12', badPin.status, [400, 422], '');
  }

  // ---- M: Marketplace my-listings / offer status junk ----
  {
    const mine = await api('GET', '/api/marketplace/my-listings', { token: tokens[CUSTOMER] });
    expectStatus('W6-M01 my-listings', mine.status, [200], '');

    const offers = await api('GET', '/api/marketplace/my-offers', { token: tokens[CUSTOMER] });
    expectStatus('W6-M02 my-offers', offers.status, [200], '');

    const st = await api('PUT', '/api/marketplace/offers/999999/status', {
      token: tokens[CUSTOMER],
      body: { status: 'ACCEPTED' },
    });
    expectStatus('W6-M03 offer status missing', st.status, [400, 403, 404], '');
  }

  // ---- Q: Burst send-otp (should not 500) ----
  {
    const mobiles = DUMMIES.slice(0, 5);
    const storm = await Promise.all(
      mobiles.map((m) => api('POST', '/api/auth/send-otp', { body: { mobileNumber: m } })),
    );
    const bad = storm.filter((s) => s.status >= 500);
    if (bad.length === 0) pass('W6-Q01 send-otp burst', storm.map((s) => s.status).join(','));
    else fail('W6-Q01 send-otp burst', storm.map((s) => s.status).join(','));
  }

  await mapPool(tracked, 6, async (o) => {
    try { await api('POST', `/api/FoodOrders/${o.id}/cancel`, { token: o.token, body: {} }); } catch { /* ignore */ }
  });

  const failed = results.filter((r) => !r.ok);
  const ok = results.filter((r) => r.ok);
  console.log(`\n=== CHAOS-W6 DONE seed=${SEED} PASS=${ok.length} FAIL=${failed.length} ms=${Date.now() - t0} ===`);
  if (failed.length) {
    for (const f of failed) console.log(`  FAIL ${f.name}: ${f.detail}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(2);
});
