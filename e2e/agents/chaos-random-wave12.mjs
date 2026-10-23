/**
 * Wave-12 random chaos: bearer/token fuzz, method weirdness on food place,
 * unicode/NUL notes, cross-user address theft on place, duplicate cart lines,
 * vendor status after cancel, dual-captain accept race, marketplace report
 * storm, payments my-payments pagination, config/banners public, admin
 * assign junk as customer, ride complete without start, food pay after cancel.
 * Usage: node e2e/agents/chaos-random-wave12.mjs [seed]
 */
const BASE = process.env.API_BASE_URL || 'https://makemytree.duckdns.org';
const OTP = process.env.TEST_OTP || '123456';
const SEED = parseInt(process.argv[2] || process.env.CHAOS_SEED || String(Date.now() % 1e9), 10);

const CUSTOMER = '7014065979';
const CUSTOMER_B = '9123456780';
const OWNER = '9900000004';
const CAPTAIN = '6375002348';
const DUMMIES = Array.from({ length: 8 }, (_, i) => String(9000001401 + i));

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

async function api(method, path, { token, body, rawBody, contentType, authRaw } = {}) {
  const headers = {};
  if (authRaw !== undefined) headers.Authorization = authRaw;
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
  console.log(`CHAOS-W12 seed=${SEED} BASE=${BASE}`);
  const t0 = Date.now();
  const tokens = {};
  const addrs = {};
  const tracked = [];

  // --- Token fuzz before bootstrap ---
  {
    const cases = [
      { authRaw: undefined },
      { authRaw: 'Bearer' },
      { authRaw: 'Bearer ' },
      { authRaw: 'Bearer not.a.jwt' },
      { authRaw: 'Basic dXNlcjpwYXNz' },
      { authRaw: 'Bearer ' + 'a'.repeat(4000) },
    ];
    for (let i = 0; i < cases.length; i++) {
      const r = await api('GET', '/api/auth/profile', cases[i]);
      expectStatus(`W12-T${i} profile auth`, r.status, [401, 403], '');
    }
  }

  const actors = [CUSTOMER, CUSTOMER_B, OWNER, CAPTAIN, ...DUMMIES];
  const boot = await mapPool(actors, 8, async (m, idx) => {
    const token = await login(m);
    const addressId = await ensureAddress(token, `W12 ${SEED} ${idx}`);
    return { m, token, addressId };
  });
  for (const b of boot) {
    tokens[b.m] = b.token;
    addrs[b.m] = b.addressId;
  }
  pass('W12-B01 bootstrap', `n=${actors.length}`);
  await api('POST', '/api/vendor/toggle-status', { token: tokens[OWNER], body: { isOpen: true } });
  await api('POST', '/api/driver/toggle-online', { token: tokens[CAPTAIN], body: { isOnline: true } });

  const foods = unwrapList((await api('GET', '/api/restaurants/foods?pageSize=80', { token: tokens[CUSTOMER] })).json);
  const foodR2 = foods.find((f) => f.restaurantId === 2) || foods[0];
  if (!foodR2?.id) { fail('W12-C01 foods', 'none'); process.exit(1); }
  pass('W12-C01 foods', `n=${foods.length}`);

  // --- Method weirdness ---
  {
    const r1 = await api('GET', '/api/FoodOrders', { token: tokens[CUSTOMER] });
    expectStatus('W12-M GET orders', r1.status, [200], '');
    const r2 = await api('DELETE', '/api/FoodOrders', { token: tokens[CUSTOMER] });
    expectStatus('W12-M DELETE orders', r2.status, [400, 404, 405], '');
    const r3 = await api('PATCH', `/api/FoodOrders/1`, { token: tokens[CUSTOMER], body: { status: 'HACK' } });
    expectStatus('W12-M PATCH order', r3.status, [400, 404, 405], '');
  }

  // --- Unicode / NUL notes ---
  {
    const notes = [
      `नमस्ते W12 ${SEED}`,
      'emoji 🔥🚀 ' + SEED,
      'nul\u0000inside',
      'a'.repeat(5000),
    ];
    for (let i = 0; i < notes.length; i++) {
      const r = await api('POST', '/api/FoodOrders', {
        token: tokens[DUMMIES[i % DUMMIES.length]],
        body: {
          restaurantId: Number(foodR2.restaurantId),
          addressId: addrs[DUMMIES[i % DUMMIES.length]],
          paymentMethod: 'COD',
          notes: notes[i],
          items: [{ foodItemId: foodR2.id, quantity: 1 }],
        },
      });
      expectStatus(`W12-U${i} notes`, r.status, [200, 400], '');
      if (r.status === 200) tracked.push({ id: r.json.data.id, token: tokens[DUMMIES[i % DUMMIES.length]] });
      if (r.status >= 500) fail(`W12-U${i} notes 5xx`, String(r.status));
    }
  }

  // --- Cross-user address theft on place ---
  {
    const r = await api('POST', '/api/FoodOrders', {
      token: tokens[CUSTOMER_B],
      body: {
        restaurantId: Number(foodR2.restaurantId),
        addressId: addrs[CUSTOMER],
        paymentMethod: 'COD',
        notes: `W12-steal-${SEED}`,
        items: [{ foodItemId: foodR2.id, quantity: 1 }],
      },
    });
    expectStatus('W12-X steal addr place', r.status, [403, 400], '');
  }

  // --- Duplicate cart lines ---
  {
    const r = await api('POST', '/api/FoodOrders', {
      token: tokens[CUSTOMER],
      body: {
        restaurantId: Number(foodR2.restaurantId),
        addressId: addrs[CUSTOMER],
        paymentMethod: 'COD',
        notes: `W12-dup-${SEED}`,
        items: [
          { foodItemId: foodR2.id, quantity: 1 },
          { foodItemId: foodR2.id, quantity: 2 },
        ],
      },
    });
    expectStatus('W12-D dup lines', r.status, [200, 400], '');
    if (r.status === 200) tracked.push({ id: r.json.data.id, token: tokens[CUSTOMER] });
  }

  // --- Vendor status after cancel ---
  {
    const place = await api('POST', '/api/FoodOrders', {
      token: tokens[CUSTOMER],
      body: {
        restaurantId: Number(foodR2.restaurantId),
        addressId: addrs[CUSTOMER],
        paymentMethod: 'COD',
        notes: `W12-canc-${SEED}`,
        items: [{ foodItemId: foodR2.id, quantity: 1 }],
      },
    });
    expectStatus('W12-V01 place', place.status, 200, '');
    if (place.status === 200) {
      const oid = place.json.data.id;
      const cancel = await api('POST', `/api/FoodOrders/${oid}/cancel`, { token: tokens[CUSTOMER], body: {} });
      expectStatus('W12-V02 cancel', cancel.status, [200], '');
      const st = await api('PUT', `/api/vendor/orders/${oid}/status`, {
        token: tokens[OWNER],
        body: { status: 'ACCEPTED' },
      });
      expectStatus('W12-V03 status after cancel', st.status, [400, 404, 409], '');
      const pay = await api('POST', `/api/FoodOrders/${oid}/pay`, {
        token: tokens[CUSTOMER],
        body: { paymentMethod: 'ONLINE' },
      });
      expectStatus('W12-V04 pay after cancel', pay.status, [400, 404, 409], '');
    }
  }

  // --- Dual captain accept race ---
  {
    const place = await api('POST', '/api/FoodOrders', {
      token: tokens[CUSTOMER_B],
      body: {
        restaurantId: Number(foodR2.restaurantId),
        addressId: addrs[CUSTOMER_B],
        paymentMethod: 'COD',
        notes: `W12-race-${SEED}`,
        items: [{ foodItemId: foodR2.id, quantity: 1 }],
      },
    });
    expectStatus('W12-R01 place', place.status, 200, '');
    if (place.status === 200) {
      const oid = place.json.data.id;
      tracked.push({ id: oid, token: tokens[CUSTOMER_B] });
      await api('PUT', `/api/vendor/orders/${oid}/status`, { token: tokens[OWNER], body: { status: 'ACCEPTED' } });
      await api('PUT', `/api/vendor/orders/${oid}/status`, { token: tokens[OWNER], body: { status: 'READY' } });
      const race = await Promise.all([
        api('POST', `/api/driver/food-orders/${oid}/accept`, { token: tokens[CAPTAIN], body: {} }),
        api('POST', `/api/driver/food-orders/${oid}/accept`, { token: tokens[CAPTAIN], body: {} }),
      ]);
      const oks = race.filter((x) => x.status === 200).length;
      const conflicts = race.filter((x) => [409, 400].includes(x.status)).length;
      const bad = race.filter((x) => x.status >= 500);
      if (bad.length) fail('W12-R02 dual accept', bad.map((x) => x.status).join(','));
      else if (oks === 1 && conflicts >= 1) pass('W12-R02 dual accept', race.map((x) => x.status).join(','));
      else if (oks === 1 && conflicts === 0) pass('W12-R02 dual accept idempotent', race.map((x) => x.status).join(','));
      else if (oks === 0) pass('W12-R02 dual accept none', race.map((x) => x.status).join(','));
      else fail('W12-R02 dual accept unexpected', race.map((x) => x.status).join(','));
      if (oks >= 1) {
        await api('POST', `/api/FoodOrders/${oid}/cancel`, { token: tokens[CUSTOMER_B], body: {} });
      }
    }
  }

  // --- Marketplace report storm ---
  {
    const cats = unwrapList((await api('GET', '/api/marketplace/categories', { token: tokens[CUSTOMER] })).json);
    const catId = cats[0]?.id || 1;
    const listing = await api('POST', '/api/marketplace/listings', {
      token: tokens[CUSTOMER],
      body: {
        title: `W12 report ${SEED}`,
        description: 'w12',
        price: 88,
        categoryId: catId,
        condition: 'USED',
        city: 'Jaipur',
      },
    });
    expectStatus('W12-MR listing', listing.status, [200, 201, 400], '');
    const lid = listing.json?.data?.id;
    if (lid) {
      const storm = await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          api('POST', `/api/marketplace/listings/${lid}/report`, {
            token: tokens[DUMMIES[i % DUMMIES.length]],
            body: { reason: 'spam', details: `W12 ${SEED} ${i}` },
          }),
        ),
      );
      const bad = storm.filter((s) => s.status >= 500);
      if (bad.length === 0) pass('W12-MR report storm', storm.map((s) => s.status).join(','));
      else fail('W12-MR report storm', bad.map((s) => s.status).join(','));
    }
  }

  // --- my-payments pagination ---
  {
    const qs = ['', '?page=-1', '?page=1&pageSize=0', '?page=1&pageSize=5000'];
    for (const q of qs) {
      const r = await api('GET', `/api/payments/my-payments${q}`, { token: tokens[CUSTOMER] });
      expectStatus(`W12-P my${q || '(def)'}`, r.status, [200, 400], '');
    }
  }

  // --- Config / banners public ---
  {
    const cfg = await api('GET', '/api/config');
    expectStatus('W12-CB config', cfg.status, [200], '');
    const ban = await api('GET', '/api/banners');
    expectStatus('W12-CB banners', ban.status, [200], '');
  }

  // --- Admin assign as customer ---
  {
    const r = await api('POST', '/api/admin/users/assign', {
      token: tokens[CUSTOMER],
      body: { userId: 1, role: 'ADMIN' },
    });
    expectStatus('W12-AD assign', r.status, [401, 403], '');
    const r2 = await api('POST', '/api/admin/restaurants', {
      token: tokens[CUSTOMER],
      body: { name: 'Hack Hotel' },
    });
    expectStatus('W12-AD create rest', r2.status, [401, 403], '');
  }

  // --- Ride complete without start ---
  {
    const r = await api('POST', '/api/rides/99999999/complete', {
      token: tokens[CUSTOMER],
      body: {},
    });
    expectStatus('W12-RC complete junk', r.status, [400, 403, 404], '');
    const r2 = await api('POST', '/api/rides/1/start', {
      token: tokens[CUSTOMER],
      body: {},
    });
    expectStatus('W12-RC start as cust', r2.status, [400, 403, 404], '');
  }

  // --- Vendor orders list as customer ---
  {
    const r = await api('GET', '/api/vendor/orders', { token: tokens[CUSTOMER] });
    expectStatus('W12-VO cust orders', r.status, [401, 403, 404], '');
    const r2 = await api('GET', '/api/vendor/orders', { token: tokens[OWNER] });
    expectStatus('W12-VO owner orders', r2.status, [200], '');
  }

  // cleanup
  await mapPool(tracked, 8, async (o) => {
    try { await api('POST', `/api/FoodOrders/${o.id}/cancel`, { token: o.token, body: {} }); } catch { /* ignore */ }
  });
  await api('POST', '/api/vendor/toggle-status', { token: tokens[OWNER], body: { isOpen: true } });

  const failed = results.filter((r) => !r.ok);
  const ok = results.filter((r) => r.ok);
  console.log(`\n=== CHAOS-W12 DONE seed=${SEED} PASS=${ok.length} FAIL=${failed.length} ms=${Date.now() - t0} ===`);
  if (failed.length) {
    for (const f of failed) console.log(`  FAIL ${f.name}: ${f.detail}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(2);
});
