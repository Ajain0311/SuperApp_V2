/**
 * Wave-10 random chaos: soft-deleted address place, driver location junk,
 * marketplace favorite race, payment create/verify fuzz, review spam,
 * notification mark-read junk, vendor status skip (ACCEPTED→DELIVERED),
 * COD pay probe, captain unassign junk, concurrent same-user place,
 * ride book extremes, unregister-device-token, marketplace offer foreign,
 * documents probe, driver history/earnings pagination.
 * Usage: node e2e/agents/chaos-random-wave10.mjs [seed]
 */
const BASE = process.env.API_BASE_URL || 'https://makemytree.duckdns.org';
const OTP = process.env.TEST_OTP || '123456';
const SEED = parseInt(process.argv[2] || process.env.CHAOS_SEED || String(Date.now() % 1e9), 10);

const CUSTOMER = '7014065979';
const CUSTOMER_B = '9123456780';
const OWNER = '9900000004';
const CAPTAIN = '6375002348';
const DUMMIES = Array.from({ length: 8 }, (_, i) => String(9000001201 + i));

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
  console.log(`CHAOS-W10 seed=${SEED} BASE=${BASE}`);
  const t0 = Date.now();
  const tokens = {};
  const addrs = {};
  const tracked = [];

  const actors = [CUSTOMER, CUSTOMER_B, OWNER, CAPTAIN, ...DUMMIES];
  const boot = await mapPool(actors, 8, async (m, idx) => {
    const token = await login(m);
    const addressId = await ensureAddress(token, `W10 ${SEED} ${idx}`);
    return { m, token, addressId };
  });
  for (const b of boot) {
    tokens[b.m] = b.token;
    addrs[b.m] = b.addressId;
  }
  pass('W10-B01 bootstrap', `n=${actors.length}`);
  await api('POST', '/api/vendor/toggle-status', { token: tokens[OWNER], body: { isOpen: true } });
  await api('POST', '/api/driver/toggle-online', { token: tokens[CAPTAIN], body: { isOnline: true } });

  const foods = unwrapList((await api('GET', '/api/restaurants/foods?pageSize=80', { token: tokens[CUSTOMER] })).json);
  const foodR2 = foods.find((f) => f.restaurantId === 2) || foods[0];
  if (!foodR2?.id) { fail('W10-C01 foods', 'none'); process.exit(1); }
  pass('W10-C01 foods', `n=${foods.length} item=${foodR2.id}`);

  // --- Soft-delete address then place order ---
  {
    const dummy = DUMMIES[0];
    const created = await api('POST', '/api/addresses', {
      token: tokens[dummy],
      body: {
        label: 'Temp',
        addressLine1: `W10 del ${SEED}`,
        city: 'Jaipur',
        state: 'Rajasthan',
        pinCode: '302001',
        isDefault: false,
      },
    });
    expectStatus('W10-D01 create temp addr', created.status, [200], '');
    const delId = created.json?.data?.id;
    if (delId) {
      const del = await api('DELETE', `/api/addresses/${delId}`, { token: tokens[dummy] });
      expectStatus('W10-D02 delete addr', del.status, [200, 204], '');
      const place = await api('POST', '/api/FoodOrders', {
        token: tokens[dummy],
        body: {
          restaurantId: Number(foodR2.restaurantId),
          addressId: delId,
          paymentMethod: 'COD',
          notes: `W10-deladdr-${SEED}`,
          items: [{ foodItemId: foodR2.id, quantity: 1 }],
        },
      });
      expectStatus('W10-D03 place deleted addr', place.status, [400, 404], '');
      if (place.status === 200) tracked.push({ id: place.json.data.id, token: tokens[dummy] });
    }
  }

  // --- Driver location junk ---
  {
    const locs = [
      {},
      { latitude: 26.9, longitude: 75.8 },
      { latitude: 91, longitude: 75.8 },
      { latitude: -91, longitude: 200 },
      { latitude: 'NaN', longitude: 'x' },
      { latitude: 26.9 }, // missing lng → 400 after nullable harden
      { lat: 26.9, lng: 75.8 },
    ];
    const wantLoc = [400, 200, 400, 400, 400, 400, 400];
    for (let i = 0; i < locs.length; i++) {
      const r = await api('POST', '/api/driver/location', { token: tokens[CAPTAIN], body: locs[i] });
      expectStatus(`W10-L${i} location`, r.status, wantLoc[i], '');
    }
    const cust = await api('POST', '/api/driver/location', {
      token: tokens[CUSTOMER],
      body: { latitude: 26.9, longitude: 75.8 },
    });
    expectStatus('W10-L cust location', cust.status, [401, 403], '');
  }

  // --- Marketplace favorite race ---
  {
    const cats = unwrapList((await api('GET', '/api/marketplace/categories', { token: tokens[CUSTOMER] })).json);
    const catId = cats[0]?.id || 1;
    const listing = await api('POST', '/api/marketplace/listings', {
      token: tokens[CUSTOMER],
      body: {
        title: `W10 fav ${SEED}`,
        description: 'w10',
        price: 149,
        categoryId: catId,
        condition: 'USED',
        city: 'Jaipur',
      },
    });
    expectStatus('W10-M01 listing', listing.status, [200, 201, 400], '');
    const lid = listing.json?.data?.id;
    if (lid) {
      const race = await Promise.all(
        Array.from({ length: 6 }, (_, i) =>
          i % 2 === 0
            ? api('POST', `/api/marketplace/favorites/${lid}`, { token: tokens[CUSTOMER_B], body: {} })
            : api('DELETE', `/api/marketplace/favorites/${lid}`, { token: tokens[CUSTOMER_B] }),
        ),
      );
      const bad = race.filter((r) => r.status >= 500);
      if (bad.length === 0) pass('W10-M02 fav race', race.map((r) => r.status).join(','));
      else fail('W10-M02 fav race', bad.map((r) => r.status).join(','));

      const offer = await api('POST', `/api/marketplace/listings/${lid}/offer`, {
        token: tokens[CUSTOMER_B],
        body: { amount: 50, message: `W10 ${SEED}` },
      });
      expectStatus('W10-M03 offer', offer.status, [200, 201, 400, 409], '');
      const offerId = offer.json?.data?.id;
      if (offerId) {
        // foreign user tries to accept/reject
        const foreign = await api('PUT', `/api/marketplace/offers/${offerId}/status`, {
          token: tokens[DUMMIES[1]],
          body: { status: 'ACCEPTED' },
        });
        expectStatus('W10-M04 foreign offer status', foreign.status, [400, 401, 403, 404], '');
        const ownerAct = await api('PUT', `/api/marketplace/offers/${offerId}/status`, {
          token: tokens[CUSTOMER],
          body: { status: 'REJECTED' },
        });
        expectStatus('W10-M05 owner reject', ownerAct.status, [200, 400, 409], '');
      }
    }
  }

  // --- Payment create/verify fuzz ---
  {
    const cases = [
      {},
      { module: 'FOOD', receiptId: '0', amount: 10 },
      { module: 'FOOD', receiptId: '99999999', amount: 10 },
      { module: 'FOOD', receiptId: 'abc', amount: -5 },
      { module: 'RIDE', receiptId: '-1', amount: 1 },
      { module: 'HACK', receiptId: '1', amount: 100 },
      { module: 'FOOD', receiptId: '1', amount: 1e15 },
    ];
    for (let i = 0; i < cases.length; i++) {
      const r = await api('POST', '/api/payments/create-order', { token: tokens[CUSTOMER], body: cases[i] });
      expectStatus(`W10-P${i} create-order`, r.status, [200, 400, 403, 404, 409, 422], '');
    }
    const verifyJunk = [
      {},
      { transactionId: '' },
      { transactionId: 'nope-' + SEED },
      { transactionId: 'x'.repeat(300), orderId: 'y' },
    ];
    for (let i = 0; i < verifyJunk.length; i++) {
      const r = await api('POST', '/api/payments/verify', { token: tokens[CUSTOMER], body: verifyJunk[i] });
      expectStatus(`W10-PV${i} verify`, r.status, [400, 404, 422], '');
    }
  }

  // --- Reviews spam / junk ---
  {
    const bodies = [
      { targetType: 'RESTAURANT', targetId: 2, rating: 5, comment: `W10 ${SEED}` },
      { targetType: 'RESTAURANT', targetId: 2, rating: 0, comment: 'bad' },
      { targetType: 'RESTAURANT', targetId: 2, rating: 6, comment: 'bad' },
      { targetType: 'DRIVER', targetId: 999999, rating: 3, comment: 'ghost' },
      { targetType: 'LISTING', targetId: 0, rating: 4 },
      { targetType: 'HACK', targetId: 1, rating: 5 },
      { targetType: 'RESTAURANT', targetId: -1, rating: 5 },
      {},
    ];
    for (let i = 0; i < bodies.length; i++) {
      const r = await api('POST', '/api/reviews', { token: tokens[CUSTOMER], body: bodies[i] });
      expectStatus(`W10-RV${i} review`, r.status, [200, 201, 400, 404, 422], '');
    }
    const storm = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        api('POST', '/api/reviews', {
          token: tokens[DUMMIES[i % DUMMIES.length]],
          body: { targetType: 'RESTAURANT', targetId: 2, rating: 1 + (i % 5), comment: `storm ${SEED} ${i}` },
        }),
      ),
    );
    const bad = storm.filter((s) => s.status >= 500);
    if (bad.length === 0) pass('W10-RV storm', storm.map((s) => s.status).join(','));
    else fail('W10-RV storm', bad.map((s) => s.status).join(','));
  }

  // --- Notification mark-read junk ---
  {
    const ids = [0, -1, 99999999, 'abc'];
    for (const id of ids) {
      const r = await api('PUT', `/api/notifications/${id}/read`, { token: tokens[CUSTOMER], body: {} });
      expectStatus(`W10-N read ${id}`, r.status, [200, 400, 404], '');
    }
    const all = await api('PUT', '/api/notifications/read-all', { token: tokens[CUSTOMER], body: {} });
    expectStatus('W10-N read-all', all.status, [200], '');
    const unreg = await api('POST', '/api/notifications/unregister-device-token', {
      token: tokens[CUSTOMER],
      body: { token: `w10-missing-${SEED}`, platform: 'android' },
    });
    expectStatus('W10-N unreg missing', unreg.status, [200, 400, 404], '');
  }

  // --- Vendor status skip ACCEPTED → DELIVERED ---
  {
    const place = await api('POST', '/api/FoodOrders', {
      token: tokens[CUSTOMER],
      body: {
        restaurantId: Number(foodR2.restaurantId),
        addressId: addrs[CUSTOMER],
        paymentMethod: 'COD',
        notes: `W10-skip-${SEED}`,
        items: [{ foodItemId: foodR2.id, quantity: 1 }],
      },
    });
    expectStatus('W10-V01 place', place.status, 200, '');
    if (place.status === 200) {
      const oid = place.json.data.id;
      tracked.push({ id: oid, token: tokens[CUSTOMER] });
      await api('PUT', `/api/vendor/orders/${oid}/status`, { token: tokens[OWNER], body: { status: 'ACCEPTED' } });
      const skip = await api('PUT', `/api/vendor/orders/${oid}/status`, {
        token: tokens[OWNER],
        body: { status: 'DELIVERED' },
      });
      expectStatus('W10-V02 skip to DELIVERED', skip.status, [400, 409, 422], '');
      const junk = await api('PUT', `/api/vendor/orders/${oid}/status`, {
        token: tokens[OWNER],
        body: { status: 'HACKED' },
      });
      expectStatus('W10-V03 junk status', junk.status, [400, 422], '');
      // COD pay probe
      const pay = await api('POST', `/api/FoodOrders/${oid}/pay`, {
        token: tokens[CUSTOMER],
        body: { paymentMethod: 'ONLINE' },
      });
      expectStatus('W10-V04 COD pay', pay.status, [200, 400, 409, 422], '');
    }
  }

  // --- Captain unassign junk ---
  {
    const junk = [0, -1, 99999999];
    for (const id of junk) {
      const r = await api('POST', `/api/driver/food-orders/${id}/unassign`, {
        token: tokens[CAPTAIN],
        body: {},
      });
      expectStatus(`W10-U unassign ${id}`, r.status, [400, 403, 404, 409], '');
    }
    const cust = await api('POST', '/api/driver/food-orders/1/unassign', {
      token: tokens[CUSTOMER],
      body: {},
    });
    expectStatus('W10-U customer unassign', cust.status, [401, 403, 404], '');
  }

  // --- Concurrent same-user place ---
  {
    const places = await Promise.all(
      Array.from({ length: 4 }, (_, i) =>
        api('POST', '/api/FoodOrders', {
          token: tokens[CUSTOMER_B],
          body: {
            restaurantId: Number(foodR2.restaurantId),
            addressId: addrs[CUSTOMER_B],
            paymentMethod: 'COD',
            notes: `W10-conc-${SEED}-${i}`,
            items: [{ foodItemId: foodR2.id, quantity: 1 }],
          },
        }),
      ),
    );
    const okN = places.filter((p) => p.status === 200).length;
    const bad = places.filter((p) => p.status >= 500);
    if (bad.length === 0 && okN >= 1) {
      pass('W10-X01 concurrent place', places.map((p) => p.status).join(','));
      for (const p of places) {
        if (p.status === 200) tracked.push({ id: p.json.data.id, token: tokens[CUSTOMER_B] });
      }
    } else if (bad.length) fail('W10-X01 concurrent place', bad.map((p) => p.status).join(','));
    else fail('W10-X01 concurrent place', places.map((p) => p.status).join(','));
  }

  // --- Ride book extremes ---
  {
    const books = [
      {},
      {
        pickupLatitude: 26.9124,
        pickupLongitude: 75.7873,
        dropLatitude: 26.85,
        dropLongitude: 75.8,
        vehicleType: 'BIKE',
      },
      {
        pickupLatitude: 91,
        pickupLongitude: 75.8,
        dropLatitude: 26.85,
        dropLongitude: 75.8,
        vehicleType: 'BIKE',
      },
      {
        pickupLatitude: 26.9,
        pickupLongitude: 75.8,
        dropLatitude: 26.9,
        dropLongitude: 75.8,
        vehicleType: 'BIKE',
      },
      {
        pickupLatitude: 26.9,
        pickupLongitude: 75.8,
        dropLatitude: 26.85,
        dropLongitude: 75.8,
        vehicleType: 'SPACESHIP',
      },
      {
        pickupLatitude: 26.9,
        pickupLongitude: 75.8,
        dropLatitude: 26.85,
        dropLongitude: 75.8,
        vehicleType: 'BIKE',
        estimatedFare: 1,
      },
    ];
    for (let i = 0; i < books.length; i++) {
      const est = await api('POST', '/api/rides/estimate', { token: tokens[CUSTOMER], body: books[i] });
      expectStatus(`W10-R${i} estimate`, est.status, [200, 400, 422], '');
      const book = await api('POST', '/api/rides/book', { token: tokens[CUSTOMER], body: books[i] });
      expectStatus(`W10-RB${i} book`, book.status, [200, 400, 409, 422], '');
      if (book.status === 200 && book.json?.data?.id) {
        await api('POST', `/api/rides/${book.json.data.id}/cancel`, {
          token: tokens[CUSTOMER],
          body: { reason: `W10 cleanup ${SEED}` },
        });
      }
    }
  }

  // --- Driver history / earnings pagination ---
  {
    const qs = ['', '?page=-1', '?page=0&pageSize=0', '?page=1&pageSize=5000', '?page=9999'];
    for (const q of qs) {
      const h = await api('GET', `/api/driver/history${q}`, { token: tokens[CAPTAIN] });
      expectStatus(`W10-H history${q || '(def)'}`, h.status, [200, 400], '');
      const e = await api('GET', `/api/driver/earnings${q}`, { token: tokens[CAPTAIN] });
      expectStatus(`W10-E earnings${q || '(def)'}`, e.status, [200, 400], '');
    }
    const custH = await api('GET', '/api/driver/history', { token: tokens[CUSTOMER] });
    expectStatus('W10-H customer history', custH.status, [401, 403], '');
  }

  // --- Documents probe ---
  {
    const r1 = await api('POST', '/api/documents', { token: tokens[CUSTOMER], body: {} });
    expectStatus('W10-DOC empty', r1.status, [400, 415, 422], '');
    const r2 = await api('GET', '/api/documents/nope/image', { token: tokens[CUSTOMER] });
    expectStatus('W10-DOC missing image', r2.status, [400, 404], '');
    const r3 = await api('DELETE', '/api/documents/nope', { token: tokens[CUSTOMER] });
    expectStatus('W10-DOC delete missing', r3.status, [400, 403, 404], '');
  }

  // --- Admin routes as customer ---
  {
    const paths = [
      ['GET', '/api/admin/dashboard'],
      ['GET', '/api/admin/users'],
      ['GET', '/api/admin/settings'],
      ['POST', '/api/admin/notifications/broadcast'],
      ['POST', '/api/admin/cleanup-dummy-data'],
    ];
    for (let i = 0; i < paths.length; i++) {
      const [method, path] = paths[i];
      const r = await api(method, path, {
        token: tokens[CUSTOMER],
        body: method === 'POST' ? { message: 'nope' } : undefined,
      });
      expectStatus(`W10-AD${i} ${path.split('/').pop()}`, r.status, [401, 403], '');
    }
  }

  // --- Raw body / wrong content-type on checkout ---
  {
    const r1 = await api('POST', '/api/FoodOrders/checkout', {
      token: tokens[CUSTOMER],
      rawBody: 'not-json',
      contentType: 'application/json',
    });
    expectStatus('W10-CT bad json', r1.status, [400, 415], '');
    const r2 = await api('POST', '/api/FoodOrders/checkout', {
      token: tokens[CUSTOMER],
      rawBody: 'a=b',
      contentType: 'application/x-www-form-urlencoded',
    });
    expectStatus('W10-CT form', r2.status, [400, 415, 422], '');
  }

  // cleanup
  await mapPool(tracked, 8, async (o) => {
    try { await api('POST', `/api/FoodOrders/${o.id}/cancel`, { token: o.token, body: {} }); } catch { /* ignore */ }
  });
  await api('POST', '/api/vendor/toggle-status', { token: tokens[OWNER], body: { isOpen: true } });

  const failed = results.filter((r) => !r.ok);
  const ok = results.filter((r) => r.ok);
  console.log(`\n=== CHAOS-W10 DONE seed=${SEED} PASS=${ok.length} FAIL=${failed.length} ms=${Date.now() - t0} ===`);
  if (failed.length) {
    for (const f of failed) console.log(`  FAIL ${f.name}: ${f.detail}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(2);
});
