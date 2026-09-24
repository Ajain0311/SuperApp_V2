// SuperApp Full Real End-to-End UAT Test Runner
// Connects directly to ASP.NET Core 10 Web API on http://localhost:5000 and Supabase PostgreSQL

const BASE_URL = 'http://localhost:5000';

const results = [];

function recordResult(id, role, scenario, expected, actual, status, details = '') {
  results.push({ id, role, scenario, expected, actual, status, details });
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  console.log(`${icon} [${id}] [${role}] ${scenario}: ${status} (${actual})`);
  if (details && status !== 'PASS') {
    console.log(`   Details: ${details}`);
  }
}

async function apiRequest(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  try {
    const res = await fetch(url, {
      ...options,
      headers
    });
    let data;
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

async function runUat() {
  console.log('====================================================');
  console.log('STARTING SUPERAPP REAL END-TO-END UAT ON LIVE API');
  console.log(`Target: ${BASE_URL}`);
  console.log('====================================================\n');

  let customerToken = '';
  let adminToken = '';
  let customerUser = null;
  let adminUser = null;
  let createdOrderId = null;
  let createdRideId = null;
  let createdRideOtp = '';
  let createdListingId = null;
  let testRestaurantId = 1;

  // ----------------------------------------------------
  // SUITE 1: AUTHENTICATION & MULTI-ROLE
  // ----------------------------------------------------
  console.log('--- SUITE 1: AUTHENTICATION & MULTI-ROLE ---');

  // AUTH-01: Send OTP
  {
    const res = await apiRequest('/api/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ mobileNumber: '6375002348' })
    });
    if (res.status === 200 && res.data.success) {
      recordResult('AUTH-01', 'CUSTOMER', 'Send OTP for multi-role user', '200 OK with success: true', `HTTP ${res.status}`, 'PASS');
    } else {
      recordResult('AUTH-01', 'CUSTOMER', 'Send OTP for multi-role user', '200 OK with success: true', `HTTP ${res.status}`, 'FAIL', JSON.stringify(res.data));
    }
  }

  // AUTH-02: Verify OTP
  {
    const res = await apiRequest('/api/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ mobileNumber: '6375002348', otpCode: '123456' })
    });
    if (res.status === 200 && res.data.token) {
      customerToken = res.data.token;
      customerUser = res.data.user;
      const roles = customerUser.roles || [];
      const hasAllRoles = roles.includes('CUSTOMER') && roles.includes('DRIVER') && roles.includes('RESTAURANT_OWNER') && roles.includes('MARKETPLACE_SELLER');
      recordResult('AUTH-02', 'CUSTOMER', 'Verify OTP & multi-role provisioning', '200 OK with JWT token & 4 roles', `HTTP ${res.status}, Roles: [${roles.join(', ')}]`, hasAllRoles ? 'PASS' : 'FAIL');
    } else {
      recordResult('AUTH-02', 'CUSTOMER', 'Verify OTP & multi-role provisioning', '200 OK with token', `HTTP ${res.status}`, 'FAIL', JSON.stringify(res.data));
    }
  }

  // AUTH-03: Invalid OTP Rejection
  {
    const res = await apiRequest('/api/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ mobileNumber: '6375002348', otpCode: '000000' })
    });
    if (res.status === 400 && !res.data.success) {
      recordResult('AUTH-03', 'CUSTOMER', 'Invalid OTP rejected', '400 Bad Request', `HTTP ${res.status}`, 'PASS');
    } else {
      recordResult('AUTH-03', 'CUSTOMER', 'Invalid OTP rejected', '400 Bad Request', `HTTP ${res.status}`, 'FAIL', JSON.stringify(res.data));
    }
  }

  // AUTH-04: Admin Login
  {
    await apiRequest('/api/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ mobileNumber: '9999999999' })
    });
    const res = await apiRequest('/api/auth/admin-login', {
      method: 'POST',
      body: JSON.stringify({ mobileNumber: '9999999999', password: 'Admin@123', otpCode: '123456' })
    });
    if (res.status === 200 && res.data.token) {
      adminToken = res.data.token;
      adminUser = res.data.user;
      const roles = adminUser.roles || [];
      const isAdmin = roles.includes('ADMIN');
      recordResult('AUTH-04', 'ADMIN', 'Admin authentication (Password + OTP)', '200 OK with JWT token & ADMIN role', `HTTP ${res.status}, Roles: [${roles.join(', ')}]`, isAdmin ? 'PASS' : 'FAIL');
    } else {
      recordResult('AUTH-04', 'ADMIN', 'Admin authentication (Password + OTP)', '200 OK with token', `HTTP ${res.status}`, 'FAIL', JSON.stringify(res.data));
    }
  }

  // AUTH-05: Admin Invalid Password Rejection
  {
    const res = await apiRequest('/api/auth/admin-login', {
      method: 'POST',
      body: JSON.stringify({ mobileNumber: '9999999999', password: 'WrongPassword!', otpCode: '123456' })
    });
    if (res.status === 400 && !res.data.success) {
      recordResult('AUTH-05', 'ADMIN', 'Admin invalid password rejected', '400 Bad Request', `HTTP ${res.status}`, 'PASS');
    } else {
      recordResult('AUTH-05', 'ADMIN', 'Admin invalid password rejected', '400 Bad Request', `HTTP ${res.status}`, 'FAIL', JSON.stringify(res.data));
    }
  }

  // ----------------------------------------------------
  // SUITE 2: CUSTOMER FOOD FLOW
  // ----------------------------------------------------
  console.log('\n--- SUITE 2: CUSTOMER FOOD FLOW ---');

  // FOOD-01: List Restaurants
  {
    const res = await apiRequest('/api/restaurants');
    const items = res.data?.data?.items || res.data?.data;
    if (res.status === 200 && Array.isArray(items) && items.length > 0) {
      const meghana = items.find(r => r.name && r.name.includes('Meghana'));
      testRestaurantId = meghana ? meghana.id : items[0].id;
      recordResult('FOOD-01', 'CUSTOMER', 'Browse active restaurants from Supabase', '200 OK with non-empty list', `HTTP ${res.status}, count: ${items.length}, selected: ${testRestaurantId}`, 'PASS');
    } else {
      recordResult('FOOD-01', 'CUSTOMER', 'Browse active restaurants from Supabase', '200 OK with restaurants', `HTTP ${res.status}`, 'FAIL');
    }
  }

  // FOOD-02: Get Restaurant Detail & Menu
  let testItemId = 1;
  {
    const res = await apiRequest(`/api/restaurants/${testRestaurantId}`);
    if (res.status === 200 && res.data?.data) {
      const rest = res.data.data;
      const categories = rest.categories || [];
      const items = categories.flatMap(c => c.items || []);
      if (items.length > 0) testItemId = items[0].id;
      recordResult('FOOD-02', 'CUSTOMER', 'Fetch restaurant menu categories & food items', '200 OK with menu hierarchy', `HTTP ${res.status}, categories: ${categories.length}, items: ${items.length}`, 'PASS');
    } else {
      recordResult('FOOD-02', 'CUSTOMER', 'Fetch restaurant menu categories & food items', '200 OK', `HTTP ${res.status}`, 'FAIL');
    }
  }

  // FOOD-03: Place Food Order
  {
    const orderPayload = {
      restaurantId: testRestaurantId,
      items: [
        { foodItemId: testItemId, quantity: 2 }
      ],
      paymentMethod: 'CASH',
      notes: 'UAT Test Order - Fast delivery please'
    };
    const res = await apiRequest('/api/foodorders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify(orderPayload)
    });
    if (res.status === 200 && res.data?.data?.id) {
      createdOrderId = res.data.data.id;
      const orderNumber = res.data.data.orderNumber;
      const status = res.data.data.status;
      recordResult('FOOD-03', 'CUSTOMER', 'Place food delivery order', '200 OK, status PENDING', `HTTP ${res.status}, ID: ${createdOrderId}, No: ${orderNumber}, Status: ${status}`, status === 'PENDING' ? 'PASS' : 'FAIL');
    } else {
      recordResult('FOOD-03', 'CUSTOMER', 'Place food delivery order', '200 OK with order', `HTTP ${res.status}`, 'FAIL', JSON.stringify(res.data));
    }
  }

  // FOOD-04: Order Tracking
  {
    const res = await apiRequest(`/api/foodorders/${createdOrderId}`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    if (res.status === 200 && res.data?.data?.id == createdOrderId) {
      recordResult('FOOD-04', 'CUSTOMER', 'Customer tracks active order status', '200 OK with order tracking details', `HTTP ${res.status}, status: ${res.data.data.status}`, 'PASS');
    } else {
      recordResult('FOOD-04', 'CUSTOMER', 'Customer tracks active order status', '200 OK', `HTTP ${res.status}`, 'FAIL');
    }
  }

  // ----------------------------------------------------
  // SUITE 3: RESTAURANT OWNER KITCHEN FLOW & STATE MACHINE
  // ----------------------------------------------------
  console.log('\n--- SUITE 3: RESTAURANT OWNER (VENDOR) FLOW ---');

  let kitchenOrderId = null;
  // VENDOR-01: Get Own Restaurant
  {
    const res = await apiRequest('/api/vendor/my-restaurant', {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    if (res.status === 200 && res.data?.data) {
      const vendorRest = res.data.data;
      recordResult('VENDOR-01', 'RESTAURANT_OWNER', 'Fetch assigned restaurant profile', '200 OK, matches assigned restaurant', `HTTP ${res.status}, name: ${vendorRest.name} (ID: ${vendorRest.id})`, 'PASS');

      // Create an order specifically for this vendor's kitchen to test state machine transitions
      const menuRes = await apiRequest(`/api/restaurants/${vendorRest.id}`);
      const menuItems = menuRes.data?.data?.categories?.flatMap(c => c.items || []) || [];
      const itemToOrder = menuItems.length > 0 ? menuItems[0].id : testItemId;

      const orderRes = await apiRequest('/api/foodorders', {
        method: 'POST',
        headers: { Authorization: `Bearer ${customerToken}` },
        body: JSON.stringify({
          restaurantId: vendorRest.id,
          items: [{ foodItemId: itemToOrder, quantity: 1 }],
          paymentMethod: 'CASH',
          notes: 'UAT Kitchen Flow Test Order'
        })
      });
      console.log(`   ℹ️ [Vendor Kitchen Order]: HTTP ${orderRes.status}, OrderId: ${orderRes.data?.data?.id}, Error: ${orderRes.data?.message}`);
      kitchenOrderId = orderRes.data?.data?.id || createdOrderId;
    } else {
      recordResult('VENDOR-01', 'RESTAURANT_OWNER', 'Fetch assigned restaurant profile', '200 OK', `HTTP ${res.status}`, 'FAIL', JSON.stringify(res.data));
    }
  }

  // VENDOR-02: Manage Category (ADD, EDIT, DELETE)
  {
    const addRes = await apiRequest('/api/vendor/categories', {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({ action: 'ADD', name: 'UAT Test Desserts', sortOrder: 99 })
    });
    const addOk = addRes.status === 200 && addRes.data.success;

    const menuRes = await apiRequest('/api/vendor/menu', {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    const cat = Array.isArray(menuRes.data?.data) ? menuRes.data.data.find(c => c.name === 'UAT Test Desserts') : null;
    const catId = cat ? cat.id : null;

    let editOk = false;
    let delOk = false;
    if (catId) {
      const editRes = await apiRequest('/api/vendor/categories', {
        method: 'POST',
        headers: { Authorization: `Bearer ${customerToken}` },
        body: JSON.stringify({ action: 'EDIT', id: catId, name: 'UAT Updated Desserts' })
      });
      editOk = editRes.status === 200 && editRes.data.success;

      const delRes = await apiRequest('/api/vendor/categories', {
        method: 'POST',
        headers: { Authorization: `Bearer ${customerToken}` },
        body: JSON.stringify({ action: 'DELETE', id: catId })
      });
      delOk = delRes.status === 200 && delRes.data.success;
    }

    const allOk = addOk && editOk && delOk;
    recordResult('VENDOR-02', 'RESTAURANT_OWNER', 'Manage menu category (ADD, EDIT, DELETE)', '200 OK for ADD, EDIT, DELETE', `ADD: ${addRes.status}, EDIT: ${editOk ? 200 : 'Err'}, DEL: ${delOk ? 200 : 'Err'}`, allOk ? 'PASS' : 'FAIL');
  }

  // VENDOR-03: Transition PENDING -> ACCEPTED
  {
    const res = await apiRequest(`/api/vendor/orders/${kitchenOrderId}/status`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({ status: 'ACCEPTED' })
    });
    if (res.status === 200 && res.data.success) {
      recordResult('VENDOR-03', 'RESTAURANT_OWNER', 'Kitchen transition PENDING -> ACCEPTED', '200 OK', `HTTP ${res.status}`, 'PASS');
    } else {
      recordResult('VENDOR-03', 'RESTAURANT_OWNER', 'Kitchen transition PENDING -> ACCEPTED', '200 OK', `HTTP ${res.status}`, 'FAIL', JSON.stringify(res.data));
    }
  }

  // VENDOR-04: Illegal State Transition Rejection (ACCEPTED -> DELIVERED directly)
  {
    const res = await apiRequest(`/api/vendor/orders/${kitchenOrderId}/status`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({ status: 'DELIVERED' })
    });
    if (res.status === 400 && !res.data.success) {
      recordResult('VENDOR-04', 'RESTAURANT_OWNER', 'Illegal state skip ACCEPTED -> DELIVERED rejected', '400 Bad Request', `HTTP ${res.status}: ${res.data.message}`, 'PASS');
    } else {
      recordResult('VENDOR-04', 'RESTAURANT_OWNER', 'Illegal state skip ACCEPTED -> DELIVERED rejected', '400 Bad Request', `HTTP ${res.status}`, 'FAIL');
    }
  }

  // VENDOR-05: Transition ACCEPTED -> PREPARING
  {
    const res = await apiRequest(`/api/vendor/orders/${kitchenOrderId}/status`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({ status: 'PREPARING' })
    });
    recordResult('VENDOR-05', 'RESTAURANT_OWNER', 'Kitchen transition ACCEPTED -> PREPARING', '200 OK', `HTTP ${res.status}`, res.status === 200 ? 'PASS' : 'FAIL');
  }

  // VENDOR-06: Transition PREPARING -> READY
  {
    const res = await apiRequest(`/api/vendor/orders/${kitchenOrderId}/status`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({ status: 'READY' })
    });
    recordResult('VENDOR-06', 'RESTAURANT_OWNER', 'Kitchen transition PREPARING -> READY', '200 OK', `HTTP ${res.status}`, res.status === 200 ? 'PASS' : 'FAIL');
  }

  // VENDOR-07: Transition READY -> DELIVERED
  {
    const res = await apiRequest(`/api/vendor/orders/${kitchenOrderId}/status`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({ status: 'DELIVERED' })
    });
    recordResult('VENDOR-07', 'RESTAURANT_OWNER', 'Kitchen transition READY -> DELIVERED', '200 OK', `HTTP ${res.status}`, res.status === 200 ? 'PASS' : 'FAIL');
  }

  // ----------------------------------------------------
  // SUITE 4: REVIEWS & RATINGS SYSTEM
  // ----------------------------------------------------
  console.log('\n--- SUITE 4: REVIEWS & RATINGS SYSTEM ---');

  // REVIEW-01: Submit Restaurant Review
  {
    const res = await apiRequest('/api/reviews', {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({
        targetType: 'RESTAURANT',
        targetId: testRestaurantId,
        rating: 5,
        comment: 'Exceptional taste and prompt packaging during UAT!'
      })
    });
    if (res.status === 200 && res.data?.data?.rating === 5) {
      recordResult('REVIEW-01', 'CUSTOMER', 'Submit 5-star restaurant review', '200 OK with rating: 5', `HTTP ${res.status}`, 'PASS');
    } else {
      recordResult('REVIEW-01', 'CUSTOMER', 'Submit 5-star restaurant review', '200 OK', `HTTP ${res.status}`, 'FAIL', JSON.stringify(res.data));
    }
  }

  // REVIEW-02: Invalid Rating Rejection (rating > 5)
  {
    const res = await apiRequest('/api/reviews', {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({
        targetType: 'RESTAURANT',
        targetId: testRestaurantId,
        rating: 6,
        comment: 'Illegal rating'
      })
    });
    recordResult('REVIEW-02', 'CUSTOMER', 'Reject rating outside 1-5 range', '400 Bad Request', `HTTP ${res.status}`, res.status === 400 ? 'PASS' : 'FAIL');
  }

  // ----------------------------------------------------
  // SUITE 5: RIDE BOOKING & DRIVER FLOW
  // ----------------------------------------------------
  console.log('\n--- SUITE 5: RIDE BOOKING & DRIVER FLOW ---');

  // RIDE-01: Fare Estimation
  {
    const res = await apiRequest('/api/rides/estimate', {
      method: 'POST',
      body: JSON.stringify({
        pickupAddress: 'Connaught Place, New Delhi',
        pickupLatitude: 28.6315,
        pickupLongitude: 77.2167,
        dropoffAddress: 'Terminal 3, IGI Airport, New Delhi',
        dropoffLatitude: 28.5562,
        dropoffLongitude: 77.1000
      })
    });
    const options = res.data?.data?.vehicleOptions;
    if (res.status === 200 && Array.isArray(options) && options.length > 0) {
      recordResult('RIDE-01', 'CUSTOMER', 'Estimate ride fares with Haversine distance', '200 OK with vehicle tiers', `HTTP ${res.status}, tiers: ${options.length}, first: ${options[0].vehicleType}`, 'PASS');
    } else {
      recordResult('RIDE-01', 'CUSTOMER', 'Estimate ride fares', '200 OK', `HTTP ${res.status}`, 'FAIL', JSON.stringify(res.data));
    }
  }

  // RIDE-02: Book Ride
  {
    const res = await apiRequest('/api/rides/book', {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({
        vehicleType: 'BIKE',
        pickupAddress: 'Connaught Place, New Delhi',
        pickupLatitude: 28.6315,
        pickupLongitude: 77.2167,
        dropoffAddress: 'Terminal 3, IGI Airport, New Delhi',
        dropoffLatitude: 28.5562,
        dropoffLongitude: 77.1000,
        paymentMethod: 'CASH'
      })
    });
    if (res.status === 200 && res.data?.data?.id) {
      createdRideId = res.data.data.id;
      createdRideOtp = res.data.data.otpCode;
      const status = res.data.data.status;
      recordResult('RIDE-02', 'CUSTOMER', 'Book ride with OTP generation', '200 OK, status REQUESTED', `HTTP ${res.status}, ID: ${createdRideId}, OTP: ${createdRideOtp}, Status: ${status}`, status === 'REQUESTED' ? 'PASS' : 'FAIL');
    } else {
      recordResult('RIDE-02', 'CUSTOMER', 'Book ride', '200 OK', `HTTP ${res.status}`, 'FAIL', JSON.stringify(res.data));
    }
  }

  // DRIVER-01: Driver Profile
  {
    const res = await apiRequest('/api/driver/profile', {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    if (res.status === 200 && res.data?.data) {
      recordResult('DRIVER-01', 'DRIVER', 'Fetch authenticated driver profile & vehicle', '200 OK with vehicle info', `HTTP ${res.status}, Driver: ${res.data.data.fullName}, Vehicle: ${res.data.data.vehicle?.model}`, 'PASS');
    } else {
      recordResult('DRIVER-01', 'DRIVER', 'Fetch authenticated driver profile', '200 OK', `HTTP ${res.status}`, 'FAIL', JSON.stringify(res.data));
    }
  }

  // DRIVER-02: Toggle Duty Status ONLINE
  {
    const res = await apiRequest('/api/driver/toggle-online', {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({ isOnline: true })
    });
    recordResult('DRIVER-02', 'DRIVER', 'Toggle duty status to ONLINE', '200 OK, isOnline: true', `HTTP ${res.status}, state: ${res.data?.data}`, res.status === 200 && res.data?.data === true ? 'PASS' : 'FAIL');
  }

  // DRIVER-03: Get Available Rides
  {
    const res = await apiRequest('/api/driver/available-rides', {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    const found = res.status === 200 && Array.isArray(res.data?.data) && res.data.data.some(r => r.id == createdRideId);
    recordResult('DRIVER-03', 'DRIVER', 'Receive newly booked ride in dispatch pool', '200 OK, includes active ride request', `HTTP ${res.status}, available count: ${res.data?.data?.length || 0}`, found ? 'PASS' : 'FAIL');
  }

  // DRIVER-04: Accept Ride
  {
    const res = await apiRequest(`/api/driver/rides/${createdRideId}/accept`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    recordResult('DRIVER-04', 'DRIVER', 'Driver accepts ride request', '200 OK, status ACCEPTED', `HTTP ${res.status}, status: ${res.data?.data?.status}`, res.status === 200 && res.data?.data?.status === 'ACCEPTED' ? 'PASS' : 'FAIL');
  }

  // DRIVER-05: Mark Arriving
  {
    const res = await apiRequest(`/api/driver/rides/${createdRideId}/arriving`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    recordResult('DRIVER-05', 'DRIVER', 'Driver marks status ARRIVING at pickup', '200 OK', `HTTP ${res.status}`, res.status === 200 ? 'PASS' : 'FAIL');
  }

  // DRIVER-06: Reject Invalid OTP
  {
    const res = await apiRequest(`/api/driver/rides/${createdRideId}/start`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({ otpCode: '0000' })
    });
    recordResult('DRIVER-06', 'DRIVER', 'Reject incorrect ride start OTP', '400 Bad Request', `HTTP ${res.status}: ${res.data?.message}`, res.status === 400 ? 'PASS' : 'FAIL');
  }

  // DRIVER-07: Start Ride with Valid OTP
  {
    const res = await apiRequest(`/api/driver/rides/${createdRideId}/start`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({ otpCode: createdRideOtp })
    });
    recordResult('DRIVER-07', 'DRIVER', 'Start ride with valid passenger OTP verification', '200 OK', `HTTP ${res.status}`, res.status === 200 ? 'PASS' : 'FAIL');
  }

  // DRIVER-08: GPS Telemetry Update
  {
    const res = await apiRequest('/api/driver/location', {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({ latitude: 28.6318, longitude: 77.2170 })
    });
    recordResult('DRIVER-08', 'DRIVER', 'Update driver GPS telemetry', '200 OK', `HTTP ${res.status}`, res.status === 200 ? 'PASS' : 'FAIL');
  }

  // DRIVER-09: Complete Ride
  {
    const res = await apiRequest(`/api/driver/rides/${createdRideId}/complete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    recordResult('DRIVER-09', 'DRIVER', 'Complete ride upon reaching destination', '200 OK', `HTTP ${res.status}`, res.status === 200 ? 'PASS' : 'FAIL');
  }

  // DRIVER-10: Driver Earnings & Trip History
  {
    const earnRes = await apiRequest('/api/driver/earnings', {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    const histRes = await apiRequest('/api/driver/history', {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    const bothOk = earnRes.status === 200 && histRes.status === 200;
    recordResult('DRIVER-10', 'DRIVER', 'View driver earnings metrics and trip history', '200 OK for earnings and history', `Earnings: ${earnRes.status}, History: ${histRes.status}, rides count: ${histRes.data?.data?.length || 0}`, bothOk ? 'PASS' : 'FAIL');
  }

  // REVIEW-03: Submit Driver Review
  {
    const res = await apiRequest('/api/reviews', {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({
        targetType: 'DRIVER',
        targetId: 1,
        rating: 5,
        comment: 'Safe ride and arrived right on schedule!'
      })
    });
    recordResult('REVIEW-03', 'CUSTOMER', 'Submit 5-star driver review', '200 OK with rating: 5', `HTTP ${res.status}`, res.status === 200 ? 'PASS' : 'FAIL');
  }

  // ----------------------------------------------------
  // SUITE 6: MARKETPLACE (BAZAAR) & MODERATION
  // ----------------------------------------------------
  console.log('\n--- SUITE 6: MARKETPLACE (BAZAAR) & MODERATION ---');

  // BAZAAR-01: Post Listing
  {
    const res = await apiRequest('/api/marketplace/listings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({
        action: 'ADD',
        title: 'Dell XPS 15 Laptop 32GB RAM (Mint)',
        categoryId: 3,
        price: 85000,
        condition: 'LIKE_NEW',
        location: 'Indiranagar, Bengaluru',
        description: 'Sparingly used work laptop with 4K OLED display and original charger.'
      })
    });
    if (res.status === 200 && res.data?.data?.id) {
      createdListingId = res.data.data.id;
      recordResult('BAZAAR-01', 'MARKETPLACE_SELLER', 'Publish community marketplace ad', '200 OK, status ACTIVE', `HTTP ${res.status}, ID: ${createdListingId}`, 'PASS');
    } else {
      recordResult('BAZAAR-01', 'MARKETPLACE_SELLER', 'Publish community marketplace ad', '200 OK', `HTTP ${res.status}`, 'FAIL', JSON.stringify(res.data));
    }
  }

  // BAZAAR-02: View Listing & Toggle Favorite
  {
    const viewRes = await apiRequest(`/api/marketplace/${createdListingId}`);
    const favRes = await apiRequest(`/api/marketplace/favorites/${createdListingId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    const bothOk = viewRes.status === 200 && favRes.status === 200;
    recordResult('BAZAAR-02', 'CUSTOMER', 'View listing details & toggle favorite', '200 OK', `View: ${viewRes.status}, Fav: ${favRes.status}`, bothOk ? 'PASS' : 'FAIL');
  }

  // BAZAAR-03: Report Listing
  {
    const res = await apiRequest(`/api/marketplace/listings/${createdListingId}/report`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({
        reason: 'SPAM',
        details: 'Testing automated moderation flagging'
      })
    });
    recordResult('BAZAAR-03', 'CUSTOMER', 'Report listing for moderation', '200 OK with auto-flagging', `HTTP ${res.status}`, res.status === 200 ? 'PASS' : 'FAIL');
  }

  // BAZAAR-04: Mark Listing as SOLD
  {
    const res = await apiRequest('/api/marketplace/listings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({
        action: 'STATUS',
        id: createdListingId,
        status: 'SOLD'
      })
    });
    recordResult('BAZAAR-04', 'MARKETPLACE_SELLER', 'Seller marks ad status as SOLD', '200 OK', `HTTP ${res.status}`, res.status === 200 ? 'PASS' : 'FAIL');
  }

  // BAZAAR-05: Remove/Deactivate Listing
  {
    const res = await apiRequest('/api/marketplace/listings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({
        action: 'DELETE',
        id: createdListingId
      })
    });
    recordResult('BAZAAR-05', 'MARKETPLACE_SELLER', 'Seller deactivates/removes ad', '200 OK', `HTTP ${res.status}`, res.status === 200 ? 'PASS' : 'FAIL');
  }

  // ----------------------------------------------------
  // SUITE 7: ADMIN COMMAND CENTER & GOVERNANCE
  // ----------------------------------------------------
  console.log('\n--- SUITE 7: ADMIN COMMAND CENTER & GOVERNANCE ---');

  // ADMIN-01: Dashboard KPIs
  {
    const res = await apiRequest('/api/admin/dashboard', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    if (res.status === 200 && res.data?.data?.totalUsers !== undefined) {
      recordResult('ADMIN-01', 'ADMIN', 'Fetch system-wide platform KPI metrics', '200 OK with users, orders, revenue', `HTTP ${res.status}, Users: ${res.data.data.totalUsers}, Revenue: ₹${res.data.data.platformRevenue}`, 'PASS');
    } else {
      recordResult('ADMIN-01', 'ADMIN', 'Fetch system-wide platform KPI metrics', '200 OK', `HTTP ${res.status}`, 'FAIL');
    }
  }

  // ADMIN-02: Manage Users (View & Toggle Suspension)
  {
    const listRes = await apiRequest('/api/admin/users', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const users = listRes.data?.data?.items || [];
    let suspendOk = false;
    if (users.length > 0) {
      const targetUser = users.find(u => u.id != adminUser.id) || users[0];
      const suspendRes = await apiRequest('/api/admin/users', {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ action: 'STATUS', userId: targetUser.id, isActive: false })
      });
      // Restore active status immediately
      await apiRequest('/api/admin/users', {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ action: 'STATUS', userId: targetUser.id, isActive: true })
      });
      suspendOk = suspendRes.status === 200;
    }
    recordResult('ADMIN-02', 'ADMIN', 'View users list & toggle account suspension', '200 OK', `List: ${listRes.status}, Suspend: ${suspendOk ? 200 : 'Failed'}`, listRes.status === 200 && suspendOk ? 'PASS' : 'FAIL');
  }

  // ADMIN-03: Monitor Food Orders
  {
    const res = await apiRequest('/api/admin/food-orders', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    recordResult('ADMIN-03', 'ADMIN', 'Monitor all food orders across restaurants', '200 OK with orders list', `HTTP ${res.status}, count: ${res.data?.data?.length || 0}`, res.status === 200 ? 'PASS' : 'FAIL');
  }

  // ADMIN-04: Monitor Rides
  {
    const res = await apiRequest('/api/admin/rides', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    recordResult('ADMIN-04', 'ADMIN', 'Monitor all fleet rides and driver assignments', '200 OK with rides list', `HTTP ${res.status}, count: ${res.data?.data?.length || 0}`, res.status === 200 ? 'PASS' : 'FAIL');
  }

  // ADMIN-05: Monitor Marketplace Listings
  {
    const res = await apiRequest('/api/admin/marketplace/listings', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    recordResult('ADMIN-05', 'ADMIN', 'Monitor marketplace listings for moderation', '200 OK with listings', `HTTP ${res.status}, count: ${res.data?.data?.length || 0}`, res.status === 200 ? 'PASS' : 'FAIL');
  }

  // ADMIN-06: System Settings Management
  {
    const getRes = await apiRequest('/api/admin/settings', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const updateRes = await apiRequest('/api/admin/settings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ key: 'platform_commission_percent', value: '18', description: 'Updated via UAT' })
    });
    const bothOk = getRes.status === 200 && updateRes.status === 200;
    recordResult('ADMIN-06', 'ADMIN', 'Get & update system settings with DB persistence', '200 OK for GET and POST', `GET: ${getRes.status}, POST: ${updateRes.status}`, bothOk ? 'PASS' : 'FAIL');
  }

  // ADMIN-07: Business Performance Analytics
  {
    const res = await apiRequest('/api/admin/reports', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    recordResult('ADMIN-07', 'ADMIN', 'View executive analytics report & top performers', '200 OK with sales and rankings', `HTTP ${res.status}, top rests: ${res.data?.data?.topRestaurants?.length || 0}`, res.status === 200 ? 'PASS' : 'FAIL');
  }

  // ADMIN-08: Broadcast Push Announcement
  {
    const res = await apiRequest('/api/admin/notifications/broadcast', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        title: 'SuperApp System Notice',
        message: 'Platform operating normally across all operational nodes.',
        targetRole: 'ALL'
      })
    });
    recordResult('ADMIN-08', 'ADMIN', 'Broadcast system announcement to target users', '200 OK with recipient count', `HTTP ${res.status}: ${res.data?.message}`, res.status === 200 ? 'PASS' : 'FAIL');
  }

  // ----------------------------------------------------
  // SUITE 8: NEGATIVE AUTHORIZATION TESTS
  // ----------------------------------------------------
  console.log('\n--- SUITE 8: NEGATIVE AUTHORIZATION & SECURITY ---');

  // SEC-01: Unauthenticated Protected Endpoint
  {
    const res = await apiRequest('/api/driver/profile');
    recordResult('SEC-01', 'SECURITY', 'Unauthenticated call to protected endpoint rejected', '401 Unauthorized', `HTTP ${res.status}`, res.status === 401 ? 'PASS' : 'FAIL');
  }

  // SEC-02: Invalid Token Rejected
  {
    const res = await apiRequest('/api/driver/profile', {
      headers: { Authorization: 'Bearer invalid.token.signature' }
    });
    recordResult('SEC-02', 'SECURITY', 'Forged/invalid JWT token rejected', '401 Unauthorized', `HTTP ${res.status}`, res.status === 401 ? 'PASS' : 'FAIL');
  }

  // SEC-03: Pure Citizen attempting Driver toggle-online
  {
    // Create new pure customer
    const sendRes = await apiRequest('/api/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ mobileNumber: '9123456780' })
    });
    const verRes = await apiRequest('/api/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ mobileNumber: '9123456780', otpCode: '123456', fullName: 'Pure Customer' })
    });
    const pureToken = verRes.data?.token;

    if (pureToken) {
      const toggleRes = await apiRequest('/api/driver/toggle-online', {
        method: 'POST',
        headers: { Authorization: `Bearer ${pureToken}` },
        body: JSON.stringify({ isOnline: true })
      });
      // Should be 403 Forbidden
      recordResult('SEC-03', 'SECURITY', 'Customer without DRIVER role rejected from driver API', '403 Forbidden', `HTTP ${toggleRes.status}`, toggleRes.status === 403 ? 'PASS' : 'FAIL');

      // SEC-04: Pure Citizen attempting Vendor operations without RESTAURANT_OWNER role
      const vendorRes = await apiRequest('/api/vendor/my-restaurant', {
        headers: { Authorization: `Bearer ${pureToken}` }
      });
      recordResult('SEC-04', 'SECURITY', 'Customer without RESTAURANT_OWNER role rejected from vendor API', '404 or 403 Restricted', `HTTP ${vendorRes.status}`, (vendorRes.status === 404 || vendorRes.status === 403) ? 'PASS' : 'FAIL');
    }
  }

  // ----------------------------------------------------
  // SUMMARY
  // ----------------------------------------------------
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const blocked = results.filter(r => r.status === 'BLOCKED').length;
  const deferred = results.filter(r => r.status === 'DEFERRED').length;

  console.log('\n====================================================');
  console.log('REAL END-TO-END UAT RUN COMPLETE');
  console.log(`TOTAL SCENARIOS: ${results.length}`);
  console.log(`PASS:     ${passed}`);
  console.log(`FAIL:     ${failed}`);
  console.log(`BLOCKED:  ${blocked}`);
  console.log(`DEFERRED: ${deferred}`);
  console.log('====================================================');

  return { results, passed, failed, blocked, deferred };
}

runUat();
