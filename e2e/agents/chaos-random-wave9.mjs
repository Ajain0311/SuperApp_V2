/**
 * Wave-9 random chaos: forgot/reset password junk, vendor open/close storm,
 * marketplace edit foreign listing, captain available-food + double-deliver,
 * address coord extremes, customer order pagination, coupon amount extremes,
 * notification witty spam, restaurant foods query inject, concurrent cancel
 * from two customers on distinct orders, driver cancel-ride junk.
 * Usage: node e2e/agents/chaos-random-wave9.mjs [seed]
 */
const BASE = process.env.API_BASE_URL || 'https://makemytree.duckdns.org';
const OTP = process.env.TEST_OTP || '123456';
const SEED = parseInt(process.argv[2] || process.env.CHAOS_SEED || String(Date.now() % 1e9), 10);

const CUSTOMER = '7014065979';
const CUSTOMER_B = '9123456780';
const OWNER = '9900000004';
const CAPTAIN = '6375002348';
const DUMMIES = Array.from({ length: 8 }, (_, i) => String(9000001101 + i));

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
  console.log(`CHAOS-W9 seed=${SEED} BASE=${BASE}`);
  const t0 = Date.now();
  const tokens = {};
  const addrs = {};
  const tracked = [];

  const actors = [CUSTOMER, CUSTOMER_B, OWNER, CAPTAIN, ...DUMMIES];
  const boot = await mapPool(actors, 8, async (m, idx) => {
    const token = await login(m);
    const addressId = await ensureAddress(token, `W9 ${SEED} ${idx}`);
    return { m, token, addressId };
  });
  for (const b of boot) {
    tokens[b.m] = b.token;
    addrs[b.m] = b.addressId;
  }
  pass('W9-B01 bootstrap', `n=${actors.length}`);
  await api('POST', '/api/vendor/toggle-status', { token: tokens[OWNER], body: { isOpen: true } });

  const foods = unwrapList((await api('GET', '/api/restaurants/foods?pageSize=80', { token: tokens[CUSTOMER] })).json);
  const foodR2 = foods.find((f) => f.restaurantId === 2) || foods[0];
  if (!foodR2?.id) { fail('W9-C01 foods', 'none'); process.exit(1); }
  pass('W9-C01 foods', `n=${foods.length}`);

  // --- Forgot / reset password junk ---
  {
    const cases = [
      { path: '/api/auth/forgot-password', body: {} },
      { path: '/api/auth/forgot-password', body: { mobileNumber: '' } },
      { path: '/api/auth/forgot-password', body: { mobileNumber: '12' } },
      { path: '/api/auth/forgot-password', body: { mobileNumber: CUSTOMER } },
      { path: '/api/auth/reset-password', body: {} },
      { path: '/api/auth/reset-password', body: { mobileNumber: CUSTOMER, otpCode: '000000', newPassword: 'x' } },
      { path: '/api/auth/reset-password', body: { mobileNumber: CUSTOMER, otpCode: OTP, newPassword: 'a'.repeat(200) } },
      { path: '/api/auth/reset-password', body: { mobileNumber: CUSTOMER, otpCode: OTP, newPassword: 'GoodPass1!' } },
    ];
    for (let i = 0; i < cases.length; i++) {
      const r = await api('POST', cases[i].path, { body: cases[i].body });
      expectStatus(`W9-A${String(i).padStart(2, '0')} ${cases[i].path.split('/').pop()}`, r.status, [200, 400, 404, 422], '');
    }
  }

  // --- Vendor open/close storm ---
  {
    const storm = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        api('POST', '/api/vendor/toggle-status', {
          token: tokens[OWNER],
          body: { isOpen: i % 2 === 0 },
        }),
      ),
    );
    const bad = storm.filter((s) => s.status >= 500);
    if (bad.length === 0) pass('W9-V01 toggle storm', storm.map((s) => s.status).join(','));
    else fail('W9-V01 toggle storm', bad.map((s) => s.status).join(','));
    await api('POST', '/api/vendor/toggle-status', { token: tokens[OWNER], body: { isOpen: true } });
    const cust = await api('POST', '/api/vendor/toggle-status', {
      token: tokens[CUSTOMER],
      body: { isOpen: false },
    });
    expectStatus('W9-V02 customer toggle', cust.status, [401, 403], '');
  }

  // --- Foods query inject / extremes ---
  {
    const qs = [
      '?search=%3Cscript%3E',
      '?search=' + encodeURIComponent("'; DROP TABLE food_items;--"),
      '?page=-5&pageSize=-1',
      '?page=1&pageSize=100000',
      '?restaurantId=0',
      '?restaurantId=-1',
      '?restaurantId=abc',
      '?sort=price&order=DROP',
    ];
    for (const q of qs) {
      const r = await api('GET', `/api/restaurants/foods${q}`, { token: tokens[CUSTOMER] });
      expectStatus(`W9-F foods${q.slice(0, 40)}`, r.status, [200, 400], '');
    }
  }

  // --- Customer order pagination ---
  {
    const pages = ['', '?page=-1', '?page=0', '?page=1&pageSize=0', '?page=1&pageSize=5000', '?page=9999'];
    for (const q of pages) {
      const r = await api('GET', `/api/FoodOrders${q}`, { token: tokens[CUSTOMER] });
      expectStatus(`W9-O my${q || '(default)'}`, r.status, [200, 400], '');
    }
  }

  // --- Address coord extremes ---
  {
    const bodies = [
      { label: 'Pole', addressLine1: 'N', city: 'Jaipur', state: 'Rajasthan', pinCode: '302001', latitude: 90, longitude: 0 },
      { label: 'Bad', addressLine1: 'N', city: 'Jaipur', state: 'Rajasthan', pinCode: '302001', latitude: 91, longitude: 0 },
      { label: 'Ocean', addressLine1: 'N', city: 'Jaipur', state: 'Rajasthan', pinCode: '302001', latitude: 0, longitude: 0 },
      { label: 'Neg', addressLine1: 'N', city: 'Jaipur', state: 'Rajasthan', pinCode: '302001', latitude: -91, longitude: 200 },
      { label: 'Str', addressLine1: 'N', city: 'Jaipur', state: 'Rajasthan', pinCode: '302001', latitude: 'NaN', longitude: 'x' },
    ];
    // D0 pole (90,0) ok; D1/D3 out-of-range → 400; D2 (0,0) unset ok; D4 NaN → 400
    const wantCoord = [200, 400, 200, 400, 400];
    for (let i = 0; i < bodies.length; i++) {
      const r = await api('POST', '/api/addresses', { token: tokens[DUMMIES[2]], body: bodies[i] });
      expectStatus(`W9-D${i} coord`, r.status, wantCoord[i], '');
    }
  }

  // --- Coupon amount extremes ---
  {
    const amts = [0, -1, 0.01, 1e12, 'abc', null];
    for (let i = 0; i < amts.length; i++) {
      const body = amts[i] === null ? { code: 'SAVE50' } : { code: 'SAVE50', orderAmount: amts[i] };
      const r = await api('POST', '/api/coupons/validate', { token: tokens[CUSTOMER], body });
      expectStatus(`W9-K${i} coupon amt`, r.status, [200, 400, 404, 422], '');
    }
  }

  // --- Marketplace edit foreign ---
  {
    const cats = unwrapList((await api('GET', '/api/marketplace/categories', { token: tokens[CUSTOMER] })).json);
    const catId = cats[0]?.id || 1;
    const created = await api('POST', '/api/marketplace/listings', {
      token: tokens[CUSTOMER],
      body: { title: `W9 ${SEED}`, description: 'w9', price: 99, categoryId: catId, condition: 'USED', city: 'Jaipur' },
    });
    expectStatus('W9-M01 create', created.status, [200, 201, 400], '');
    const lid = created.json?.data?.id;
    if (lid) {
      // try action-style edit if supported, else PUT-ish paths
      const editPaths = [
        ['POST', '/api/marketplace/listings', { action: 'EDIT', id: lid, title: 'hacked', price: 1, categoryId: catId }],
        ['PUT', `/api/marketplace/${lid}`, { title: 'hacked', price: 1 }],
        ['PUT', `/api/marketplace/listings/${lid}`, { title: 'hacked', price: 1 }],
      ];
      for (let i = 0; i < editPaths.length; i++) {
        const [method, path, body] = editPaths[i];
        const r = await api(method, path, { token: tokens[CUSTOMER_B], body });
        expectStatus(`W9-M1${i} foreign edit`, r.status, [400, 401, 403, 404, 405], '');
      }
      const selfReport = await api('POST', `/api/marketplace/listings/${lid}/report`, {
        token: tokens[CUSTOMER],
        body: { reason: 'spam', details: `W9 ${SEED}` },
      });
      expectStatus('W9-M20 report own', selfReport.status, [200, 400, 403, 409], '');
    }
  }

  // --- Place two orders, READY, captain accept one, double deliver ---
  {
    await api('POST', '/api/driver/toggle-online', { token: tokens[CAPTAIN], body: { isOnline: true } });
    const place = await api('POST', '/api/FoodOrders', {
      token: tokens[CUSTOMER],
      body: {
        restaurantId: Number(foodR2.restaurantId),
        addressId: addrs[CUSTOMER],
        paymentMethod: 'COD',
        notes: `W9-dd-${SEED}`,
        items: [{ foodItemId: foodR2.id, quantity: 1 }],
      },
    });
    expectStatus('W9-C10 place', place.status, 200, '');
    if (place.status === 200) {
      const oid = place.json.data.id;
      tracked.push({ id: oid, token: tokens[CUSTOMER] });
      await api('PUT', `/api/vendor/orders/${oid}/status`, { token: tokens[OWNER], body: { status: 'ACCEPTED' } });
      await api('PUT', `/api/vendor/orders/${oid}/status`, { token: tokens[OWNER], body: { status: 'READY' } });
      const avail = await api('GET', '/api/driver/available-food-orders', { token: tokens[CAPTAIN] });
      expectStatus('W9-C11 available-food', avail.status, [200], '');
      const acc = await api('POST', `/api/driver/food-orders/${oid}/accept`, { token: tokens[CAPTAIN], body: {} });
      expectStatus('W9-C12 accept', acc.status, [200, 409], '');
      if (acc.status === 200) {
        const pick = await api('POST', `/api/driver/food-orders/${oid}/pickup`, { token: tokens[CAPTAIN], body: {} });
        expectStatus('W9-C13 pickup', pick.status, [200, 400, 409], '');
        if (pick.status === 200) {
          const d1 = await api('POST', `/api/driver/food-orders/${oid}/deliver`, { token: tokens[CAPTAIN], body: {} });
          expectStatus('W9-C14 deliver1', d1.status, [200], '');
          const d2 = await api('POST', `/api/driver/food-orders/${oid}/deliver`, { token: tokens[CAPTAIN], body: {} });
          expectStatus('W9-C15 double deliver', d2.status, [400, 404, 409], '');
        } else {
          await api('POST', `/api/FoodOrders/${oid}/cancel`, { token: tokens[CUSTOMER], body: {} });
        }
      }
    }
  }

  // --- Concurrent cancel distinct orders ---
  {
    const places = await Promise.all(
      [CUSTOMER, CUSTOMER_B].map((m) =>
        api('POST', '/api/FoodOrders', {
          token: tokens[m],
          body: {
            restaurantId: Number(foodR2.restaurantId),
            addressId: addrs[m],
            paymentMethod: 'COD',
            notes: `W9-cc-${m}-${SEED}`,
            items: [{ foodItemId: foodR2.id, quantity: 1 }],
          },
        }),
      ),
    );
    const ids = places.filter((p) => p.status === 200).map((p, i) => ({
      id: p.json.data.id,
      token: tokens[i === 0 ? CUSTOMER : CUSTOMER_B],
    }));
    for (const o of ids) tracked.push(o);
    if (ids.length === 2) {
      const cancels = await Promise.all(
        ids.map((o) => api('POST', `/api/FoodOrders/${o.id}/cancel`, { token: o.token, body: {} })),
      );
      const okN = cancels.filter((c) => c.status === 200).length;
      if (okN === 2) pass('W9-X01 dual distinct cancel', '200,200');
      else fail('W9-X01 dual distinct cancel', cancels.map((c) => c.status).join(','));
    } else {
      pass('W9-X01 skip place', places.map((p) => p.status).join(','));
    }
  }

  // --- Driver cancel-ride junk ---
  {
    const junk = [0, -1, 99999999];
    for (const id of junk) {
      const r = await api('POST', `/api/driver/rides/${id}/cancel`, {
        token: tokens[CAPTAIN],
        body: { reason: `W9 ${SEED}` },
      });
      expectStatus(`W9-R cancel ride ${id}`, r.status, [400, 403, 404], '');
    }
    const cust = await api('POST', '/api/driver/rides/1/cancel', {
      token: tokens[CUSTOMER],
      body: { reason: 'nope' },
    });
    expectStatus('W9-R customer cancel-ride', cust.status, [401, 403, 404], '');
  }

  // --- Witty alert spam ---
  {
    const storm = await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        api('POST', '/api/notifications/witty-alert', {
          token: tokens[CUSTOMER],
          body: { message: `W9 witty ${SEED} ${i}` },
        }),
      ),
    );
    const serverErr = storm.filter((s) => s.status >= 500);
    if (serverErr.length === 0) pass('W9-N01 witty storm', storm.map((s) => s.status).join(','));
    else fail('W9-N01 witty storm', serverErr.map((s) => s.status).join(','));
  }

  // --- Admin login junk (no password leak) ---
  {
    const r1 = await api('POST', '/api/auth/admin-login', { body: {} });
    expectStatus('W9-AD empty', r1.status, [400, 401, 422], '');
    const r2 = await api('POST', '/api/auth/admin-login', {
      body: { mobileNumber: '9999999999', password: 'wrong', otpCode: '000000' },
    });
    expectStatus('W9-AD wrong', r2.status, [400, 401, 403], '');
  }

  await mapPool(tracked, 8, async (o) => {
    try { await api('POST', `/api/FoodOrders/${o.id}/cancel`, { token: o.token, body: {} }); } catch { /* ignore */ }
  });
  await api('POST', '/api/vendor/toggle-status', { token: tokens[OWNER], body: { isOpen: true } });

  const failed = results.filter((r) => !r.ok);
  const ok = results.filter((r) => r.ok);
  console.log(`\n=== CHAOS-W9 DONE seed=${SEED} PASS=${ok.length} FAIL=${failed.length} ms=${Date.now() - t0} ===`);
  if (failed.length) {
    for (const f of failed) console.log(`  FAIL ${f.name}: ${f.detail}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(2);
});
