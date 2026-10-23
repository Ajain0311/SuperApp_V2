/**
 * Random multi-domain chaos / edge suite against live API.
 * Usage: node e2e/agents/chaos-random-suite.mjs [seed]
 * Env: API_BASE_URL, TEST_OTP, CHAOS_SEED
 *
 * Covers: auth fuzz, food validation, multi-hotel, cancel races,
 * owner/captain authz, addresses, rides estimate/book edges,
 * marketplace browse, concurrent storms, random payload junk.
 */
const BASE = process.env.API_BASE_URL || 'https://makemytree.duckdns.org';
const OTP = process.env.TEST_OTP || '123456';
const SEED = parseInt(process.argv[2] || process.env.CHAOS_SEED || String(Date.now() % 1e9), 10);

const CUSTOMER = '7014065979';
const CUSTOMER_B = '9123456780';
const OWNER = '9900000004'; // restaurant 2
const CAPTAIN = '6375002348';
const DUMMIES = Array.from({ length: 8 }, (_, i) => String(9000000301 + i));

const results = [];
const pass = (name, detail = '') => { results.push({ ok: true, name, detail }); console.log(`[PASS] ${name} :: ${detail}`); };
const fail = (name, detail = '') => { results.push({ ok: false, name, detail }); console.log(`[FAIL] ${name} :: ${detail}`); };
const expectStatus = (name, got, want, detail = '') => {
  const ok = Array.isArray(want) ? want.includes(got) : got === want;
  if (ok) pass(name, `status=${got} ${detail}`);
  else fail(name, `got=${got} want=${JSON.stringify(want)} ${detail}`);
};

/** Mulberry32 PRNG */
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
const chance = (p) => rand() < p;

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
    await new Promise((x) => setTimeout(x, 250 * attempt));
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
  if (Array.isArray(json?.items)) return json.items;
  return [];
}

async function main() {
  console.log(`CHAOS seed=${SEED} BASE=${BASE}`);
  const t0 = Date.now();
  const tokens = {};
  const addrs = {};
  const createdOrderIds = []; // { id, token, mobile }

  // ---- A: Auth fuzz ----
  {
    const badOtp = await api('POST', '/api/auth/verify-otp', { body: { mobileNumber: CUSTOMER, otpCode: '000000' } });
    expectStatus('A01 bad otp rejected', badOtp.status, [400, 401], badOtp.json?.message || '');

    const emptyMob = await api('POST', '/api/auth/send-otp', { body: { mobileNumber: '' } });
    expectStatus('A02 empty mobile send-otp', emptyMob.status, [400, 422], '');

    const shortMob = await api('POST', '/api/auth/send-otp', { body: { mobileNumber: '123' } });
    expectStatus('A03 short mobile send-otp', shortMob.status, [400, 422], '');

    const junk = await api('POST', '/api/auth/verify-otp', { body: { mobileNumber: CUSTOMER, otpCode: 'abcdef' } });
    expectStatus('A04 non-numeric otp', junk.status, [400, 401], '');

    const noBody = await api('POST', '/api/auth/send-otp', { rawBody: '{}' });
    expectStatus('A05 send-otp empty object', noBody.status, [400, 422], '');

    const wrongField = await api('POST', '/api/auth/verify-otp', { body: { phone: CUSTOMER, otp: OTP } });
    expectStatus('A06 wrong field names', wrongField.status, [400, 422], '');
  }

  // ---- Bootstrap actors ----
  const actors = [CUSTOMER, CUSTOMER_B, OWNER, CAPTAIN, ...DUMMIES];
  const boot = await mapPool(actors, 8, async (m, idx) => {
    const token = await login(m);
    const addressId = await ensureAddress(token, `Chaos ${SEED} St ${idx}`);
    return { m, token, addressId };
  });
  for (const b of boot) {
    tokens[b.m] = b.token;
    addrs[b.m] = b.addressId;
  }
  pass('B01 bootstrap actors', `n=${actors.length} ms=${Date.now() - t0}`);

  // Unauth probes
  {
    const u1 = await api('GET', '/api/FoodOrders');
    expectStatus('A10 unauth food list', u1.status, [401, 403], '');
    const u2 = await api('POST', '/api/FoodOrders', { body: { restaurantId: 1, addressId: 1, paymentMethod: 'COD', items: [{ foodItemId: 1, quantity: 1 }] } });
    expectStatus('A11 unauth place', u2.status, [401, 403], '');
    const u3 = await api('GET', '/api/vendor/orders');
    expectStatus('A12 unauth vendor', u3.status, [401, 403], '');
    const u4 = await api('GET', '/api/driver/active-food-order');
    expectStatus('A13 unauth driver', u4.status, [401, 403], '');
    const u5 = await api('GET', '/api/addresses');
    expectStatus('A14 unauth addresses', u5.status, [401, 403], '');
  }

  // Catalog
  const foodsRes = await api('GET', '/api/restaurants/foods?pageSize=80', { token: tokens[CUSTOMER] });
  expectStatus('C01 foods catalog', foodsRes.status, 200, '');
  const foods = unwrapList(foodsRes.json);
  const byRest = new Map();
  for (const f of foods) if (f?.restaurantId && f?.id) byRest.set(f.restaurantId, f);
  const rids = [...byRest.keys()];
  if (rids.length >= 2) pass('C02 multi-restaurant foods', `restaurants=${rids.length} foods=${foods.length}`);
  else fail('C02 multi-restaurant foods', `restaurants=${rids.length}`);

  const restList = await api('GET', '/api/restaurants', { token: tokens[CUSTOMER] });
  expectStatus('C03 restaurants list', restList.status, 200, `n=${unwrapList(restList.json).length}`);

  const foodA = byRest.get(rids[0]);
  const foodB = byRest.get(rids[1] || rids[0]);
  const addr = addrs[CUSTOMER];

  // ---- F: Food validation fuzz (random + fixed edges) ----
  {
    const cases = [
      { name: 'F01 empty items', body: { restaurantId: rids[0], addressId: addr, paymentMethod: 'COD', items: [] }, want: 400 },
      { name: 'F02 missing items', body: { restaurantId: rids[0], addressId: addr, paymentMethod: 'COD' }, want: 400 },
      { name: 'F03 qty 0', body: { restaurantId: rids[0], addressId: addr, paymentMethod: 'COD', items: [{ foodItemId: foodA.id, quantity: 0 }] }, want: 400 },
      { name: 'F04 qty negative', body: { restaurantId: rids[0], addressId: addr, paymentMethod: 'COD', items: [{ foodItemId: foodA.id, quantity: -3 }] }, want: 400 },
      { name: 'F05 qty 31 over max', body: { restaurantId: rids[0], addressId: addr, paymentMethod: 'COD', items: [{ foodItemId: foodA.id, quantity: 31 }] }, want: 400 },
      { name: 'F06 bad payment', body: { restaurantId: rids[0], addressId: addr, paymentMethod: 'BITCOIN', items: [{ foodItemId: foodA.id, quantity: 1 }] }, want: 400 },
      { name: 'F07 bad address', body: { restaurantId: rids[0], addressId: 99999999, paymentMethod: 'COD', items: [{ foodItemId: foodA.id, quantity: 1 }] }, want: [400, 404] },
      { name: 'F08 missing address', body: { restaurantId: rids[0], paymentMethod: 'COD', items: [{ foodItemId: foodA.id, quantity: 1 }] }, want: 400 },
      { name: 'F09 fake food id', body: { restaurantId: rids[0], addressId: addr, paymentMethod: 'COD', items: [{ foodItemId: 99999999, quantity: 1 }] }, want: 400 },
      { name: 'F10 cross-restaurant item', body: { restaurantId: rids[0], addressId: addr, paymentMethod: 'COD', items: [{ foodItemId: foodB.id, quantity: 1 }] }, want: 400 },
      { name: 'F11 CASH alias COD', body: { restaurantId: rids[0], addressId: addr, paymentMethod: 'CASH', items: [{ foodItemId: foodA.id, quantity: 1 }] }, want: 200 },
    ];

    // Random qty/payment noise
    for (let i = 0; i < 6; i++) {
      const qty = pick([0, -1, 31, 100, 999, 1.5, 'abc', null]);
      cases.push({
        name: `F20 random-qty-${i}-q=${qty}`,
        body: { restaurantId: pick(rids), addressId: addr, paymentMethod: pick(['COD', 'ONLINE', 'UPI', '', null, 'cod']), items: [{ foodItemId: foodA.id, quantity: qty }] },
        want: [400, 422],
      });
    }

    for (const c of cases) {
      const r = await api('POST', '/api/FoodOrders', { token: tokens[CUSTOMER], body: c.body });
      expectStatus(c.name, r.status, c.want, r.json?.message || '');
      if (r.status === 200 && r.json?.data?.id) {
        createdOrderIds.push({ id: r.json.data.id, token: tokens[CUSTOMER], mobile: CUSTOMER });
      }
    }
  }

  // ---- Checkout edges ----
  {
    const multiOnline = await api('POST', '/api/foodorders/checkout', {
      token: tokens[CUSTOMER],
      body: {
        addressId: addr,
        paymentMethod: 'ONLINE',
        items: [
          { foodItemId: foodA.id, quantity: 1 },
          { foodItemId: foodB.id, quantity: 1 },
        ],
      },
    });
    expectStatus('X01 ONLINE multi blocked', multiOnline.status, 400, multiOnline.json?.message || '');

    const multiCoupon = await api('POST', '/api/foodorders/checkout', {
      token: tokens[CUSTOMER],
      body: {
        addressId: addr,
        paymentMethod: 'COD',
        couponCode: 'FAKECOUPONXYZ',
        items: [
          { foodItemId: foodA.id, quantity: 1 },
          { foodItemId: foodB.id, quantity: 1 },
        ],
      },
    });
    // coupon+multi may 400 for coupon or multi-coupon rule
    expectStatus('X02 coupon+multi blocked-or-invalid', multiCoupon.status, 400, multiCoupon.json?.message || '');

    const multiCod = await api('POST', '/api/foodorders/checkout', {
      token: tokens[CUSTOMER],
      body: {
        addressId: addr,
        paymentMethod: 'COD',
        notes: `CHAOS-multi-${SEED}`,
        items: [
          { foodItemId: foodA.id, quantity: 1 },
          { foodItemId: foodB.id, quantity: 1 },
        ],
      },
    });
    const orders = multiCod.json?.data?.orders || [];
    if (multiCod.status === 200 && orders.length === 2) {
      pass('X03 multi COD split', `ids=${orders.map((o) => o.id).join(',')}`);
      for (const o of orders) createdOrderIds.push({ id: o.id, token: tokens[CUSTOMER], mobile: CUSTOMER });
      const restSet = new Set(orders.map((o) => Number(o.restaurantId)));
      if (restSet.size === 2) pass('X04 multi restaurants distinct', [...restSet].join(','));
      else fail('X04 multi restaurants distinct', [...restSet].join(','));
    } else {
      fail('X03 multi COD split', `${multiCod.status} n=${orders.length} ${multiCod.json?.message}`);
    }

    const emptyCheckout = await api('POST', '/api/foodorders/checkout', {
      token: tokens[CUSTOMER],
      body: { addressId: addr, paymentMethod: 'COD', items: [] },
    });
    expectStatus('X05 empty checkout', emptyCheckout.status, 400, '');

    const junkCheckout = await api('POST', '/api/foodorders/checkout', {
      token: tokens[CUSTOMER],
      rawBody: '{"addressId":"nope","paymentMethod":true,"items":"x"}',
    });
    expectStatus('X06 junk checkout body', junkCheckout.status, [400, 422], '');
  }

  // ---- Role authz ----
  {
    // Place a fresh order for authz tests
    const place = await api('POST', '/api/FoodOrders', {
      token: tokens[CUSTOMER],
      body: {
        restaurantId: 2,
        addressId: addr,
        paymentMethod: 'COD',
        notes: `CHAOS-authz-${SEED}`,
        items: [{ foodItemId: byRest.get(2)?.id || foodA.id, quantity: 1 }],
      },
    });
    if (place.status !== 200 || !place.json?.data?.id) {
      // fallback any restaurant owned by OWNER (2)
      fail('Z00 place for authz', `${place.status} ${place.json?.message}`);
    } else {
      const oid = place.json.data.id;
      createdOrderIds.push({ id: oid, token: tokens[CUSTOMER], mobile: CUSTOMER });
      pass('Z00 place for authz', `order=${oid}`);

      const ownerCancel = await api('POST', `/api/FoodOrders/${oid}/cancel`, { token: tokens[OWNER], body: {} });
      expectStatus('Z01 owner cannot customer-cancel', ownerCancel.status, [403, 404], '');

      const capCancel = await api('POST', `/api/FoodOrders/${oid}/cancel`, { token: tokens[CAPTAIN], body: {} });
      expectStatus('Z02 captain cannot customer-cancel', capCancel.status, [403, 404], '');

      const otherCust = await api('GET', `/api/FoodOrders/${oid}`, { token: tokens[CUSTOMER_B] });
      expectStatus('Z03 other customer cannot view', otherCust.status, [403, 404], '');

      const otherCancel = await api('POST', `/api/FoodOrders/${oid}/cancel`, { token: tokens[CUSTOMER_B], body: {} });
      expectStatus('Z04 other customer cannot cancel', otherCancel.status, [403, 404], '');

      // Owner status on foreign restaurant (if order is rest 2, use a different place)
      // Advance with wrong owner: customer token as vendor
      const custAsVendor = await api('PUT', `/api/vendor/orders/${oid}/status`, {
        token: tokens[CUSTOMER],
        body: { status: 'ACCEPTED' },
      });
      expectStatus('Z05 customer as vendor 403', custAsVendor.status, [401, 403], '');
    }
  }

  // ---- Owner isolation ----
  {
    const vlist = await api('GET', '/api/vendor/orders', { token: tokens[OWNER] });
    expectStatus('V01 vendor list', vlist.status, 200, '');
    const vorders = unwrapList(vlist.json);
    const foreign = vorders.filter((o) => Number(o.restaurantId) !== 2);
    if (foreign.length === 0) pass('V02 owner only restaurant 2', `listed=${vorders.length}`);
    else fail('V02 owner only restaurant 2', `foreign=${foreign.length} sample=${foreign.slice(0, 3).map((o) => o.id + '@' + o.restaurantId)}`);
  }

  // ---- Lifecycle + cancel rules ----
  {
    const foodR2 = byRest.get(2) || foodA;
    const place = await api('POST', '/api/FoodOrders', {
      token: tokens[CUSTOMER],
      body: {
        restaurantId: Number(foodR2.restaurantId),
        addressId: addr,
        paymentMethod: 'COD',
        notes: `CHAOS-life-${SEED}`,
        items: [{ foodItemId: foodR2.id, quantity: 1 }],
      },
    });
    if (place.status !== 200) {
      fail('L00 place lifecycle', `${place.status} ${place.json?.message}`);
    } else {
      const oid = place.json.data.id;
      createdOrderIds.push({ id: oid, token: tokens[CUSTOMER], mobile: CUSTOMER });
      let kitchenOk = true;
      for (const st of ['ACCEPTED', 'PREPARING', 'READY']) {
        const r = await api('PUT', `/api/vendor/orders/${oid}/status`, { token: tokens[OWNER], body: { status: st } });
        if (r.status !== 200) {
          kitchenOk = false;
          fail(`L01 kitchen ${st}`, `${r.status} ${r.json?.message}`);
        }
      }
      if (kitchenOk) pass('L01 kitchen READY', `order=${oid}`);

      // bad status jump
      const jump = await api('PUT', `/api/vendor/orders/${oid}/status`, { token: tokens[OWNER], body: { status: 'DELIVERED' } });
      expectStatus('L02 vendor DELIVERED blocked', jump.status, [400, 409], jump.json?.message || '');

      await api('POST', '/api/driver/toggle-online', { token: tokens[CAPTAIN], body: { isOnline: true } });
      const acc = await api('POST', `/api/driver/food-orders/${oid}/accept`, { token: tokens[CAPTAIN], body: {} });
      expectStatus('L03 captain accept', acc.status, 200, '');

      // double accept same captain
      const acc2 = await api('POST', `/api/driver/food-orders/${oid}/accept`, { token: tokens[CAPTAIN], body: {} });
      expectStatus('L04 double accept', acc2.status, [400, 409], '');

      // cancel after accept should clear captain
      const can = await api('POST', `/api/FoodOrders/${oid}/cancel`, { token: tokens[CUSTOMER], body: {} });
      const det = await api('GET', `/api/FoodOrders/${oid}`, { token: tokens[CUSTOMER] });
      const active = await api('GET', '/api/driver/active-food-order', { token: tokens[CAPTAIN] });
      if (can.status === 200 && det.json?.data?.status === 'CANCELLED' && !det.json?.data?.driverId) {
        pass('L05 cancel-after-accept clears driver', `order=${oid} active=${!!active.json?.data}`);
      } else {
        fail('L05 cancel-after-accept clears driver', `${can.status} st=${det.json?.data?.status} driver=${det.json?.data?.driverId}`);
      }

      const doubleCan = await api('POST', `/api/FoodOrders/${oid}/cancel`, { token: tokens[CUSTOMER], body: {} });
      expectStatus('L06 double cancel blocked', doubleCan.status, [400, 409], '');
    }

    // cancel after pickup blocked
    const place2 = await api('POST', '/api/FoodOrders', {
      token: tokens[CUSTOMER],
      body: {
        restaurantId: Number(foodR2.restaurantId),
        addressId: addr,
        paymentMethod: 'COD',
        notes: `CHAOS-pickup-${SEED}`,
        items: [{ foodItemId: foodR2.id, quantity: 1 }],
      },
    });
    if (place2.status === 200) {
      const oid2 = place2.json.data.id;
      createdOrderIds.push({ id: oid2, token: tokens[CUSTOMER], mobile: CUSTOMER });
      for (const st of ['ACCEPTED', 'PREPARING', 'READY']) {
        await api('PUT', `/api/vendor/orders/${oid2}/status`, { token: tokens[OWNER], body: { status: st } });
      }
      await api('POST', '/api/driver/toggle-online', { token: tokens[CAPTAIN], body: { isOnline: true } });
      await api('POST', `/api/driver/food-orders/${oid2}/accept`, { token: tokens[CAPTAIN], body: {} });
      const pk = await api('POST', `/api/driver/food-orders/${oid2}/pickup`, { token: tokens[CAPTAIN], body: {} });
      expectStatus('L10 pickup', pk.status, 200, '');
      const canPk = await api('POST', `/api/FoodOrders/${oid2}/cancel`, { token: tokens[CUSTOMER], body: {} });
      expectStatus('L11 cancel-after-pickup blocked', canPk.status, 400, canPk.json?.message || '');
      // finish deliver so captain free
      await api('POST', `/api/driver/food-orders/${oid2}/deliver`, { token: tokens[CAPTAIN], body: {} });
      pass('L12 deliver after pickup-block test', `order=${oid2}`);
    } else {
      fail('L10 place for pickup test', `${place2.status}`);
    }
  }

  // ---- Offline captain ----
  {
    await api('POST', '/api/driver/toggle-online', { token: tokens[CAPTAIN], body: { isOnline: false } });
    const foodR2 = byRest.get(2) || foodA;
    const place = await api('POST', '/api/FoodOrders', {
      token: tokens[CUSTOMER],
      body: {
        restaurantId: Number(foodR2.restaurantId),
        addressId: addr,
        paymentMethod: 'COD',
        notes: `CHAOS-offline-${SEED}`,
        items: [{ foodItemId: foodR2.id, quantity: 1 }],
      },
    });
    if (place.status === 200) {
      const oid = place.json.data.id;
      createdOrderIds.push({ id: oid, token: tokens[CUSTOMER], mobile: CUSTOMER });
      for (const st of ['ACCEPTED', 'PREPARING', 'READY']) {
        await api('PUT', `/api/vendor/orders/${oid}/status`, { token: tokens[OWNER], body: { status: st } });
      }
      const acc = await api('POST', `/api/driver/food-orders/${oid}/accept`, { token: tokens[CAPTAIN], body: {} });
      expectStatus('L20 offline captain accept blocked', acc.status, [400, 409], acc.json?.message || '');
      await api('POST', `/api/FoodOrders/${oid}/cancel`, { token: tokens[CUSTOMER], body: {} });
      await api('POST', '/api/driver/toggle-online', { token: tokens[CAPTAIN], body: { isOnline: true } });
    }
  }

  // ---- Address edges ----
  {
    const badPin = await api('POST', '/api/addresses', {
      token: tokens[CUSTOMER],
      body: { label: 'Bad', addressLine1: 'X', city: 'Jaipur', state: 'Rajasthan', pinCode: '12', isDefault: false },
    });
    expectStatus('AD01 bad pin', badPin.status, [400, 422], '');

    const emptyLine = await api('POST', '/api/addresses', {
      token: tokens[CUSTOMER],
      body: { label: 'Bad', addressLine1: '', city: '', state: 'Rajasthan', pinCode: '302001', isDefault: false },
    });
    expectStatus('AD02 empty street/city', emptyLine.status, [400, 422], '');

    const list = await api('GET', '/api/addresses', { token: tokens[CUSTOMER] });
    expectStatus('AD03 list addresses', list.status, 200, `n=${unwrapList(list.json).length}`);

    const foreignDel = await api('DELETE', `/api/addresses/${addrs[CUSTOMER_B]}`, { token: tokens[CUSTOMER] });
    expectStatus('AD04 cannot delete others address', foreignDel.status, [403, 404], '');
  }

  // ---- Rides edges ----
  {
    const estBad = await api('POST', '/api/rides/estimate', {
      token: tokens[CUSTOMER],
      body: { pickupLat: 0, pickupLng: 0, dropLat: 0, dropLng: 0, vehicleType: 'BIKE' },
    });
    expectStatus('R01 estimate zero coords', estBad.status, [400, 422], estBad.json?.message || '');

    const estOk = await api('POST', '/api/rides/estimate', {
      token: tokens[CUSTOMER],
      body: {
        pickupLat: 26.9124, pickupLng: 75.7873,
        dropLat: 26.9224, dropLng: 75.7973,
        vehicleType: pick(['BIKE', 'AUTO', 'CAR']),
      },
    });
    expectStatus('R02 estimate valid Jaipur', estOk.status, [200, 400], estOk.json?.message || JSON.stringify(estOk.json?.data || {}).slice(0, 80));

    const bookMissing = await api('POST', '/api/rides/book', {
      token: tokens[CUSTOMER],
      body: { pickupLat: 26.91, pickupLng: 75.78 },
    });
    expectStatus('R03 book incomplete', bookMissing.status, [400, 422], '');

    const bookJunk = await api('POST', '/api/rides/book', {
      token: tokens[CUSTOMER],
      rawBody: '{"vehicleType":123,"pickupLat":"x"}',
    });
    expectStatus('R04 book junk body', bookJunk.status, [400, 422], '');

    // customer cannot start someone else's ride
    const fakeStart = await api('POST', '/api/rides/999999/start', { token: tokens[CUSTOMER], body: {} });
    // 400 = model/OTP validation before NotFound; 403/404 = authz/missing ride
    expectStatus('R05 fake ride start', fakeStart.status, [400, 403, 404], '');
  }

  // ---- Marketplace ----
  {
    const cats = await api('GET', '/api/marketplace/categories', { token: tokens[CUSTOMER] });
    expectStatus('M01 categories', cats.status, 200, `n=${unwrapList(cats.json).length}`);

    const listings = await api('GET', '/api/marketplace?pageSize=10', { token: tokens[CUSTOMER] });
    expectStatus('M02 listings', listings.status, 200, `n=${unwrapList(listings.json).length}`);

    const fakeFav = await api('POST', '/api/marketplace/favorites/99999999', { token: tokens[CUSTOMER] });
    expectStatus('M03 fake favorite', fakeFav.status, [400, 404], '');

    const unauthList = await api('POST', '/api/marketplace/listings', {
      body: { title: 'hack', price: 1, categoryId: 1 },
    });
    expectStatus('M04 unauth create listing', unauthList.status, [401, 403], '');

    const custCreate = await api('POST', '/api/marketplace/listings', {
      token: tokens[CUSTOMER],
      body: { title: `Chaos ${SEED}`, price: -5, categoryId: 1, description: 'x' },
    });
    // customer may not be seller → 403, or validation 400
    expectStatus('M05 customer/neg price listing', custCreate.status, [400, 403, 422], custCreate.json?.message || '');
  }

  // ---- Concurrent storm (random dummies place + cancel) ----
  {
    const stormUsers = DUMMIES.slice(0, 6);
    const tStorm = Date.now();
    const placed = await mapPool(stormUsers, 6, async (m, idx) => {
      const rid = rids[idx % rids.length];
      const food = byRest.get(rid);
      const r = await api('POST', '/api/FoodOrders', {
        token: tokens[m],
        body: {
          restaurantId: rid,
          addressId: addrs[m],
          paymentMethod: 'COD',
          notes: `CHAOS-storm-${SEED}-${idx}`,
          items: [{ foodItemId: food.id, quantity: pick([1, 2, 3]) }],
        },
      });
      return { m, status: r.status, order: r.json?.data, rid };
    });
    const ok = placed.filter((p) => p.status === 200 && p.order?.id);
    if (ok.length === stormUsers.length) pass('S01 concurrent place storm', `n=${ok.length} ms=${Date.now() - tStorm}`);
    else fail('S01 concurrent place storm', `ok=${ok.length}/${stormUsers.length} bad=${JSON.stringify(placed.filter((p) => p.status !== 200).slice(0, 3))}`);

    for (const p of ok) createdOrderIds.push({ id: p.order.id, token: tokens[p.m], mobile: p.m });

    // race: half cancel immediately while others stay
    const cancels = await mapPool(ok.slice(0, 3), 3, async (p) => {
      const c = await api('POST', `/api/FoodOrders/${p.order.id}/cancel`, { token: tokens[p.m], body: {} });
      return { id: p.order.id, status: c.status };
    });
    if (cancels.every((c) => c.status === 200)) pass('S02 cancel storm', `n=${cancels.length}`);
    else fail('S02 cancel storm', JSON.stringify(cancels));

    // concurrent multi checkout
    const multiStorm = await mapPool(stormUsers.slice(0, 4), 4, async (m) => {
      const r = await api('POST', '/api/foodorders/checkout', {
        token: tokens[m],
        body: {
          addressId: addrs[m],
          paymentMethod: 'COD',
          notes: `CHAOS-multistorm-${SEED}`,
          items: [
            { foodItemId: foodA.id, quantity: 1 },
            { foodItemId: foodB.id, quantity: 1 },
          ],
        },
      });
      return { m, status: r.status, orders: r.json?.data?.orders || [] };
    });
    const mOk = multiStorm.filter((x) => x.status === 200 && x.orders.length === 2);
    if (mOk.length === 4) pass('S03 concurrent multi checkout', `users=4 orders=8`);
    else fail('S03 concurrent multi checkout', JSON.stringify(multiStorm.filter((x) => x.status !== 200 || x.orders.length !== 2).slice(0, 3)));
    for (const x of mOk) for (const o of x.orders) createdOrderIds.push({ id: o.id, token: tokens[x.m], mobile: x.m });
  }

  // ---- Random endpoint junk ----
  {
    const paths = [
      '/api/FoodOrders/0',
      '/api/FoodOrders/-1',
      '/api/FoodOrders/abc',
      '/api/vendor/orders/0/status',
      '/api/driver/food-orders/0/accept',
      '/api/restaurants/foods?page=-1&pageSize=9999',
      '/api/restaurants/999999',
    ];
    for (const [i, path] of paths.entries()) {
      const method = path.includes('/status') || path.includes('/accept') ? 'POST' : 'GET';
      const body = method === 'POST' ? {} : undefined;
      const r = await api(method === 'POST' && path.includes('/status') ? 'PUT' : method, path, {
        token: tokens[CUSTOMER],
        body,
      });
      // anything except 500 is acceptable for junk
      if (r.status >= 500) fail(`J${String(i).padStart(2, '0')} junk ${path}`, `status=${r.status}`);
      else pass(`J${String(i).padStart(2, '0')} junk ${path}`, `status=${r.status}`);
    }

    // malformed JSON
    const mal = await api('POST', '/api/FoodOrders', { token: tokens[CUSTOMER], rawBody: '{not-json' });
    expectStatus('J90 malformed json', mal.status, [400, 415], '');
  }

  // ---- Cleanup cancellable orders ----
  {
    let cleaned = 0;
    let skipped = 0;
    await mapPool(createdOrderIds, 10, async (o) => {
      const det = await api('GET', `/api/FoodOrders/${o.id}`, { token: o.token });
      const st = det.json?.data?.status;
      if (['PENDING', 'ACCEPTED', 'PREPARING', 'READY'].includes(st)) {
        const c = await api('POST', `/api/FoodOrders/${o.id}/cancel`, { token: o.token, body: {} });
        if (c.status === 200) cleaned++; else skipped++;
      } else skipped++;
    });
    pass('Z90 cleanup', `cleaned=${cleaned} skipped=${skipped} tracked=${createdOrderIds.length}`);
  }

  await api('POST', '/api/driver/toggle-online', { token: tokens[CAPTAIN], body: { isOnline: false } });

  const health = await api('GET', '/health');
  expectStatus('Z99 health after chaos', health.status, 200, '');

  const failed = results.filter((r) => !r.ok);
  const passed = results.filter((r) => r.ok);
  console.log(`\n==== CHAOS seed=${SEED} PASS=${passed.length} FAIL=${failed.length} TOTAL=${results.length} elapsedMs=${Date.now() - t0} ====`);
  for (const f of failed) console.log(`[FAIL] ${f.name} :: ${f.detail}`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
