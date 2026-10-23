/**
 * Wave-5 random chaos: marketplace offer/report fuzz, ride book without estimate,
 * concurrent fav toggle storm, soft-delete address then place, driver location spam,
 * device-token junk, documents authz, ONLINE payment without proof, idor probes.
 * Usage: node e2e/agents/chaos-random-wave5.mjs [seed]
 */
const BASE = process.env.API_BASE_URL || 'https://makemytree.duckdns.org';
const OTP = process.env.TEST_OTP || '123456';
const SEED = parseInt(process.argv[2] || process.env.CHAOS_SEED || String(Date.now() % 1e9), 10);

const CUSTOMER = '7014065979';
const CUSTOMER_B = '9123456780';
const OWNER = '9900000004';
const CAPTAIN = '6375002348';
const DUMMIES = Array.from({ length: 10 }, (_, i) => String(9000000701 + i));

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
  console.log(`CHAOS-W5 seed=${SEED} BASE=${BASE}`);
  const t0 = Date.now();
  const tokens = {};
  const addrs = {};
  const tracked = [];

  const actors = [CUSTOMER, CUSTOMER_B, OWNER, CAPTAIN, ...DUMMIES];
  const boot = await mapPool(actors, 10, async (m, idx) => {
    const token = await login(m);
    const addressId = await ensureAddress(token, `W5 ${SEED} ${idx}`);
    return { m, token, addressId };
  });
  for (const b of boot) {
    tokens[b.m] = b.token;
    addrs[b.m] = b.addressId;
  }
  pass('W5-B01 bootstrap', `n=${actors.length}`);

  const foods = unwrapList((await api('GET', '/api/restaurants/foods?pageSize=80', { token: tokens[CUSTOMER] })).json);
  const byRest = new Map();
  for (const f of foods) if (f?.restaurantId && f?.id) byRest.set(f.restaurantId, f);
  const foodR2 = byRest.get(2) || foods[0];
  if (!foodR2?.id) { fail('W5-C01', 'no foods'); process.exit(1); }
  pass('W5-C01 foods', `${foods.length}`);

  // ---- A: Soft-delete / deactivate address then place ----
  {
    const created = await api('POST', '/api/addresses', {
      token: tokens[CUSTOMER],
      body: {
        label: `Temp${SEED}`,
        addressLine1: `Temp Lane ${SEED}`,
        city: 'Jaipur',
        state: 'Rajasthan',
        pinCode: '302018',
        isDefault: false,
      },
    });
    expectStatus('W5-A01 create temp addr', created.status, 200, '');
    const tempId = created.json?.data?.id;
    if (tempId) {
      const del = await api('DELETE', `/api/addresses/${tempId}`, { token: tokens[CUSTOMER] });
      expectStatus('W5-A02 delete temp addr', del.status, [200, 204], '');

      const place = await api('POST', '/api/FoodOrders', {
        token: tokens[CUSTOMER],
        body: {
          restaurantId: Number(foodR2.restaurantId),
          addressId: tempId,
          paymentMethod: 'COD',
          notes: `W5-deadaddr-${SEED}`,
          items: [{ foodItemId: foodR2.id, quantity: 1 }],
        },
      });
      expectStatus('W5-A03 place on deleted addr', place.status, [400, 404], place.json?.message || '');
      if (place.status === 200 && place.json?.data?.id) {
        tracked.push({ id: place.json.data.id, token: tokens[CUSTOMER] });
        fail('W5-A03b deleted addr accepted', String(place.json.data.id));
      }

      // B tries delete A's address
      const crossDel = await api('DELETE', `/api/addresses/${addrs[CUSTOMER]}`, { token: tokens[CUSTOMER_B] });
      expectStatus('W5-A04 cross-user addr delete', crossDel.status, [403, 404], '');
    }
  }

  // ---- F: Concurrent favorite toggle storm ----
  {
    const mp = unwrapList((await api('GET', '/api/marketplace?pageSize=20', { token: tokens[CUSTOMER] })).json);
    const listing = mp.find((x) => x?.id) || mp[0];
    if (listing?.id) {
      const lid = listing.id;
      const storm = await Promise.all(
        Array.from({ length: 12 }, () =>
          api('POST', `/api/marketplace/favorites/${lid}`, { token: tokens[CUSTOMER], body: {} }),
        ),
      );
      const codes = storm.map((s) => s.status);
      const allOk = codes.every((c) => [200, 201, 400, 404, 409].includes(c));
      if (allOk) pass('W5-F01 fav storm', codes.join(','));
      else fail('W5-F01 fav storm', codes.join(','));

      const miss = await api('POST', `/api/marketplace/favorites/999999999`, { token: tokens[CUSTOMER], body: {} });
      expectStatus('W5-F02 fav missing listing', miss.status, [404, 400], '');

      const unauth = await api('POST', `/api/marketplace/favorites/${lid}`, { body: {} });
      expectStatus('W5-F03 fav unauth', unauth.status, [401, 403], '');

      // Offer junk
      const offer = await api('POST', `/api/marketplace/listings/${lid}/offer`, {
        token: tokens[CUSTOMER_B],
        body: { amount: -10, message: `W5 offer ${SEED}` },
      });
      expectStatus('W5-F10 offer negative', offer.status, [400, 422], '');

      const offer2 = await api('POST', `/api/marketplace/listings/${lid}/offer`, {
        token: tokens[CUSTOMER_B],
        body: { amount: 1e12, message: 'x'.repeat(5000) },
      });
      expectStatus('W5-F11 offer huge', offer2.status, [200, 400, 413, 422], '');

      const report = await api('POST', `/api/marketplace/listings/${lid}/report`, {
        token: tokens[CUSTOMER],
        body: { reason: `spam ${SEED}`, details: '<script>' },
      });
      expectStatus('W5-F12 report listing', report.status, [200, 201, 400, 404], '');
    } else {
      pass('W5-F01 skip no listings', '');
    }
  }

  // ---- R: Ride book / estimate edges ----
  {
    const jaipur = {
      pickupLat: 26.9124 + (rand() - 0.5) * 0.05,
      pickupLng: 75.7873 + (rand() - 0.5) * 0.05,
      dropLat: 26.85 + (rand() - 0.5) * 0.05,
      dropLng: 75.8 + (rand() - 0.5) * 0.05,
    };

    const est = await api('POST', '/api/rides/estimate', {
      token: tokens[CUSTOMER],
      body: { ...jaipur, vehicleType: 'BIKE' },
    });
    expectStatus('W5-R01 estimate bike', est.status, [200, 400], est.json?.message || '');

    const bookNoEst = await api('POST', '/api/rides/book', {
      token: tokens[CUSTOMER],
      body: {
        ...jaipur,
        vehicleType: 'BIKE',
        paymentMethod: 'COD',
        quotedFare: 1,
      },
    });
    // Client-trusted fare must be rejected or recalculated server-side
    expectStatus('W5-R02 book cheap fare', bookNoEst.status, [200, 400, 409], '');
    if (bookNoEst.status === 200 && bookNoEst.json?.data?.id) {
      const rid = bookNoEst.json.data.id;
      const fare = bookNoEst.json.data.fare ?? bookNoEst.json.data.totalFare;
      if (fare != null && Number(fare) <= 1) {
        fail('W5-R02b trusted client fare=1', String(fare));
      } else {
        pass('W5-R02b server fare ok', String(fare));
      }
      await api('POST', `/api/rides/${rid}/cancel`, { token: tokens[CUSTOMER], body: {} });
    }

    const samePt = await api('POST', '/api/rides/estimate', {
      token: tokens[CUSTOMER],
      body: {
        pickupLat: 26.9,
        pickupLng: 75.8,
        dropLat: 26.9,
        dropLng: 75.8,
        vehicleType: 'AUTO',
      },
    });
    expectStatus('W5-R03 same pickup/drop', samePt.status, [400, 422], '');

    const ocean = await api('POST', '/api/rides/estimate', {
      token: tokens[CUSTOMER],
      body: {
        pickupLat: 0,
        pickupLng: 0,
        dropLat: 1,
        dropLng: 1,
        vehicleType: 'CAR',
      },
    });
    expectStatus('W5-R04 ocean coords', ocean.status, [400, 422], '');

    const badVeh = await api('POST', '/api/rides/estimate', {
      token: tokens[CUSTOMER],
      body: { ...jaipur, vehicleType: 'SPACESHIP' },
    });
    expectStatus('W5-R05 bad vehicle', badVeh.status, [400, 422], '');

    // Customer tries captain accept on random id
    const fakeAccept = await api('POST', '/api/driver/rides/999999/accept', {
      token: tokens[CUSTOMER],
      body: {},
    });
    expectStatus('W5-R10 customer ride accept', fakeAccept.status, [401, 403, 404], '');
  }

  // ---- L: Driver location spam / invalid ----
  {
    await api('POST', '/api/driver/toggle-online', { token: tokens[CAPTAIN], body: { isOnline: true } });
    const locs = [
      { lat: 26.91, lng: 75.78 },
      { lat: 91, lng: 181 },
      { lat: -999, lng: NaN },
      { latitude: 26.9, longitude: 75.8 },
      {},
    ];
    for (let i = 0; i < locs.length; i++) {
      const r = await api('POST', '/api/driver/location', { token: tokens[CAPTAIN], body: locs[i] });
      expectStatus(`W5-L0${i + 1} location`, r.status, [200, 400, 422], JSON.stringify(locs[i]).slice(0, 40));
    }
    const custLoc = await api('POST', '/api/driver/location', {
      token: tokens[CUSTOMER],
      body: { lat: 26.9, lng: 75.8 },
    });
    expectStatus('W5-L10 customer location', custLoc.status, [401, 403], '');
  }

  // ---- D: Device token / documents ----
  {
    const d1 = await api('POST', '/api/notifications/device-token', {
      token: tokens[CUSTOMER],
      body: { token: `chaos-w5-${SEED}`, platform: 'android' },
    });
    expectStatus('W5-D01 device token', d1.status, [200, 201, 400, 404], '');

    const d2 = await api('POST', '/api/notifications/device-token', {
      token: tokens[CUSTOMER],
      body: { token: '', platform: 'ios' },
    });
    expectStatus('W5-D02 empty device token', d2.status, [400, 422], '');

    const doc = await api('GET', '/api/documents/DOESNOTEXIST/image', { token: tokens[CUSTOMER] });
    expectStatus('W5-D10 missing document image', doc.status, [401, 403, 404], '');

    const docUnauth = await api('GET', '/api/documents/DOESNOTEXIST/image');
    expectStatus('W5-D11 unauth document', docUnauth.status, [401, 403, 404], '');
  }

  // ---- O: ONLINE payment without gateway proof ----
  {
    const place = await api('POST', '/api/FoodOrders', {
      token: tokens[CUSTOMER],
      body: {
        restaurantId: Number(foodR2.restaurantId),
        addressId: addrs[CUSTOMER],
        paymentMethod: 'ONLINE',
        notes: `W5-online-${SEED}`,
        items: [{ foodItemId: foodR2.id, quantity: 1 }],
      },
    });
    // Either blocked, or created unpaid — must not claim PAID
    expectStatus('W5-O01 ONLINE place', place.status, [200, 400], '');
    if (place.status === 200 && place.json?.data) {
      const d = place.json.data;
      const oid = d.id || d.orders?.[0]?.id;
      const ps = (d.paymentStatus || d.orders?.[0]?.paymentStatus || '').toUpperCase();
      if (ps === 'PAID') fail('W5-O02 ONLINE instant PAID', ps);
      else pass('W5-O02 ONLINE not PAID', ps || 'unset');
      if (oid) {
        tracked.push({ id: oid, token: tokens[CUSTOMER] });
        await api('POST', `/api/FoodOrders/${oid}/cancel`, { token: tokens[CUSTOMER], body: {} });
      }
    }
  }

  // ---- I: IDOR probes on food order detail ----
  {
    const place = await api('POST', '/api/FoodOrders', {
      token: tokens[CUSTOMER],
      body: {
        restaurantId: Number(foodR2.restaurantId),
        addressId: addrs[CUSTOMER],
        paymentMethod: 'COD',
        notes: `W5-idor-${SEED}`,
        items: [{ foodItemId: foodR2.id, quantity: 1 }],
      },
    });
    if (place.status === 200) {
      const oid = place.json.data.id;
      tracked.push({ id: oid, token: tokens[CUSTOMER] });
      const cross = await api('GET', `/api/FoodOrders/${oid}`, { token: tokens[CUSTOMER_B] });
      expectStatus('W5-I01 cross-customer GET order', cross.status, [403, 404], '');

      const cancelCross = await api('POST', `/api/FoodOrders/${oid}/cancel`, {
        token: tokens[CUSTOMER_B],
        body: {},
      });
      expectStatus('W5-I02 cross-customer cancel', cancelCross.status, [403, 404], '');

      await api('POST', `/api/FoodOrders/${oid}/cancel`, { token: tokens[CUSTOMER], body: {} });
    }
  }

  // ---- V: Vendor menu / toggle junk ----
  {
    const menu = await api('GET', '/api/vendor/menu', { token: tokens[OWNER] });
    expectStatus('W5-V01 vendor menu', menu.status, [200], '');

    const dash = await api('GET', '/api/vendor/dashboard', { token: tokens[OWNER] });
    expectStatus('W5-V02 vendor dashboard', dash.status, [200], '');

    const tog = await api('POST', '/api/vendor/toggle-status', {
      token: tokens[OWNER],
      body: {},
    });
    expectStatus('W5-V03 toggle empty body', tog.status, [400, 422], '');

    // Always restore OPEN so later place/stress cases are not poisoned
    const reopen = await api('POST', '/api/vendor/toggle-status', {
      token: tokens[OWNER],
      body: { isOpen: true },
    });
    expectStatus('W5-V03b force open', reopen.status, 200, '');

    const item = await api('POST', '/api/vendor/food-items', {
      token: tokens[OWNER],
      body: { name: '', price: -5, categoryId: 0 },
    });
    expectStatus('W5-V04 bad food item', item.status, [400, 422], '');
  }

  // ---- Q: Concurrent place storm small ----
  {
    const users = DUMMIES.slice(0, 6);
    const storm = await mapPool(users, 6, async (m) => {
      const r = await api('POST', '/api/FoodOrders', {
        token: tokens[m],
        body: {
          restaurantId: Number(foodR2.restaurantId),
          addressId: addrs[m],
          paymentMethod: 'COD',
          notes: `W5-storm-${SEED}-${m}`,
          items: [{ foodItemId: foodR2.id, quantity: 1 }],
        },
      });
      if (r.status === 200 && r.json?.data?.id) tracked.push({ id: r.json.data.id, token: tokens[m] });
      return r.status;
    });
    const okN = storm.filter((s) => s === 200).length;
    if (okN >= 4) pass('W5-Q01 place storm', `ok=${okN}/${storm.length}`);
    else fail('W5-Q01 place storm', storm.join(','));
  }

  await mapPool(tracked, 8, async (o) => {
    try { await api('POST', `/api/FoodOrders/${o.id}/cancel`, { token: o.token, body: {} }); } catch { /* ignore */ }
  });

  const failed = results.filter((r) => !r.ok);
  const ok = results.filter((r) => r.ok);
  console.log(`\n=== CHAOS-W5 DONE seed=${SEED} PASS=${ok.length} FAIL=${failed.length} ms=${Date.now() - t0} ===`);
  if (failed.length) {
    for (const f of failed) console.log(`  FAIL ${f.name}: ${f.detail}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(2);
});
