// ==============================================================================
// SuperApp Full Multi-User Real End-to-End Test Suite
// Executes mandatory multi-user matrix across 9 distinct roles/accounts:
// 1. Customer A (9900000001)
// 2. Customer B (9900000002)
// 3. Restaurant Owner A (9900000003) -> Restaurant 1 (Meghana Foods)
// 4. Restaurant Owner B (9900000004) -> Restaurant 2 (Haldiram's)
// 5. Driver / Captain A (9900000005)
// 6. Driver / Captain B (9900000006)
// 7. Marketplace Seller A (9900000007)
// 8. Marketplace Seller B (9900000008)
// 9. Admin (9999999999, Admin@123)
// ==============================================================================

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';
const TEST_OTP = '123456';

const results = [];
let passCount = 0;
let failCount = 0;
let blockedCount = 0;

function recordTest(suite, scenario, expected, actual, status, details = '') {
  const isPass = status === 'PASS';
  if (isPass) passCount++;
  else if (status === 'FAIL') failCount++;
  else blockedCount++;

  results.push({ suite, scenario, expected, actual, status, details });
  const icon = isPass ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  console.log(`${icon} [${suite}] ${scenario}: ${status} (Got: ${actual})`);
  if (!isPass && details) {
    console.log(`   🚨 Issue: ${details}`);
  }
}

async function api(endpoint, method = 'GET', body = null, token = null) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  try {
    const res = await fetch(url, options);
    let data = null;
    const text = await res.text();
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    return { status: res.status, ok: res.ok, data };
  } catch (err) {
    return { status: 0, ok: false, error: err.message };
  }
}

async function loginUser(mobileNumber, fullName, isAdmin = false, adminPassword = 'Admin@123') {
  // 1. Send OTP
  const sendRes = await api('/api/auth/send-otp', 'POST', { mobileNumber });
  if (!sendRes.ok) {
    throw new Error(`send-otp failed for ${mobileNumber}: ${JSON.stringify(sendRes.data)}`);
  }

  // 2. Verify OTP / Admin Login
  if (isAdmin) {
    const adminRes = await api('/api/auth/admin-login', 'POST', {
      mobileNumber,
      password: adminPassword,
      otpCode: TEST_OTP,
    });
    if (!adminRes.ok) throw new Error(`admin-login failed: ${JSON.stringify(adminRes.data)}`);
    return {
      token: adminRes.data.token,
      user: adminRes.data.user,
    };
  } else {
    const verifyRes = await api('/api/auth/verify-otp', 'POST', {
      mobileNumber,
      otpCode: TEST_OTP,
      fullName,
    });
    if (!verifyRes.ok) throw new Error(`verify-otp failed for ${mobileNumber}: ${JSON.stringify(verifyRes.data)}`);
    return {
      token: verifyRes.data.token,
      user: verifyRes.data.user,
    };
  }
}

async function main() {
  console.log('========================================================================');
  console.log('🚀 SUPERAPP MANDATORY MULTI-USER REAL END-TO-END VERIFICATION');
  console.log(`Target: ${BASE_URL} | Test OTP Mode: ${TEST_OTP}`);
  console.log('========================================================================\n');

  // --------------------------------------------------------------------------
  // STEP 1: INITIALIZE & AUTHENTICATE ALL 9 DISTINCT TEST ACCOUNTS
  // --------------------------------------------------------------------------
  console.log('--- STEP 1: PROVISIONING & AUTHENTICATING 9 DISTINCT ACCOUNTS ---');
  
  const accounts = {
    customerA: { mobile: '9900000001', name: 'Customer A (Test)', token: null, user: null },
    customerB: { mobile: '9900000002', name: 'Customer B (Test)', token: null, user: null },
    ownerA:    { mobile: '9900000003', name: 'Owner A (Meghana)', token: null, user: null },
    ownerB:    { mobile: '9900000004', name: 'Owner B (Haldiram)', token: null, user: null },
    driverA:   { mobile: '9900000005', name: 'Captain A (Test)', token: null, user: null },
    driverB:   { mobile: '9900000006', name: 'Captain B (Test)', token: null, user: null },
    sellerA:   { mobile: '9900000007', name: 'Seller A (Test)', token: null, user: null },
    sellerB:   { mobile: '9900000008', name: 'Seller B (Test)', token: null, user: null },
    admin:     { mobile: '9999999999', name: 'Super Admin', token: null, user: null },
  };

  // Login Admin first
  try {
    const adminAuth = await loginUser(accounts.admin.mobile, accounts.admin.name, true);
    accounts.admin.token = adminAuth.token;
    accounts.admin.user = adminAuth.user;
    recordTest('AUTH', 'Admin Login with Password + Deterministic OTP', '200 OK + JWT', '200 OK', 'PASS');
  } catch (err) {
    recordTest('AUTH', 'Admin Login', '200 OK + JWT', err.message, 'FAIL');
    return;
  }

  // Register / Login all non-admin accounts
  for (const [key, acc] of Object.entries(accounts)) {
    if (key === 'admin') continue;
    try {
      const auth = await loginUser(acc.mobile, acc.name, false);
      acc.token = auth.token;
      acc.user = auth.user;
      recordTest('AUTH', `Authenticate ${acc.name} (${acc.mobile})`, '200 OK + JWT', '200 OK', 'PASS');
    } catch (err) {
      recordTest('AUTH', `Authenticate ${acc.name}`, '200 OK + JWT', err.message, 'FAIL');
    }
  }

  // Assign roles via Admin token
  console.log('\n--- STEP 2: ASSIGNING ROLES & ENTITY MAPPINGS VIA ADMIN ---');
  
  // Assign Owner A -> RESTAURANT_OWNER for Restaurant 1
  const ownerARoleRes = await api('/api/admin/users', 'POST', {
    action: 'ROLE',
    userId: accounts.ownerA.user.id,
    roleName: 'RESTAURANT_OWNER',
    restaurantId: 1,
  }, accounts.admin.token);
  recordTest('ROLE_PROVISION', 'Assign Owner A to Restaurant #1', '200 OK', `${ownerARoleRes.status}`, ownerARoleRes.ok ? 'PASS' : 'FAIL');

  // Assign Owner B -> RESTAURANT_OWNER for Restaurant 2
  const ownerBRoleRes = await api('/api/admin/users', 'POST', {
    action: 'ROLE',
    userId: accounts.ownerB.user.id,
    roleName: 'RESTAURANT_OWNER',
    restaurantId: 2,
  }, accounts.admin.token);
  recordTest('ROLE_PROVISION', 'Assign Owner B to Restaurant #2', '200 OK', `${ownerBRoleRes.status}`, ownerBRoleRes.ok ? 'PASS' : 'FAIL');

  // Assign Driver A -> DRIVER
  const driverARoleRes = await api('/api/admin/users', 'POST', {
    action: 'ROLE',
    userId: accounts.driverA.user.id,
    roleName: 'DRIVER',
  }, accounts.admin.token);
  recordTest('ROLE_PROVISION', 'Assign Driver A DRIVER role (provisions vehicle)', '200 OK', `${driverARoleRes.status}`, driverARoleRes.ok ? 'PASS' : 'FAIL');

  // Assign Driver B -> DRIVER
  const driverBRoleRes = await api('/api/admin/users', 'POST', {
    action: 'ROLE',
    userId: accounts.driverB.user.id,
    roleName: 'DRIVER',
  }, accounts.admin.token);
  recordTest('ROLE_PROVISION', 'Assign Driver B DRIVER role (provisions vehicle)', '200 OK', `${driverBRoleRes.status}`, driverBRoleRes.ok ? 'PASS' : 'FAIL');

  // Assign Seller A -> MARKETPLACE_SELLER
  const sellerARoleRes = await api('/api/admin/users', 'POST', {
    action: 'ROLE',
    userId: accounts.sellerA.user.id,
    roleName: 'MARKETPLACE_SELLER',
  }, accounts.admin.token);
  recordTest('ROLE_PROVISION', 'Assign Seller A MARKETPLACE_SELLER role', '200 OK', `${sellerARoleRes.status}`, sellerARoleRes.ok ? 'PASS' : 'FAIL');

  // Assign Seller B -> MARKETPLACE_SELLER
  const sellerBRoleRes = await api('/api/admin/users', 'POST', {
    action: 'ROLE',
    userId: accounts.sellerB.user.id,
    roleName: 'MARKETPLACE_SELLER',
  }, accounts.admin.token);
  recordTest('ROLE_PROVISION', 'Assign Seller B MARKETPLACE_SELLER role', '200 OK', `${sellerBRoleRes.status}`, sellerBRoleRes.ok ? 'PASS' : 'FAIL');

  // Re-login provisioned users to refresh JWT claims with newly assigned roles
  for (const key of ['ownerA', 'ownerB', 'driverA', 'driverB', 'sellerA', 'sellerB']) {
    const acc = accounts[key];
    const reAuth = await loginUser(acc.mobile, acc.name, false);
    acc.token = reAuth.token;
    acc.user = reAuth.user;
  }

  // --------------------------------------------------------------------------
  // STEP 3: MATRIX A — CUSTOMER ISOLATION (FOOD ORDERS)
  // --------------------------------------------------------------------------
  console.log('\n--- MATRIX A: CUSTOMER FOOD ORDER DATA ISOLATION ---');
  let orderAId = null;
  let orderBId = null;

  // Customer A places Food Order #A (COD) at Restaurant 1
  const orderABody = {
    restaurantId: 1,
    deliveryAddress: 'Flat 402, Green Glen Layout, Bellandur, Bangalore',
    deliveryLatitude: 12.9279,
    deliveryLongitude: 77.6271,
    paymentMethod: 'COD',
    items: [{ foodItemId: 1, quantity: 2, itemPrice: 150 }],
  };
  const createOrderARes = await api('/api/foodorders', 'POST', orderABody, accounts.customerA.token);
  if (createOrderARes.ok && createOrderARes.data?.data?.id) {
    orderAId = createOrderARes.data.data.id;
    recordTest('CUSTOMER_A', 'Place Food Order #A (COD)', '201 Created', '201 Created', 'PASS', `Order ID: ${orderAId}`);
  } else {
    recordTest('CUSTOMER_A', 'Place Food Order #A (COD)', '201 Created', `${createOrderARes.status}`, 'FAIL', JSON.stringify(createOrderARes.data));
  }

  // Customer A verifies Order #A appears in my-orders
  const myOrdersARes = await api('/api/foodorders/my-orders', 'GET', null, accounts.customerA.token);
  const myOrdersA = myOrdersARes.data?.data?.items || myOrdersARes.data?.data || [];
  const foundOrderAInA = myOrdersA.some((o) => o.id === orderAId);
  recordTest('CUSTOMER_A', 'Order #A appears in Customer A my-orders list', 'true', `${foundOrderAInA}`, foundOrderAInA ? 'PASS' : 'FAIL');

  // Customer B checks my-orders: Order #A must NOT appear
  const myOrdersBRes = await api('/api/foodorders/my-orders', 'GET', null, accounts.customerB.token);
  const myOrdersB = myOrdersBRes.data?.data?.items || myOrdersBRes.data?.data || [];
  const foundOrderAInB = myOrdersB.some((o) => o.id === orderAId);
  recordTest('CUSTOMER_B', 'Customer B cannot see Customer A Order #A in my-orders', 'false', `${foundOrderAInB}`, !foundOrderAInB ? 'PASS' : 'FAIL');

  // Customer B attempts direct API access to Customer A's Order #A -> MUST 403 Forbidden
  if (orderAId) {
    const directAccessRes = await api(`/api/foodorders/${orderAId}`, 'GET', null, accounts.customerB.token);
    recordTest('CUSTOMER_B_LEAK_CHECK', `Customer B direct GET /api/foodorders/${orderAId}`, '403 Forbidden', `${directAccessRes.status}`, directAccessRes.status === 403 ? 'PASS' : 'FAIL');
  }

  // Customer B places Food Order #B (ONLINE) at Restaurant 2 (Haldiram's)
  const orderBBody = {
    restaurantId: 2,
    deliveryAddress: '12 Barakhamba Road, Connaught Place, New Delhi',
    deliveryLatitude: 28.6304,
    deliveryLongitude: 77.2177,
    paymentMethod: 'ONLINE',
    items: [{ foodItemId: 8, quantity: 1, itemPrice: 249 }],
  };
  const createOrderBRes = await api('/api/foodorders', 'POST', orderBBody, accounts.customerB.token);
  if (createOrderBRes.ok && createOrderBRes.data?.data?.id) {
    orderBId = createOrderBRes.data.data.id;
    recordTest('CUSTOMER_B', 'Place Food Order #B (ONLINE)', '201 Created', '201 Created', 'PASS', `Order ID: ${orderBId}`);
  } else {
    recordTest('CUSTOMER_B', 'Place Food Order #B (ONLINE)', '201 Created', `${createOrderBRes.status}`, 'FAIL', JSON.stringify(createOrderBRes.data));
  }

  // Customer B checks my-orders: Only Order #B should appear (not #A)
  const myOrdersBAfter = await api('/api/foodorders/my-orders', 'GET', null, accounts.customerB.token);
  const ordersBItems = myOrdersBAfter.data?.data?.items || myOrdersBAfter.data?.data || [];
  const bHasB = ordersBItems.some((o) => o.id === orderBId);
  const bHasA = ordersBItems.some((o) => o.id === orderAId);
  recordTest('CUSTOMER_B', 'Customer B my-orders contains #B and NOT #A', 'bHasB=true && bHasA=false', `bHasB=${bHasB}, bHasA=${bHasA}`, bHasB && !bHasA ? 'PASS' : 'FAIL');

  // Customer A logs back in / verifies data: Only #A appears (not #B)
  const myOrdersAAfter = await api('/api/foodorders/my-orders', 'GET', null, accounts.customerA.token);
  const ordersAItems = myOrdersAAfter.data?.data?.items || myOrdersAAfter.data?.data || [];
  const aHasA = ordersAItems.some((o) => o.id === orderAId);
  const aHasB = ordersAItems.some((o) => o.id === orderBId);
  recordTest('CUSTOMER_A', 'Customer A my-orders contains #A and NOT #B', 'aHasA=true && aHasB=false', `aHasA=${aHasA}, aHasB=${aHasB}`, aHasA && !aHasB ? 'PASS' : 'FAIL');

  // Customer A attempts direct API access to Customer B's Order #B -> MUST 403 Forbidden
  if (orderBId) {
    const directAccessBRes = await api(`/api/foodorders/${orderBId}`, 'GET', null, accounts.customerA.token);
    recordTest('CUSTOMER_A_LEAK_CHECK', `Customer A direct GET /api/foodorders/${orderBId}`, '403 Forbidden', `${directAccessBRes.status}`, directAccessBRes.status === 403 ? 'PASS' : 'FAIL');
  }

  // --------------------------------------------------------------------------
  // STEP 4: MATRIX B — RESTAURANT OWNER ISOLATION & VENDOR ORDER MANAGEMENT
  // --------------------------------------------------------------------------
  console.log('\n--- MATRIX B: RESTAURANT OWNER ISOLATION ---');

  // Unauthenticated access to vendor orders -> MUST 401 Unauthorized
  const unauthVendorRes = await api('/api/vendor/orders', 'GET', null, null);
  recordTest('VENDOR_AUTH', 'Unauthenticated GET /api/vendor/orders', '401 Unauthorized', `${unauthVendorRes.status}`, unauthVendorRes.status === 401 ? 'PASS' : 'FAIL');

  // Owner A calls /api/vendor/orders: MUST see Order #A (Rest 1), MUST NOT see Order #B (Rest 2)
  const vendorOrdersARes = await api('/api/vendor/orders', 'GET', null, accounts.ownerA.token);
  const vendorOrdersA = vendorOrdersARes.data?.data || [];
  const ownerAHasOrderA = vendorOrdersA.some((o) => o.id === orderAId);
  const ownerAHasOrderB = vendorOrdersA.some((o) => o.id === orderBId);
  recordTest('VENDOR_OWNER_A', 'Owner A sees Order #A and NOT Order #B', 'ownerAHasA=true && ownerAHasB=false', `hasA=${ownerAHasOrderA}, hasB=${ownerAHasOrderB}`, ownerAHasOrderA && !ownerAHasOrderB ? 'PASS' : 'FAIL');

  // Owner A attempts direct status update on Order #B (Rest 2) -> MUST 403 Forbidden
  if (orderBId) {
    const crossUpdateRes = await api(`/api/vendor/orders/${orderBId}/status`, 'PUT', { status: 'PREPARING' }, accounts.ownerA.token);
    recordTest('VENDOR_CROSS_TAMPER', 'Owner A cannot update Owner B Order #B', '403 Forbidden', `${crossUpdateRes.status}`, crossUpdateRes.status === 403 ? 'PASS' : 'FAIL');
  }

  // Owner B calls /api/vendor/orders: MUST see Order #B (Rest 2), MUST NOT see Order #A (Rest 1)
  const vendorOrdersBRes = await api('/api/vendor/orders', 'GET', null, accounts.ownerB.token);
  const vendorOrdersB = vendorOrdersBRes.data?.data || [];
  const ownerBHasOrderB = vendorOrdersB.some((o) => o.id === orderBId);
  const ownerBHasOrderA = vendorOrdersB.some((o) => o.id === orderAId);
  recordTest('VENDOR_OWNER_B', 'Owner B sees Order #B and NOT Order #A', 'ownerBHasB=true && ownerBHasA=false', `hasB=${ownerBHasOrderB}, hasA=${ownerBHasOrderA}`, ownerBHasOrderB && !ownerBHasOrderA ? 'PASS' : 'FAIL');

  // Owner B attempts direct status update on Order #A (Rest 1) -> MUST 403 Forbidden
  if (orderAId) {
    const crossUpdateBRes = await api(`/api/vendor/orders/${orderAId}/status`, 'PUT', { status: 'ACCEPTED' }, accounts.ownerB.token);
    recordTest('VENDOR_CROSS_TAMPER', 'Owner B cannot update Owner A Order #A', '403 Forbidden', `${crossUpdateBRes.status}`, crossUpdateBRes.status === 403 ? 'PASS' : 'FAIL');
  }

  // Owner A updates Order #A through complete status lifecycle to DELIVERED
  if (orderAId) {
    await api(`/api/vendor/orders/${orderAId}/status`, 'PUT', { status: 'ACCEPTED' }, accounts.ownerA.token);
    await api(`/api/vendor/orders/${orderAId}/status`, 'PUT', { status: 'PREPARING' }, accounts.ownerA.token);
    await api(`/api/vendor/orders/${orderAId}/status`, 'PUT', { status: 'READY' }, accounts.ownerA.token);
    const deliveredRes = await api(`/api/vendor/orders/${orderAId}/status`, 'PUT', { status: 'DELIVERED' }, accounts.ownerA.token);
    recordTest('VENDOR_LIFECYCLE', 'Owner A transitions Order #A to DELIVERED', '200 OK', `${deliveredRes.status}`, deliveredRes.ok ? 'PASS' : 'FAIL');

    // COD Payment Status Transition Check: Upon delivery, payment status MUST transition to PAID
    const orderDetailsRes = await api(`/api/foodorders/${orderAId}`, 'GET', null, accounts.customerA.token);
    const paymentStatus = orderDetailsRes.data?.data?.paymentStatus;
    recordTest('COD_PAYMENT_TRANSITION', 'COD order paymentStatus transitions to PAID on delivery', 'PAID', `${paymentStatus}`, paymentStatus === 'PAID' ? 'PASS' : 'FAIL');
  }

  // --------------------------------------------------------------------------
  // STEP 5: MATRIX C — DRIVER / CAPTAIN ISOLATION & RIDE LIFECYCLE
  // --------------------------------------------------------------------------
  console.log('\n--- MATRIX C: DRIVER / CAPTAIN ISOLATION ---');
  let rideId = null;
  let rideOtp = null;

  // Driver A sets status online
  const driverAOnlineRes = await api('/api/driver/toggle-online', 'POST', { isOnline: true }, accounts.driverA.token);
  recordTest('DRIVER_A', 'Driver A toggles online status', '200 OK', `${driverAOnlineRes.status}`, driverAOnlineRes.ok ? 'PASS' : 'FAIL');

  // Customer A requests a ride
  const bookRideBody = {
    pickupAddress: 'Connaught Place Inner Circle, New Delhi',
    pickupLatitude: 28.6304,
    pickupLongitude: 77.2177,
    dropoffAddress: 'India Gate, Rajpath, New Delhi',
    dropoffLatitude: 28.6129,
    dropoffLongitude: 77.2295,
    vehicleType: 'BIKE',
    paymentMethod: 'CASH',
  };
  const bookRideRes = await api('/api/rides/book', 'POST', bookRideBody, accounts.customerA.token);
  if (bookRideRes.ok && bookRideRes.data?.data?.id) {
    rideId = bookRideRes.data.data.id;
    rideOtp = bookRideRes.data.data.otpCode;
    recordTest('RIDE_BOOK', 'Customer A books ride', '201 Created', '201 Created', 'PASS', `Ride ID: ${rideId}`);
  } else {
    recordTest('RIDE_BOOK', 'Customer A books ride', '201 Created', `${bookRideRes.status}`, 'FAIL', JSON.stringify(bookRideRes.data));
  }

  // Driver A checks available rides and accepts
  if (rideId) {
    const availRidesRes = await api('/api/driver/available-rides', 'GET', null, accounts.driverA.token);
    const availRides = availRidesRes.data?.data || [];
    const canSeeRide = availRides.some((r) => r.id === rideId);
    recordTest('DRIVER_A', 'Driver A sees requested ride in available-rides', 'true', `${canSeeRide}`, canSeeRide ? 'PASS' : 'FAIL');

    // Driver A accepts the ride
    const acceptRes = await api(`/api/driver/rides/${rideId}/accept`, 'POST', null, accounts.driverA.token);
    recordTest('DRIVER_A', 'Driver A accepts the ride', '200 OK', `${acceptRes.status}`, acceptRes.ok ? 'PASS' : 'FAIL');

    // Driver B attempts to start Driver A's accepted ride -> MUST 403 Forbidden
    const driverBTamperRes = await api(`/api/driver/rides/${rideId}/start`, 'POST', { otpCode: rideOtp }, accounts.driverB.token);
    recordTest('DRIVER_ISOLATION', 'Driver B cannot start Driver A ride', '403 Forbidden', `${driverBTamperRes.status}`, driverBTamperRes.status === 403 ? 'PASS' : 'FAIL');

    // Driver B checks active-ride -> MUST be null / empty (Driver A's ride not visible)
    const driverBCurrentRes = await api('/api/driver/active-ride', 'GET', null, accounts.driverB.token);
    const driverBCurrent = driverBCurrentRes.data?.data;
    recordTest('DRIVER_ISOLATION', 'Driver B active-ride does not expose Driver A ride', 'null', `${driverBCurrent ? driverBCurrent.id : 'null'}`, !driverBCurrent ? 'PASS' : 'FAIL');

    // Driver A completes ride lifecycle: ARRIVING -> START -> COMPLETE
    await api(`/api/driver/rides/${rideId}/arriving`, 'POST', null, accounts.driverA.token);
    const startRideRes = await api(`/api/driver/rides/${rideId}/start`, 'POST', { otpCode: rideOtp }, accounts.driverA.token);
    recordTest('DRIVER_A', 'Driver A starts ride with OTP', '200 OK', `${startRideRes.status}`, startRideRes.ok ? 'PASS' : 'FAIL');

    const completeRideRes = await api(`/api/driver/rides/${rideId}/complete`, 'POST', null, accounts.driverA.token);
    recordTest('DRIVER_A', 'Driver A completes ride', '200 OK', `${completeRideRes.status}`, completeRideRes.ok ? 'PASS' : 'FAIL');

    // Driver A ride history contains completed ride
    const driverAHistRes = await api('/api/driver/rides/history', 'GET', null, accounts.driverA.token);
    const driverAHistory = driverAHistRes.data?.data?.items || driverAHistRes.data?.data || [];
    const foundInAHistory = driverAHistory.some((r) => r.id === rideId);
    recordTest('DRIVER_A_HISTORY', 'Ride appears in Driver A completed ride history', 'true', `${foundInAHistory}`, foundInAHistory ? 'PASS' : 'FAIL');

    // Driver B ride history MUST NOT contain Driver A's ride
    const driverBHistRes = await api('/api/driver/rides/history', 'GET', null, accounts.driverB.token);
    const driverBHistory = driverBHistRes.data?.data?.items || driverBHistRes.data?.data || [];
    const foundInBHistory = driverBHistory.some((r) => r.id === rideId);
    recordTest('DRIVER_B_HISTORY', 'Driver A ride does NOT appear in Driver B history', 'false', `${foundInBHistory}`, !foundInBHistory ? 'PASS' : 'FAIL');
  }

  // --------------------------------------------------------------------------
  // STEP 6: MATRIX D — MARKETPLACE SELLER ISOLATION & MAKE AN OFFER
  // --------------------------------------------------------------------------
  console.log('\n--- MATRIX D: MARKETPLACE SELLER ISOLATION & MAKE AN OFFER ---');
  let listingAId = null;
  let listingBId = null;
  let offerId = null;

  // Seller A creates Listing A
  const listingABody = {
    categoryId: 1, // Mobiles
    title: 'OnePlus 12 5G (Emerald Green 256GB)',
    description: 'Mint condition, 4 months old with original charger and warranty bill.',
    price: 48000,
    condition: 'LIKE_NEW',
    location: 'Koramangala, Bangalore',
  };
  const createListingARes = await api('/api/marketplace/listings', 'POST', listingABody, accounts.sellerA.token);
  if (createListingARes.ok && createListingARes.data?.data?.id) {
    listingAId = createListingARes.data.data.id;
    recordTest('SELLER_A', 'Seller A creates Listing A', '201 Created', '201 Created', 'PASS', `Listing ID: ${listingAId}`);
  } else {
    recordTest('SELLER_A', 'Seller A creates Listing A', '201 Created', `${createListingARes.status}`, 'FAIL', JSON.stringify(createListingARes.data));
  }

  // Seller B creates Listing B
  const listingBBody = {
    categoryId: 3, // Electronics
    title: 'Sony WH-1000XM5 Wireless Headphones',
    description: 'Black, active noise cancellation, box and travel case included.',
    price: 22000,
    condition: 'LIKE_NEW',
    location: 'Connaught Place, New Delhi',
  };
  const createListingBRes = await api('/api/marketplace/listings', 'POST', listingBBody, accounts.sellerB.token);
  if (createListingBRes.ok && createListingBRes.data?.data?.id) {
    listingBId = createListingBRes.data.data.id;
    recordTest('SELLER_B', 'Seller B creates Listing B', '201 Created', '201 Created', 'PASS', `Listing ID: ${listingBId}`);
  } else {
    recordTest('SELLER_B', 'Seller B creates Listing B', '201 Created', `${createListingBRes.status}`, 'FAIL', JSON.stringify(createListingBRes.data));
  }

  // Seller A checks my-listings: MUST see Listing A, MUST NOT see Listing B
  const sellerAListingsRes = await api('/api/marketplace/my-listings', 'GET', null, accounts.sellerA.token);
  const sellerAListings = sellerAListingsRes.data?.data?.items || sellerAListingsRes.data?.data || [];
  const sAHasA = sellerAListings.some((l) => l.id === listingAId);
  const sAHasB = sellerAListings.some((l) => l.id === listingBId);
  recordTest('SELLER_A_ISOLATION', 'Seller A my-listings has Listing A and NOT Listing B', 'sAHasA=true && sAHasB=false', `hasA=${sAHasA}, hasB=${sAHasB}`, sAHasA && !sAHasB ? 'PASS' : 'FAIL');

  // Seller B checks my-listings: MUST see Listing B, MUST NOT see Listing A
  const sellerBListingsRes = await api('/api/marketplace/my-listings', 'GET', null, accounts.sellerB.token);
  const sellerBListings = sellerBListingsRes.data?.data?.items || sellerBListingsRes.data?.data || [];
  const sBHasB = sellerBListings.some((l) => l.id === listingBId);
  const sBHasA = sellerBListings.some((l) => l.id === listingAId);
  recordTest('SELLER_B_ISOLATION', 'Seller B my-listings has Listing B and NOT Listing A', 'sBHasB=true && sBHasA=false', `hasB=${sBHasB}, hasA=${sBHasA}`, sBHasB && !sBHasA ? 'PASS' : 'FAIL');

  // MAKE AN OFFER: Customer A makes an offer on Seller B's Listing B
  if (listingBId) {
    const offerBody = {
      offeredPrice: 19500,
      message: 'Can pick up tomorrow afternoon from Connaught Place.',
    };
    const makeOfferRes = await api(`/api/marketplace/listings/${listingBId}/offer`, 'POST', offerBody, accounts.customerA.token);
    if (makeOfferRes.ok && makeOfferRes.data?.data?.id) {
      offerId = makeOfferRes.data.data.id;
      recordTest('MAKE_OFFER', 'Customer A makes an offer on Seller B Listing B', '201 Created', '201 Created', 'PASS', `Offer ID: ${offerId}`);
    } else {
      recordTest('MAKE_OFFER', 'Customer A makes an offer on Seller B Listing B', '201 Created', `${makeOfferRes.status}`, 'FAIL', JSON.stringify(makeOfferRes.data));
    }

    // Customer A checks my-offers
    const myOffersRes = await api('/api/marketplace/my-offers', 'GET', null, accounts.customerA.token);
    const myOffers = myOffersRes.data?.data || [];
    const foundMyOffer = myOffers.some((o) => o.id === offerId);
    recordTest('BUYER_OFFERS', 'Customer A sees made offer in my-offers', 'true', `${foundMyOffer}`, foundMyOffer ? 'PASS' : 'FAIL');

    // Seller B views offers on Listing B
    const sellerBOffersRes = await api(`/api/marketplace/listings/${listingBId}/offers`, 'GET', null, accounts.sellerB.token);
    const sellerBOffers = sellerBOffersRes.data?.data || [];
    const sellerBFoundOffer = sellerBOffers.some((o) => o.id === offerId);
    recordTest('SELLER_B_OFFERS', 'Seller B sees Customer A offer on Listing B', 'true', `${sellerBFoundOffer}`, sellerBFoundOffer ? 'PASS' : 'FAIL');

    // Seller A attempts to view offers on Listing B -> MUST 403 Forbidden
    const sellerAOffersRes = await api(`/api/marketplace/listings/${listingBId}/offers`, 'GET', null, accounts.sellerA.token);
    recordTest('OFFER_ISOLATION', 'Seller A cannot view offers on Seller B Listing B', '403 Forbidden', `${sellerAOffersRes.status}`, sellerAOffersRes.status === 403 ? 'PASS' : 'FAIL');

    // Seller B accepts the offer
    if (offerId) {
      const acceptOfferRes = await api(`/api/marketplace/offers/${offerId}/status`, 'PUT', { status: 'ACCEPTED' }, accounts.sellerB.token);
      recordTest('SELLER_B_ACCEPT_OFFER', 'Seller B accepts Customer A offer', '200 OK', `${acceptOfferRes.status}`, acceptOfferRes.ok ? 'PASS' : 'FAIL');

      // Customer A checks my-offers and sees status updated to ACCEPTED
      const myOffersAfterRes = await api('/api/marketplace/my-offers', 'GET', null, accounts.customerA.token);
      const myOffersAfter = myOffersAfterRes.data?.data || [];
      const updatedOffer = myOffersAfter.find((o) => o.id === offerId);
      recordTest('OFFER_STATUS_SYNC', 'Customer A sees offer status updated to ACCEPTED', 'ACCEPTED', `${updatedOffer?.status}`, updatedOffer?.status === 'ACCEPTED' ? 'PASS' : 'FAIL');
    }
  }

  // --------------------------------------------------------------------------
  // STEP 7: MATRIX E — ADMIN ISOLATION & GLOBAL OVERSIGHT
  // --------------------------------------------------------------------------
  console.log('\n--- MATRIX E: ADMIN AUTHORIZATION & GLOBAL OVERSIGHT ---');

  // Admin accesses global dashboard
  const adminDashRes = await api('/api/admin/dashboard', 'GET', null, accounts.admin.token);
  const dashData = adminDashRes.data?.data;
  const adminDashOk = adminDashRes.ok && dashData && typeof dashData.totalUsers === 'number' && typeof dashData.totalFoodOrders === 'number';
  recordTest('ADMIN_DASHBOARD', 'Admin accesses global dashboard metrics', '200 OK with real counts', `${adminDashRes.status} (Users: ${dashData?.totalUsers}, Orders: ${dashData?.totalFoodOrders}, Rides: ${dashData?.totalRides})`, adminDashOk ? 'PASS' : 'FAIL');

  // Admin queries all users
  const adminUsersRes = await api('/api/admin/users', 'GET', null, accounts.admin.token);
  const usersCount = adminUsersRes.data?.data?.totalCount ?? adminUsersRes.data?.data?.items?.length ?? 0;
  recordTest('ADMIN_USERS', 'Admin retrieves global user accounts', '200 OK', `${adminUsersRes.status} (Count: ${usersCount})`, adminUsersRes.ok ? 'PASS' : 'FAIL');

  // Non-admin (Customer A) attempts to access /api/admin/dashboard -> MUST 403 Forbidden
  const customerAdminDashRes = await api('/api/admin/dashboard', 'GET', null, accounts.customerA.token);
  recordTest('ADMIN_AUTH_GUARD', 'Customer A cannot access /api/admin/dashboard', '403 Forbidden', `${customerAdminDashRes.status}`, customerAdminDashRes.status === 403 ? 'PASS' : 'FAIL');

  // Non-admin (Customer B) attempts to access /api/admin/users -> MUST 403 Forbidden
  const customerAdminUsersRes = await api('/api/admin/users', 'GET', null, accounts.customerB.token);
  recordTest('ADMIN_AUTH_GUARD', 'Customer B cannot access /api/admin/users', '403 Forbidden', `${customerAdminUsersRes.status}`, customerAdminUsersRes.status === 403 ? 'PASS' : 'FAIL');

  // Unauthenticated user attempts admin endpoints -> MUST 401 Unauthorized
  const unauthAdminRes = await api('/api/admin/dashboard', 'GET', null, null);
  recordTest('ADMIN_UNAUTH_GUARD', 'Unauthenticated request to /api/admin/dashboard', '401 Unauthorized', `${unauthAdminRes.status}`, unauthAdminRes.status === 401 ? 'PASS' : 'FAIL');

  // --------------------------------------------------------------------------
  // STEP 8: ACTIVITY & NOTIFICATION TARGETING TRIANGULATION
  // --------------------------------------------------------------------------
  console.log('\n--- STEP 8: NOTIFICATION TARGETING & USER ACTIVITY TRIANGULATION ---');

  // Customer A notifications
  const notifARes = await api('/api/notifications', 'GET', null, accounts.customerA.token);
  const notifsA = notifARes.data?.data || [];
  recordTest('NOTIFICATIONS_A', 'Customer A receives targeted notifications', '200 OK', `${notifARes.status} (Count: ${notifsA.length})`, notifARes.ok ? 'PASS' : 'FAIL');

  // Seller B notifications (should contain offer notification)
  const notifBRes = await api('/api/notifications', 'GET', null, accounts.sellerB.token);
  const notifsB = notifBRes.data?.data || [];
  const sellerBHasOfferNotif = notifsB.some((n) => n.title?.toLowerCase().includes('offer') || n.body?.toLowerCase().includes('offer') || n.type === 'MARKETPLACE_OFFER');
  recordTest('NOTIFICATIONS_TARGETING', 'Seller B receives targeted notification for offer on Listing B', 'true', `${sellerBHasOfferNotif}`, sellerBHasOfferNotif ? 'PASS' : 'FAIL');

  // Seller A notifications (MUST NOT contain offer for Listing B)
  const notifSellerARes = await api('/api/notifications', 'GET', null, accounts.sellerA.token);
  const notifsSellerA = notifSellerARes.data?.data || [];
  const sellerAHasOfferNotif = notifsSellerA.some((n) => n.title?.includes('WH-1000XM5') || n.body?.includes('WH-1000XM5') || n.referenceId === `${offerId}`);
  recordTest('NOTIFICATIONS_ISOLATION', 'Seller A does NOT receive Seller B offer notification', 'false', `${sellerAHasOfferNotif}`, !sellerAHasOfferNotif ? 'PASS' : 'FAIL');

  // --------------------------------------------------------------------------
  // SUMMARY REPORT
  // --------------------------------------------------------------------------
  console.log('\n========================================================================');
  console.log('📊 MULTI-USER END-TO-END TEST EXECUTION COMPLETE');
  console.log(`Total Scenarios: ${results.length}`);
  console.log(`Passed:          ${passCount}`);
  console.log(`Failed:          ${failCount}`);
  console.log(`Blocked:         ${blockedCount}`);
  console.log('========================================================================');

  if (failCount > 0) {
    console.log('\nFailed Tests:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`❌ [${r.suite}] ${r.scenario}: Expected ${r.expected}, got ${r.actual}. Details: ${r.details}`);
    });
    process.exit(1);
  } else {
    console.log('\n🎉 ALL MULTI-USER SCENARIOS PASSED WITH STRICT ZERO DATA LEAKAGE!\n');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
