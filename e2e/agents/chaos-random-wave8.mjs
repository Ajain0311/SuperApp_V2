/**
 * Wave-8 random chaos: auth profile PUT junk, coupon validate fuzz,
 * notification/device-token races, concurrent default-address flips,
 * food qty/type coercion, ride estimate extremes, offer-on-own-listing,
 * admin route authz, OTP wrong-then-right, vendor menu junk while open,
 * COD pay probe, deliver-without-pickup, banner/config probes.
 * Usage: node e2e/agents/chaos-random-wave8.mjs [seed]
 */
const BASE = process.env.API_BASE_URL || 'https://makemytree.duckdns.org';
const OTP = process.env.TEST_OTP || '123456';
const SEED = parseInt(process.argv[2] || process.env.CHAOS_SEED || String(Date.now() % 1e9), 10);

const CUSTOMER = '7014065979';
const CUSTOMER_B = '9123456780';
const OWNER = '9900000004';
const CAPTAIN = '6375002348';
const DUMMIES = Array.from({ length: 8 }, (_, i) => String(9000001001 + i));

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
  console.log(`CHAOS-W8 seed=${SEED} BASE=${BASE}`);
  const t0 = Date.now();
  const tokens = {};
  const addrs = {};
  const tracked = [];

  const actors = [CUSTOMER, CUSTOMER_B, OWNER, CAPTAIN, ...DUMMIES];
  const boot = await mapPool(actors, 8, async (m, idx) => {
    const token = await login(m);
    const addressId = await ensureAddress(token, `W8 ${SEED} ${idx}`);
    return { m, token, addressId };
  });
  for (const b of boot) {
    tokens[b.m] = b.token;
    addrs[b.m] = b.addressId;
  }
  pass('W8-B01 bootstrap', `n=${actors.length}`);
  await api('POST', '/api/vendor/toggle-status', { token: tokens[OWNER], body: { isOpen: true } });

  const foods = unwrapList((await api('GET', '/api/restaurants/foods?pageSize=80', { token: tokens[CUSTOMER] })).json);
  const byRest = new Map();
  for (const f of foods) if (f?.restaurantId && f?.id) byRest.set(f.restaurantId, f);
  const foodR2 = byRest.get(2) || foods[0];
  if (!foodR2?.id) { fail('W8-C01 foods', 'none'); process.exit(1); }
  pass('W8-C01 foods', `n=${foods.length} r2=${foodR2.restaurantId}`);

  // --- Auth profile PUT junk ---
  {
    const junk = [
      { fullName: '' },
      { fullName: 'x'.repeat(500) },
      { fullName: '😀'.repeat(40), email: 'not-an-email' },
      { fullName: "O'Brien <script>alert(1)</script>", email: `w8${SEED}@example.com` },
      {},
    ];
    for (let i = 0; i < junk.length; i++) {
      const r = await api('PUT', '/api/auth/profile', { token: tokens[CUSTOMER], body: junk[i] });
      expectStatus(`W8-P0${i + 1} profile junk`, r.status, [200, 400, 422], '');
    }
    const get = await api('GET', '/api/auth/profile', { token: tokens[CUSTOMER] });
    expectStatus('W8-P06 profile get', get.status, [200], '');
  }

  // --- Wrong OTP flood then correct ---
  {
    const m = DUMMIES[0];
    await api('POST', '/api/auth/send-otp', { body: { mobileNumber: m } });
    const wrongs = await Promise.all(
      Array.from({ length: 4 }, (_, i) =>
        api('POST', '/api/auth/verify-otp', { body: { mobileNumber: m, otpCode: String(111111 + i) } }),
      ),
    );
    const allReject = wrongs.every((w) => [400, 401, 403, 429].includes(w.status));
    if (allReject) pass('W8-A01 wrong otp flood', wrongs.map((w) => w.status).join(','));
    else fail('W8-A01 wrong otp flood', wrongs.map((w) => w.status).join(','));
    const ok = await api('POST', '/api/auth/verify-otp', { body: { mobileNumber: m, otpCode: OTP } });
    expectStatus('W8-A02 correct after flood', ok.status, [200, 400, 429], '');
  }

  // --- Coupon validate fuzz ---
  {
    const codes = ['', ' ', 'SAVE50', `X${SEED}`, "'; DROP TABLE coupons;--", '🎉', 'a'.repeat(120), null];
    for (let i = 0; i < codes.length; i++) {
      const body = codes[i] === null ? { orderAmount: 100 } : { code: codes[i], orderAmount: 100 };
      const r = await api('POST', '/api/coupons/validate', { token: tokens[CUSTOMER], body });
      expectStatus(`W8-K0${i + 1} coupon`, r.status, [200, 400, 404, 422], '');
    }
  }

  // --- Notifications / device-token ---
  {
    const toks = [
      { token: `w8-dev-${SEED}`, platform: 'android' },
      { token: '', platform: 'ios' },
      { token: 'x'.repeat(600), platform: 'web' },
      { token: `w8-${SEED}`, platform: 'toaster' },
      {},
    ];
    for (let i = 0; i < toks.length; i++) {
      const r = await api('POST', '/api/notifications/device-token', { token: tokens[CUSTOMER], body: toks[i] });
      expectStatus(`W8-N0${i + 1} device-token`, r.status, [200, 201, 400, 422], '');
    }
    const list = await api('GET', '/api/notifications', { token: tokens[CUSTOMER] });
    expectStatus('W8-N06 list', list.status, [200], '');
    const readAll = await api('PUT', '/api/notifications/read-all', { token: tokens[CUSTOMER], body: {} });
    expectStatus('W8-N07 read-all', readAll.status, [200, 204], '');
    const witty = await api('POST', '/api/notifications/witty-alert', {
      token: tokens[CUSTOMER],
      body: { message: `W8 witty ${SEED}` },
    });
    expectStatus('W8-N08 witty', witty.status, [200, 201, 400, 403, 404], '');
  }

  // --- Concurrent default-address flips ---
  {
    const created = await Promise.all(
      Array.from({ length: 3 }, (_, i) =>
        api('POST', '/api/addresses', {
          token: tokens[CUSTOMER_B],
          body: {
            label: `W8D${i}`,
            addressLine1: `W8 default ${SEED} ${i}`,
            city: 'Jaipur',
            state: 'Rajasthan',
            pinCode: '302017',
            isDefault: false,
          },
        }),
      ),
    );
    const ids = created.filter((c) => c.status === 200).map((c) => c.json?.data?.id).filter(Boolean);
    if (ids.length >= 2) {
      const flips = await Promise.all(
        ids.map((id) => api('PUT', `/api/addresses/${id}/default`, { token: tokens[CUSTOMER_B], body: {} })),
      );
      const okN = flips.filter((f) => f.status === 200).length;
      if (okN >= 1) pass('W8-D01 default flip storm', `ok=${okN}/${ids.length}`);
      else fail('W8-D01 default flip storm', flips.map((f) => f.status).join(','));
      const list = await api('GET', '/api/addresses', { token: tokens[CUSTOMER_B] });
      const rows = Array.isArray(list.json?.data) ? list.json.data : [];
      const defaults = rows.filter((a) => a.isDefault === true);
      if (defaults.length <= 1) pass('W8-D02 single default', `defaults=${defaults.length}`);
      else fail('W8-D02 single default', `defaults=${defaults.length}`);
    } else {
      pass('W8-D01 skip create', created.map((c) => c.status).join(','));
    }
  }

  // --- Soft-delete then mutate ---
  {
    const c = await api('POST', '/api/addresses', {
      token: tokens[DUMMIES[1]],
      body: {
        label: 'Temp',
        addressLine1: `W8 del ${SEED}`,
        city: 'Jaipur',
        state: 'Rajasthan',
        pinCode: '302001',
        isDefault: false,
      },
    });
    if (c.status === 200 && c.json?.data?.id) {
      const id = c.json.data.id;
      const del = await api('DELETE', `/api/addresses/${id}`, { token: tokens[DUMMIES[1]] });
      expectStatus('W8-D03 delete', del.status, [200, 204], '');
      const upd = await api('PUT', `/api/addresses/${id}`, {
        token: tokens[DUMMIES[1]],
        body: { label: 'Ghost', addressLine1: 'gone', city: 'Jaipur', state: 'Rajasthan', pinCode: '302001' },
      });
      expectStatus('W8-D04 update deleted', upd.status, [400, 404], '');
      const def = await api('PUT', `/api/addresses/${id}/default`, { token: tokens[DUMMIES[1]], body: {} });
      expectStatus('W8-D05 default deleted', def.status, [400, 404], '');
    }
  }

  // --- Food qty / type coercion ---
  {
    const badBodies = [
      { items: [{ foodItemId: foodR2.id, quantity: 0 }] },
      { items: [{ foodItemId: foodR2.id, quantity: -3 }] },
      { items: [{ foodItemId: foodR2.id, quantity: 999 }] },
      { items: [{ foodItemId: foodR2.id, quantity: 1.5 }] },
      { items: [{ foodItemId: foodR2.id, quantity: '2' }] },
      { items: [] },
      { items: [{ foodItemId: 'abc', quantity: 1 }] },
      { items: [{ foodItemId: foodR2.id }] },
    ];
    for (let i = 0; i < badBodies.length; i++) {
      const body = {
        restaurantId: Number(foodR2.restaurantId),
        addressId: addrs[CUSTOMER],
        paymentMethod: 'COD',
        notes: `W8-qty-${i}-${SEED}`,
        ...badBodies[i],
      };
      const r = await api('POST', '/api/FoodOrders', { token: tokens[CUSTOMER], body });
      expectStatus(`W8-Q0${i + 1} qty fuzz`, r.status, [200, 400, 422], '');
      if (r.status === 200 && r.json?.data?.id) {
        tracked.push({ id: r.json.data.id, token: tokens[CUSTOMER] });
      }
    }
  }

  // --- HTML/script notes + place then COD pay ---
  {
    const place = await api('POST', '/api/FoodOrders', {
      token: tokens[CUSTOMER],
      body: {
        restaurantId: Number(foodR2.restaurantId),
        addressId: addrs[CUSTOMER],
        paymentMethod: 'COD',
        notes: `<img src=x onerror=alert(1)> W8 ${SEED} \u0000`,
        items: [{ foodItemId: foodR2.id, quantity: 1 }],
      },
    });
    expectStatus('W8-F01 place html notes', place.status, [200, 400], '');
    if (place.status === 200) {
      const oid = place.json.data.id;
      tracked.push({ id: oid, token: tokens[CUSTOMER] });
      const pay = await api('POST', `/api/FoodOrders/${oid}/pay`, {
        token: tokens[CUSTOMER],
        body: { paymentId: `fake-${SEED}`, orderId: `rzp_${SEED}`, signature: 'x' },
      });
      expectStatus('W8-F02 COD pay probe', pay.status, [400, 404, 409, 422], '');
    }
  }

  // --- Ride estimate extremes ---
  {
    const extremes = [
      { pickupLat: 26.9124, pickupLng: 75.7873, dropLat: 26.85, dropLng: 75.8 },
      { pickupLat: 91, pickupLng: 0, dropLat: 26.9, dropLng: 75.8 },
      { pickupLat: 26.9, pickupLng: 75.8, dropLat: 26.9, dropLng: 75.8 },
      { pickupLat: 'NaN', pickupLng: 75.8, dropLat: 26.85, dropLng: 75.82 },
      { pickupLat: 26.9124, pickupLng: 75.7873, dropLat: -90, dropLng: 180 },
      {},
    ];
    for (let i = 0; i < extremes.length; i++) {
      const r = await api('POST', '/api/rides/estimate', {
        token: tokens[CUSTOMER],
        body: { vehicleType: 'BIKE', ...extremes[i] },
      });
      expectStatus(`W8-R0${i + 1} estimate`, r.status, [200, 400, 422], '');
    }
    const book = await api('POST', '/api/rides/book', {
      token: tokens[CUSTOMER],
      body: {
        vehicleType: 'BIKE',
        pickupLat: 26.9124,
        pickupLng: 75.7873,
        dropLat: 26.85,
        dropLng: 75.82,
        pickupAddress: `W8 pick ${SEED}`,
        dropAddress: `W8 drop ${SEED}`,
      },
    });
    expectStatus('W8-R07 book bare', book.status, [200, 400, 409, 422], '');
    if (book.status === 200 && book.json?.data?.id) {
      const rid = book.json.data.id;
      await api('POST', `/api/rides/${rid}/cancel`, { token: tokens[CUSTOMER], body: { reason: 'W8 cleanup' } });
    }
  }

  // --- Captain deliver without pickup ---
  {
    const place = await api('POST', '/api/FoodOrders', {
      token: tokens[CUSTOMER],
      body: {
        restaurantId: Number(foodR2.restaurantId),
        addressId: addrs[CUSTOMER],
        paymentMethod: 'COD',
        notes: `W8-skip-pickup-${SEED}`,
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
      expectStatus('W8-C02 accept', acc.status, [200, 409], '');
      if (acc.status === 200) {
        const deliv = await api('POST', `/api/driver/food-orders/${oid}/deliver`, { token: tokens[CAPTAIN], body: {} });
        expectStatus('W8-C03 deliver w/o pickup', deliv.status, [400, 409], '');
        await api('POST', `/api/FoodOrders/${oid}/cancel`, { token: tokens[CUSTOMER], body: {} });
      }
    }
  }

  // --- Marketplace offer on own listing + junk offers ---
  {
    const cats = unwrapList((await api('GET', '/api/marketplace/categories', { token: tokens[CUSTOMER] })).json);
    const catId = cats[0]?.id || 1;
    const created = await api('POST', '/api/marketplace/listings', {
      token: tokens[CUSTOMER],
      body: {
        title: `W8 Own ${SEED}`,
        description: 'chaos wave8',
        price: 199,
        categoryId: catId,
        condition: 'USED',
        city: 'Jaipur',
      },
    });
    expectStatus('W8-M01 create listing', created.status, [200, 201, 400], '');
    const lid = created.json?.data?.id;
    if (lid) {
      const selfOffer = await api('POST', `/api/marketplace/listings/${lid}/offer`, {
        token: tokens[CUSTOMER],
        body: { amount: 150, message: 'self' },
      });
      expectStatus('W8-M02 offer own', selfOffer.status, [400, 403, 409, 422], '');
      const junkOffers = [
        { amount: 0, message: 'zero' },
        { amount: -5, message: 'neg' },
        { amount: 1e12, message: 'huge' },
        { message: 'no amount' },
        { amount: 50, message: 'x'.repeat(2000) },
      ];
      for (let i = 0; i < junkOffers.length; i++) {
        const r = await api('POST', `/api/marketplace/listings/${lid}/offer`, {
          token: tokens[CUSTOMER_B],
          body: junkOffers[i],
        });
        expectStatus(`W8-M1${i} offer junk`, r.status, [200, 201, 400, 422], '');
      }
    }
  }

  // --- Admin routes as customer ---
  {
    const paths = [
      ['GET', '/api/admin/dashboard'],
      ['GET', '/api/admin/users'],
      ['GET', '/api/admin/coupons'],
      ['GET', '/api/admin/settings'],
      ['POST', '/api/admin/notifications/broadcast'],
    ];
    for (const [method, p] of paths) {
      const r = await api(method, p, {
        token: tokens[CUSTOMER],
        body: method === 'POST' ? { message: 'nope' } : undefined,
      });
      expectStatus(`W8-X ${p}`, r.status, [401, 403, 404], '');
    }
  }

  // --- Vendor menu junk while open ---
  {
    const menu = await api('GET', '/api/vendor/menu', { token: tokens[OWNER] });
    expectStatus('W8-V01 menu', menu.status, [200], '');
    const cats = unwrapList(menu.json);
    const catId = cats[0]?.id || cats[0]?.categoryId;
    const junkItems = [
      { name: '', price: 10, categoryId: catId },
      { name: `W8 ${SEED}`, price: -1, categoryId: catId },
      { name: 'x'.repeat(300), price: 50, categoryId: catId || 1 },
      { name: `W8ok ${SEED}`, price: 40, categoryId: 0 },
    ];
    for (let i = 0; i < junkItems.length; i++) {
      const r = await api('POST', '/api/vendor/food-items', { token: tokens[OWNER], body: junkItems[i] });
      expectStatus(`W8-V1${i} food-item`, r.status, [200, 201, 400, 422], '');
    }
    // customer cannot create vendor items
    const cross = await api('POST', '/api/vendor/food-items', {
      token: tokens[CUSTOMER],
      body: { name: 'hack', price: 1, categoryId: catId || 1 },
    });
    expectStatus('W8-V20 customer food-item', cross.status, [401, 403], '');
  }

  // --- Banner / config / public probes ---
  {
    const probes = [
      ['GET', '/api/banners'],
      ['GET', '/api/config'],
      ['GET', '/api/restaurants'],
      ['GET', '/health'],
      ['GET', '/api/marketplace?page=1&pageSize=5'],
    ];
    for (const [method, p] of probes) {
      const r = await api(method, p, {});
      expectStatus(`W8-U ${p}`, r.status, [200], '');
    }
  }

  // --- Payment create-order junk ---
  {
    const junk = [
      { amount: 0, purpose: 'FOOD' },
      { amount: -10, purpose: 'FOOD' },
      { amount: 100, purpose: 'NOPE' },
      {},
      { amount: 'fifty', purpose: 'FOOD' },
    ];
    for (let i = 0; i < junk.length; i++) {
      const r = await api('POST', '/api/payments/create-order', { token: tokens[CUSTOMER], body: junk[i] });
      expectStatus(`W8-Pay${i}`, r.status, [200, 400, 404, 422], '');
    }
  }

  // --- Driver history pagination extremes ---
  {
    const pages = ['?page=-1', '?page=0', '?page=1&pageSize=0', '?page=1&pageSize=9999', '?page=abc'];
    for (const q of pages) {
      const r = await api('GET', `/api/driver/history${q}`, { token: tokens[CAPTAIN] });
      expectStatus(`W8-H history${q}`, r.status, [200, 400], '');
    }
  }

  // cleanup tracked food orders
  await mapPool(tracked, 8, async (o) => {
    try { await api('POST', `/api/FoodOrders/${o.id}/cancel`, { token: o.token, body: {} }); } catch { /* ignore */ }
  });

  const failed = results.filter((r) => !r.ok);
  const ok = results.filter((r) => r.ok);
  console.log(`\n=== CHAOS-W8 DONE seed=${SEED} PASS=${ok.length} FAIL=${failed.length} ms=${Date.now() - t0} ===`);
  if (failed.length) {
    for (const f of failed) console.log(`  FAIL ${f.name}: ${f.detail}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(2);
});
