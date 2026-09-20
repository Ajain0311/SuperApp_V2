# SuperApp V2 — REST API & Real-Time SignalR Reference

## 1. Global API Conventions

- **Base URL (Local)**: `http://localhost:5000/api`
- **Base URL (Production)**: `https://api.superapp.domain/api`
- **SignalR Hubs**:
  - Order Tracking: `http://localhost:5000/hubs/order`
  - Ride Tracking & Telemetry: `http://localhost:5000/hubs/ride`
  - Peer Messaging: `http://localhost:5000/hubs/chat`
- **Content Type**: `application/json` (unless multipart for image upload)
- **Standard Authentication**: Bearer token via HTTP Header:
  ```http
  Authorization: Bearer <JWT_ACCESS_TOKEN>
  ```

### Standard Response Envelope
Successful responses return standard JSON envelopes or direct payloads:
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully"
}
```

### Standard Error Envelope (RFC 7807 compatible)
```json
{
  "type": "https://tools.ietf.org/html/rfc7231#section-6.5.1",
  "title": "Bad Request",
  "status": 400,
  "detail": "Invalid status transition from PENDING to DELIVERED."
}
```

---

## 2. Authentication Controller (`/api/auth`)

### 2.1 Request Mobile OTP
`POST /api/auth/send-otp`  
Sends a 6-digit OTP via Punjab State e-Governance DLT SMS Gateway. In non-production environments, fallback code `123456` is enabled.

- **Request Body**:
  ```json
  {
    "phoneNumber": "6375002348"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "OTP sent successfully. Valid for 3 minutes.",
    "expiresInSeconds": 180
  }
  ```

### 2.2 Verify Mobile OTP & Issue JWT
`POST /api/auth/verify-otp`  
Verifies OTP, provisions or retrieves citizen user account, and issues HMAC-SHA256 signed JWT with multi-role claims.

- **Request Body**:
  ```json
  {
    "phoneNumber": "6375002348",
    "otp": "123456"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "u-101",
      "phoneNumber": "6375002348",
      "fullName": "Test User",
      "email": "user@superapp.local",
      "roles": ["CUSTOMER", "DRIVER", "RESTAURANT_OWNER", "MARKETPLACE_SELLER"],
      "isActive": true
    }
  }
  ```

### 2.3 Admin Direct Authentication
`POST /api/auth/admin-login`  
Direct credential login for authorized platform operators and administrators.

- **Request Body**:
  ```json
  {
    "phoneNumber": "9999999999",
    "password": "AdminPassword123!"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "u-admin",
      "phoneNumber": "9999999999",
      "fullName": "Super Administrator",
      "roles": ["ADMIN", "CUSTOMER"]
    }
  }
  ```

### 2.4 User Profile
`GET /api/auth/profile` *(Requires Bearer Token)*  
Fetches authenticated user identity, saved addresses, and active role permissions.

---

## 3. Food Delivery Controllers

### 3.1 Restaurant Discovery (`/api/restaurants`)
- `GET /api/restaurants?lat=28.6139&lng=77.2090&cuisine=North+Indian&isVeg=false`  
  Returns directory of active restaurants sorted by proximity and rating.
- `GET /api/restaurants/{id}`  
  Returns full restaurant detail, categorized menu catalog, dish variants, and addon groups.

### 3.2 Food Orders (`/api/foodorders`)
- `POST /api/foodorders` *(Requires Bearer Token)*  
  Places a new food delivery order.
  ```json
  {
    "restaurantId": 1,
    "items": [
      {
        "menuItemId": 101,
        "quantity": 2,
        "variantId": 1,
        "selectedAddonIds": [1, 2]
      }
    ],
    "deliveryAddressId": 5,
    "couponCode": "WELCOME50",
    "paymentMethod": "UPI"
  }
  ```
- `GET /api/foodorders` *(Requires Bearer Token)*: Returns order history for current customer.
- `GET /api/foodorders/{id}` *(Requires Bearer Token)*: Returns detailed status stepper and items.
- `POST /api/foodorders/{id}/cancel` *(Requires Bearer Token)*: Cancels order if still in `PENDING` state.

### 3.3 Restaurant Vendor Portal (`/api/vendor`)
*(Requires Role: RESTAURANT_OWNER)*
- `GET /api/vendor/profile`: Returns restaurant profile mapped to the authenticated vendor user.
- `GET /api/vendor/orders?status=PENDING`: Returns incoming kitchen order queue.
- `POST /api/vendor/orders/{id}/status`: Advances kitchen state machine:
  ```json
  {
    "status": "ACCEPTED" // PENDING -> ACCEPTED -> PREPARING -> READY -> DELIVERED
  }
  ```
- `GET /api/vendor/menu`: Returns vendor's restaurant menu items.
- `POST /api/vendor/menu/items`: Creates/updates dish pricing, availability, and description.
- `POST /api/vendor/categories`: Action endpoint supporting `ADD`, `EDIT`, `DELETE` category.
- `POST /api/vendor/toggle-status`: Opens or closes the restaurant for taking orders.
- `GET /api/vendor/earnings`: Summarizes gross revenue, platform fee deduction, and net payout.

---

## 4. Ride Hailing Controllers

### 4.1 Passenger Rides (`/api/rides`)
*(Requires Bearer Token)*
- `POST /api/rides/estimate`: Estimates fare and travel time using zero-cost Haversine formula:
  ```json
  {
    "pickupLatitude": 28.6139,
    "pickupLongitude": 77.2090,
    "dropoffLatitude": 28.5355,
    "dropoffLongitude": 77.3910
  }
  ```
  **Response**:
  ```json
  {
    "distanceKm": 16.4,
    "durationMinutes": 34,
    "tiers": [
      { "vehicleType": "BIKE", "fare": 45, "etaMinutes": 3 },
      { "vehicleType": "AUTO", "fare": 66, "etaMinutes": 5 },
      { "vehicleType": "CAB_ECONOMY", "fare": 127, "etaMinutes": 8 }
    ]
  }
  ```
- `POST /api/rides/book`: Books ride, generates 4-digit start OTP (`1234`), sets status `SEARCHING`, and alerts driver pool via SignalR.
- `GET /api/rides/active`: Returns ongoing ride state and driver position.
- `POST /api/rides/{id}/cancel`: Cancels trip before passenger pickup.

### 4.2 Driver Partner Portal (`/api/driver`)
*(Requires Role: DRIVER)*
- `GET /api/driver/profile`: Driver rating, vehicle license plate, and duty metrics.
- `POST /api/driver/toggle-online`: Switches driver duty between `Online` and `Offline`. Joins/leaves `drivers-pool` SignalR group.
- `GET /api/driver/available-rides`: Lists pending rides searching in driver's vicinity.
- `POST /api/driver/rides/{id}/accept`: Claims ride; transitions state to `ACCEPTED`.
- `POST /api/driver/rides/{id}/arriving`: Updates state to `ARRIVING` at pickup spot.
- `POST /api/driver/rides/{id}/start`: Handshakes ride start with customer 4-digit OTP:
  ```json
  {
    "otp": "4829"
  }
  ```
- `POST /api/driver/rides/{id}/complete`: Completes trip, calculates final meter, and credits driver wallet.
- `POST /api/driver/location`: Streams GPS coordinates (`lat`, `lng`, `heading`, `speed`) into DB and relays over SignalR `DriverLocationUpdated`.
- `GET /api/driver/earnings`: Returns today's trips, daily revenue, and payout balance.

---

## 5. Community Bazaar Marketplace (`/api/marketplace`)

- `GET /api/marketplace/categories`: Catalog of 8 classified categories (Mobiles, Vehicles, Electronics, Furniture, Fashion, etc.).
- `GET /api/marketplace/listings?category=Vehicles&query=Honda&minPrice=10000&maxPrice=50000`: Searchable feed of active classifieds.
- `GET /api/marketplace/listings/{id}`: Detailed listing view with image gallery and seller info.
- `POST /api/marketplace/listings` *(Requires Role: MARKETPLACE_SELLER or CUSTOMER)*: Publishes classified ad with title, description, price, condition (`NEW`, `LIKE_NEW`, `USED`, `FAIR`), and image URLs.
- `POST /api/marketplace/listings/{id}/report`: Citizen reporting endpoint for inappropriate or fraudulent ads; auto-flags ad for admin moderation.
- `GET /api/marketplace/my-listings`: Seller's published ads.
- `POST /api/marketplace/listings/{id}/toggle-status`: Toggles listing between active and sold (`IS_SOLD`).
- `DELETE /api/marketplace/listings/{id}`: Deletes or archives listing.

---

## 6. Shared System Controllers

### 6.1 Coupons (`/api/coupons`)
- `POST /api/coupons/validate`: Validates promo code (`WELCOME50`) against cart subtotal, calculating instant discount.
- `GET /api/coupons/available`: Returns applicable coupons for customer.

### 6.2 Reviews & Ratings (`/api/reviews`)
- `GET /api/reviews/{targetType}/{targetId}`: Fetches reviews for `RESTAURANT`, `DRIVER`, or `LISTING`.
- `POST /api/reviews`: Submits 1–5 star rating with text feedback and updates target rolling average.

### 6.3 Push Notifications (`/api/notifications`)
- `POST /api/notifications/register-token`: Registers native Expo push token (`ExponentPushToken[...]`).
- `GET /api/notifications`: Customer notification history.
- `POST /api/notifications/{id}/read`: Marks notification as read.
- `GET /api/notifications/unread-count`: Returns active unread badge counter.

### 6.4 Payments (`/api/payments`)
- `GET /api/payments/kit`: Returns payment gateway configuration.
- `POST /api/payments/create-order`: Initiates Easebuzz payment transaction.
- `POST /api/payments/verify`: Verifies transaction signature and marks order `PAID`.
- `POST /api/payments/webhook`: Asynchronous Easebuzz server-to-server payment callback.

### 6.5 Admin Command Center (`/api/admin`)
*(Requires Role: ADMIN)*
- `GET /api/admin/dashboard`: Platform KPIs (Gross Order Value, Total Rides, Active Users, Revenue).
- `GET /api/admin/food-orders`: System-wide food orders with status filtering.
- `GET /api/admin/rides`: System-wide ride dispatch logs.
- `GET /api/admin/marketplace/listings`: System-wide classified listings with moderation queue.
- `POST /api/admin/restaurants`: Restaurant status approval and activation toggle (`STATUS`).
- `POST /api/admin/users/{id}/toggle-status`: Customer/Driver/Vendor suspension switch.
- `GET /api/admin/settings`: Platform config parameters.
- `POST /api/admin/notifications/broadcast`: Emergency or promotional push broadcast to all registered devices.

---

## 7. Real-Time SignalR Hub Contracts

### 7.1 Order Status Hub (`/hubs/order`)
- **Connection URL**: `http://localhost:5000/hubs/order?access_token=<JWT>`
- **Client Invocations**:
  - `JoinOrderGroup(orderId)`: Subscribes socket to `order-{orderId}`.
  - `LeaveOrderGroup(orderId)`: Unsubscribes from order room.
- **Server Events**:
  - `OrderStatusUpdated(object payload)`: Emitted on state changes:
    ```json
    {
      "orderId": 1002,
      "status": "PREPARING",
      "updatedAt": "2026-09-20T17:50:00Z"
    }
    ```

### 7.2 Ride Tracking Hub (`/hubs/ride`)
- **Connection URL**: `http://localhost:5000/hubs/ride?access_token=<JWT>`
- **Client Invocations**:
  - `JoinDriversPool()`: Driver enters dispatch pool group.
  - `LeaveDriversPool()`: Driver exits dispatch pool group.
  - `JoinRideGroup(rideId)`: Passenger or driver joins tracking room `ride-{rideId}`.
- **Server Events**:
  - `RideRequested(object rideSummary)`: Broadcast to `drivers-pool` when a customer requests a ride.
  - `DriverAssigned(object driverInfo)`: Sent to `ride-{rideId}` when driver accepts.
  - `DriverLocationUpdated(double lat, double lng, double heading)`: Real-time GPS coordinates stream.
  - `RideStatusChanged(string status)`: Dispatched on `ARRIVING`, `STARTED`, `COMPLETED`, `CANCELLED`.
