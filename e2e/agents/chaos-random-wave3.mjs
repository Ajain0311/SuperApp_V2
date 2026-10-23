/**
 * Wave-3 random chaos: race storms, coupon edges, captain offline races,
 * address ownership, marketplace offer junk, ride estimate fuzz.
 * Usage: node e2e/agents/chaos-random-wave3.mjs [seed]
 */
const BASE = process.env.API_BASE_URL || 'https://makemytree.duckdns.org';
const OTP = process.env.TEST_OTP || '123456';
const SEED = parseInt(process.argv[2] || process.env.CHAOS_SEED || String(Date.now() % 1e9), 10);

const CUSTOMER = '7014065979';
const CUSTOMER_B = '9123456780';
const OWNER = '9900000004';
const CAPTAIN = '6375002348';
const DUMMIES = Array.from({ length: 10 }, (_, i) => String(9000000501 + i));

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
  console.log(`CHAOS-W3 seed=${SEED} BASE=${BASE}`);
  const t0 = Date.now();
  const tokens = {};
  const addrs = {};
  const tracked = [];

  const actors = [CUSTOMER, CUSTOMER_B, OWNER, CAPTAIN, ...DUMMIES];
  const boot = await mapPool(actors, 10, async (m, idx) => {
    const token = await login(m);
    const addressId = await ensureAddress(token, `W3 ${SEED} ${idx}`);
    return { m, token, addressId };
  });
  for (const b of boot) {
    tokens[b.m] = b.token;
    addrs[b.m] = b.addressId;
  }
  pass('W3-B01 bootstrap', `n=${actors.length}`);

  const foods = unwrapList((await api('GET', '/api/restaurants/foods?pageSize=80', { token: tokens[CUSTOMER] })).json);
  const byRest = new Map();
  for (const f of foods) if (f?.restaurantId && f?.id) byRest.set(f.restaurantId, f);
  const rids = [...byRest.keys()];
  if (rids.length < 2) { fail('W3-C01', 'need 2 restaurants'); process.exit(1); }
  pass('W3-C01 restaurants', `${rids.length}`);
  const foodA = byRest.get(rids[0]);
  const foodB = byRest.get(rids[1]);
  const foodR2 = byRest.get(2) || foodA;

  // Coupon single-hotel invalid code
  {
    const r = await api('POST', '/api/foodorders/checkout', {
      token: tokens[CUSTOMER],
      body: {
        addressId: addrs[CUSTOMER],
        paymentMethod: 'COD',
        couponCode: `NOPE${SEED}`,
        items: [{ foodItemId: foodA.id, quantity: 1 }],
      },
    });
    expectStatus('W3-X01 bad coupon single', r.status, [200, 400], r.json?.message || '');
    if (r.status === 200 && r.json?.data?.orders?.[0]?.id) {
      tracked.push({ id: r.json.data.orders[0].id, token: tokens[CUSTOMER] });
    } else if (r.status === 200 && r.json?.data?.id) {
      tracked.push({ id: r.json.data.id, token: tokens[CUSTOMER] });
    }
  }

  // Same-second cancel race: place then dual cancel
  {
    const place = await api('POST', '/api/FoodOrders', {
      token: tokens[CUSTOMER],
      body: {
        restaurantId: Number(foodR2.restaurantId),
        addressId: addrs[CUSTOMER],
        paymentMethod: 'COD',
        notes: `W3-dcancel-${SEED}`,
        items: [{ foodItemId: foodR2.id, quantity: 1 }],
      },
    });
    expectStatus('W3-R01 place for dual cancel', place.status, 200, '');
    if (place.status === 200) {
      const oid = place.json.data.id;
      tracked.push({ id: oid, token: tokens[CUSTOMER] });
      const [c1, c2] = await Promise.all([
        api('POST', `/api/FoodOrders/${oid}/cancel`, { token: tokens[CUSTOMER], body: {} }),
        api('POST', `/api/FoodOrders/${oid}/cancel`, { token: tokens[CUSTOMER], body: {} }),
      ]);
      const statuses = [c1.status, c2.status].sort();
      const oneOk = statuses.filter((s) => s === 200).length === 1;
      const otherBlocked = statuses.filter((s) => s === 400 || s === 409).length >= 1;
      if (oneOk && otherBlocked) pass('W3-R02 dual cancel race', statuses.join(','));
      else fail('W3-R02 dual cancel race', statuses.join(','));
    }
  }

  // Owner status race ACCEPTED vs customer cancel
  {
    const place = await api('POST', '/api/FoodOrders', {
      token: tokens[CUSTOMER],
      body: {
        restaurantId: Number(foodR2.restaurantId),
        addressId: addrs[CUSTOMER],
        paymentMethod: 'COD',
        notes: `W3-ownercancel-${SEED}`,
        items: [{ foodItemId: foodR2.id, quantity: 1 }],
      },
    });
    if (place.status === 200) {
      const oid = place.json.data.id;
      tracked.push({ id: oid, token: tokens[CUSTOMER] });
      const [v, c] = await Promise.all([
        api('PUT', `/api/vendor/orders/${oid}/status`, { token: tokens[OWNER], body: { status: 'ACCEPTED' } }),
        api('POST', `/api/FoodOrders/${oid}/cancel`, { token: tokens[CUSTOMER], body: {} }),
      ]);
      const det = await api('GET', `/api/FoodOrders/${oid}`, { token: tokens[CUSTOMER] });
      const st = det.json?.data?.status;
      if (['CANCELLED', 'ACCEPTED'].includes(st) && [v.status, c.status].every((s) => s === 200 || s === 400 || s === 409)) {
        pass('W3-R03 owner-accept vs cancel race', `final=${st} v=${v.status} c=${c.status}`);
      } else {
        fail('W3-R03 owner-accept vs cancel race', `final=${st} v=${v.status} c=${c.status}`);
      }
      if (st !== 'CANCELLED') await api('POST', `/api/FoodOrders/${oid}/cancel`, { token: tokens[CUSTOMER], body: {} });
    }
  }

  // Captain accept race on one READY (single captain double-fire)
  {
    const place = await api('POST', '/api/FoodOrders', {
      token: tokens[CUSTOMER],
      body: {
        restaurantId: Number(foodR2.restaurantId),
        addressId: addrs[CUSTOMER],
        paymentMethod: 'COD',
        notes: `W3-acceptrace-${SEED}`,
        items: [{ foodItemId: foodR2.id, quantity: 1 }],
      },
    });
    if (place.status === 200) {
      const oid = place.json.data.id;
      tracked.push({ id: oid, token: tokens[CUSTOMER] });
      for (const st of ['ACCEPTED', 'PREPARING', 'READY']) {
        await api('PUT', `/api/vendor/orders/${oid}/status`, { token: tokens[OWNER], body: { status: st } });
      }
      await api('POST', '/api/driver/toggle-online', { token: tokens[CAPTAIN], body: { isOnline: true } });
      const [a1, a2] = await Promise.all([
        api('POST', `/api/driver/food-orders/${oid}/accept`, { token: tokens[CAPTAIN], body: {} }),
        api('POST', `/api/driver/food-orders/${oid}/accept`, { token: tokens[CAPTAIN], body: {} }),
      ]);
      const ok = [a1.status, a2.status].includes(200) && [a1.status, a2.status].some((s) => s === 400 || s === 409);
      if (ok || ([a1.status, a2.status].filter((s) => s === 200).length === 1)) pass('W3-R04 double accept race', `${a1.status},${a2.status}`);
      else fail('W3-R04 double accept race', `${a1.status},${a2.status}`);
      await api('POST', `/api/FoodOrders/${oid}/cancel`, { token: tokens[CUSTOMER], body: {} });
    }
  }

  // Address update foreign + set default
  {
    const foreign = await api('PUT', `/api/addresses/${addrs[CUSTOMER_B]}`, {
      token: tokens[CUSTOMER],
      body: {
        label: 'Hack',
        addressLine1: 'Nope',
        city: 'Jaipur',
        state: 'Rajasthan',
        pinCode: '302001',
        isDefault: true,
      },
    });
    expectStatus('W3-AD01 update foreign address', foreign.status, [403, 404], '');

    const setDef = await api('PUT', `/api/addresses/${addrs[CUSTOMER]}/default`, { token: tokens[CUSTOMER], body: {} });
    expectStatus('W3-AD02 set default own', setDef.status, [200, 204], '');
  }

  // Ride estimate fuzz
  {
    const coords = shuffle([
      { name: 'same point', pickupLat: 26.91, pickupLng: 75.78, dropLat: 26.91, dropLng: 75.78 },
      { name: 'far', pickupLat: 26.91, pickupLng: 75.78, dropLat: 28.61, dropLng: 77.20 },
      { name: 'neg', pickupLat: -91, pickupLng: 75, dropLat: 26, dropLng: 75 },
      { name: 'ocean', pickupLat: 0.1, pickupLng: 0.1, dropLat: 0.2, dropLng: 0.2 },
    ]);
    for (const c of coords) {
      const r = await api('POST', '/api/rides/estimate', {
        token: tokens[CUSTOMER],
        body: { ...c, vehicleType: pick(['BIKE', 'AUTO', 'CAB', 'CAR', 'XYZ']) },
      });
      if (r.status >= 500) fail(`W3-RIDE ${c.name}`, `status=${r.status}`);
      else pass(`W3-RIDE ${c.name}`, `status=${r.status}`);
    }
  }

  // Marketplace offer junk
  {
    const listings = unwrapList((await api('GET', '/api/marketplace?pageSize=5', { token: tokens[CUSTOMER] })).json);
    const lid = listings[0]?.id;
    if (lid) {
      const offer = await api('POST', `/api/marketplace/listings/${lid}/offer`, {
        token: tokens[CUSTOMER],
        body: { offeredPrice: -10, message: 'low' },
      });
      expectStatus('W3-M01 neg offer', offer.status, [400, 403, 422], offer.json?.message || '');

      const report = await api('POST', `/api/marketplace/listings/${lid}/report`, {
        token: tokens[CUSTOMER],
        body: { reason: 'spam' },
      });
      expectStatus('W3-M02 report listing', report.status, [200, 400, 404], '');
    } else {
      pass('W3-M01 skip no listings', '');
    }

    const favMissing = await api('POST', '/api/marketplace/favorites/99999999', { token: tokens[CUSTOMER] });
    expectStatus('W3-M03 fav missing', favMissing.status, [400, 404], favMissing.json?.message || '');
  }

  // Burst place from dummies then owner list isolation
  {
    const storm = await mapPool(DUMMIES.slice(0, 8), 8, async (m, idx) => {
      const rid = rids[idx % rids.length];
      const r = await api('POST', '/api/FoodOrders', {
        token: tokens[m],
        body: {
          restaurantId: rid,
          addressId: addrs[m],
          paymentMethod: 'COD',
          notes: `W3-burst-${SEED}-${idx}`,
          items: [{ foodItemId: byRest.get(rid).id, quantity: 1 }],
        },
      });
      return { m, status: r.status, order: r.json?.data, rid };
    });
    const ok = storm.every((p) => p.status === 200);
    if (ok) pass('W3-S01 burst place', `n=${storm.length}`);
    else fail('W3-S01 burst place', JSON.stringify(storm.filter((p) => p.status !== 200).slice(0, 3)));
    for (const p of storm) if (p.order?.id) tracked.push({ id: p.order.id, token: tokens[p.m] });

    const vlist = await api('GET', '/api/vendor/orders', { token: tokens[OWNER] });
    const foreign = unwrapList(vlist.json).filter((o) => Number(o.restaurantId) !== 2);
    if (vlist.status === 200 && foreign.length === 0) pass('W3-S02 owner isolation after burst', '');
    else fail('W3-S02 owner isolation after burst', `foreign=${foreign.length}`);
  }

  // Toggle online junk body
  {
    const bad = await api('POST', '/api/driver/toggle-online', { token: tokens[CAPTAIN], rawBody: '{}' });
    expectStatus('W3-D01 toggle missing isOnline', bad.status, [400, 415, 422], '');
    await api('POST', '/api/driver/toggle-online', { token: tokens[CAPTAIN], body: { isOnline: false } });
  }

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
  pass('W3-Z90 cleanup', `cleaned=${cleaned} tracked=${tracked.length}`);

  const health = await api('GET', '/health');
  expectStatus('W3-Z99 health', health.status, 200, '');

  const failed = results.filter((r) => !r.ok);
  console.log(`\n==== CHAOS-W3 seed=${SEED} PASS=${results.length - failed.length} FAIL=${failed.length} TOTAL=${results.length} elapsedMs=${Date.now() - t0} ====`);
  for (const f of failed) console.log(`[FAIL] ${f.name} :: ${f.detail}`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
