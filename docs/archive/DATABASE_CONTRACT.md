# SuperApp Database Contract Specification

## 1. Overview

This document specifies the authoritative relational database contract for the **SuperApp** platform across Identity, Food Ordering, Ride Services, Community Marketplace, and Device Notifications.

All table names, column data types, foreign keys, delete behaviors, valid status values, and indexing strategies are defined below.

---

## 2. Global Entity & Schema Conventions

1. **Naming Convention**: All database tables and columns use standard PostgreSQL `snake_case`.
2. **Primary Keys**:
   - `id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY` for high-volume entities (`users`, `food_orders`, `rides`, `marketplace_listings`, etc.).
   - `id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY` for low-volume lookup catalogs (`roles`, `marketplace_categories`, `app_settings`).
3. **Timestamps**: All timestamps use `TIMESTAMPTZ` (timestamp with time zone) defaulting to `clock_timestamp()`.
4. **Historical Record Preservation**: Critical transactional entities (`food_orders`, `rides`, `payments`) maintain `ON DELETE RESTRICT` on customer and partner foreign keys. User deactivation is handled via `is_active = FALSE` rather than physical row deletion.

---

## 3. Relationship Map

```
users
  ├── user_roles (CASCADE) ──────────> roles
  ├── addresses (CASCADE)
  ├── restaurant_users (CASCADE) ─────> restaurants
  ├── drivers (CASCADE) ──────────────> vehicles (CASCADE)
  ├── food_orders (RESTRICT) ─────────> food_order_items (CASCADE)
  ├── rides (RESTRICT)
  ├── marketplace_listings (RESTRICT) ─> listing_images (CASCADE)
  ├── favorites (CASCADE)
  ├── notifications (CASCADE)
  ├── user_device_tokens (CASCADE)
  └── payments (RESTRICT)

restaurants
  ├── restaurant_categories (CASCADE) ─> food_items (CASCADE)
  │                                        ├── food_item_variants (CASCADE)
  │                                        └── food_item_addons (CASCADE)
  ├── restaurant_users (CASCADE)
  └── food_orders (RESTRICT)

coupons
  ├── food_orders (SET NULL)
  └── coupon_usages (CASCADE)
```

---

## 4. Domain Tables & Contracts

### 4.1 Identity & Access Management

#### `roles`
Catalog of system roles.
- `id` (`INT`, PK)
- `name` (`VARCHAR(50)`, NOT NULL, UNIQUE): `'CUSTOMER'`, `'ADMIN'`, `'RESTAURANT_OWNER'`, `'DRIVER'`, `'MARKETPLACE_SELLER'`
- `description` (`VARCHAR(255)`, NULL)
- `is_active` (`BOOLEAN`, NOT NULL, DEFAULT TRUE)
- `created_at` (`TIMESTAMPTZ`, NOT NULL)

#### `users`
Central user identity entity across all modules.
- `id` (`BIGINT`, PK)
- `mobile_number` (`VARCHAR(15)`, NOT NULL, UNIQUE): Primary login identifier (+91 format).
- `full_name` (`VARCHAR(100)`, NULL)
- `email` (`VARCHAR(255)`, NULL, UNIQUE WHERE NOT NULL)
- `profile_image_url` (`VARCHAR(500)`, NULL)
- `password_hash` (`VARCHAR(255)`, NULL): BCrypt hash (used by admins/credentials; null for pure OTP users).
- `is_active` (`BOOLEAN`, NOT NULL, DEFAULT TRUE): Soft-delete / account lock toggle.
- `created_at` (`TIMESTAMPTZ`, NOT NULL)
- `last_login_at` (`TIMESTAMPTZ`, NULL)

#### `user_roles`
Many-to-many role mapping.
- `id` (`BIGINT`, PK)
- `user_id` (`BIGINT`, FK `users.id`, ON DELETE CASCADE)
- `role_id` (`INT`, FK `roles.id`, ON DELETE CASCADE)
- `created_at` (`TIMESTAMPTZ`, NOT NULL)
- **Constraint**: `UNIQUE (user_id, role_id)`

#### `otp_requests`
OTP delivery, verification tracking, and rate limiting.
- `id` (`BIGINT`, PK)
- `mobile_number` (`VARCHAR(15)`, NOT NULL)
- `otp_code` (`VARCHAR(10)`, NOT NULL)
- `purpose` (`VARCHAR(50)`, NOT NULL, DEFAULT `'LOGIN'`)
- `is_used` (`BOOLEAN`, NOT NULL, DEFAULT FALSE)
- `attempt_count` (`INT`, NOT NULL, DEFAULT 0)
- `expires_at` (`TIMESTAMPTZ`, NOT NULL)
- `created_at` (`TIMESTAMPTZ`, NOT NULL)

#### `addresses`
Saved customer delivery and pickup addresses.
- `id` (`BIGINT`, PK)
- `user_id` (`BIGINT`, FK `users.id`, ON DELETE CASCADE)
- `label` (`VARCHAR(50)`, NULL): `'Home'`, `'Work'`, `'Other'`
- `address_line1` (`VARCHAR(255)`, NOT NULL)
- `address_line2` (`VARCHAR(255)`, NULL)
- `city` (`VARCHAR(100)`, NOT NULL)
- `state` (`VARCHAR(100)`, NOT NULL)
- `pin_code` (`VARCHAR(10)`, NOT NULL)
- `latitude` (`DECIMAL(10,7)`, NULL)
- `longitude` (`DECIMAL(10,7)`, NULL)
- `is_default` (`BOOLEAN`, NOT NULL, DEFAULT FALSE)
- `is_active` (`BOOLEAN`, NOT NULL, DEFAULT TRUE)

---

### 4.2 Restaurants & Food Ordering

#### `restaurants`
Partner food establishments.
- `id` (`BIGINT`, PK)
- `name` (`VARCHAR(200)`, NOT NULL)
- `description` (`TEXT`, NULL)
- `image_url` (`VARCHAR(500)`, NULL)
- `phone` (`VARCHAR(15)`, NULL)
- `email` (`VARCHAR(255)`, NULL)
- `address_line` (`VARCHAR(500)`, NULL)
- `city` (`VARCHAR(100)`, NULL)
- `latitude` (`DECIMAL(10,7)`, NULL)
- `longitude` (`DECIMAL(10,7)`, NULL)
- `rating` (`DECIMAL(3,2)`, NOT NULL, DEFAULT 0.00)
- `total_ratings` (`INT`, NOT NULL, DEFAULT 0)
- `is_veg` (`BOOLEAN`, NOT NULL, DEFAULT FALSE): Pure vegetarian flag.
- `opening_time` (`TIME`, NULL)
- `closing_time` (`TIME`, NULL)
- `min_order_amount` (`DECIMAL(10,2)`, NOT NULL, DEFAULT 0.00)
- `delivery_fee` (`DECIMAL(10,2)`, NOT NULL, DEFAULT 0.00)
- `avg_delivery_time_minutes` (`INT`, NOT NULL, DEFAULT 30)
- `is_active` (`BOOLEAN`, NOT NULL, DEFAULT TRUE)
- `is_featured` (`BOOLEAN`, NOT NULL, DEFAULT FALSE)

#### `restaurant_users`
Restaurant manager and owner tenant associations.
- `id` (`BIGINT`, PK)
- `restaurant_id` (`BIGINT`, FK `restaurants.id`, ON DELETE CASCADE)
- `user_id` (`BIGINT`, FK `users.id`, ON DELETE CASCADE)
- `is_active` (`BOOLEAN`, NOT NULL, DEFAULT TRUE)
- **Constraint**: `UNIQUE (restaurant_id, user_id)`

#### `restaurant_categories`
Menu categories for a restaurant.
- `id` (`BIGINT`, PK)
- `restaurant_id` (`BIGINT`, FK `restaurants.id`, ON DELETE CASCADE)
- `name` (`VARCHAR(100)`, NOT NULL)
- `sort_order` (`INT`, NOT NULL, DEFAULT 0)
- `is_active` (`BOOLEAN`, NOT NULL, DEFAULT TRUE)

#### `food_items`
Dishes and catalog items.
- `id` (`BIGINT`, PK)
- `restaurant_id` (`BIGINT`, FK `restaurants.id`, ON DELETE RESTRICT)
- `restaurant_category_id` (`BIGINT`, FK `restaurant_categories.id`, ON DELETE CASCADE)
- `name` (`VARCHAR(200)`, NOT NULL)
- `description` (`TEXT`, NULL)
- `image_url` (`VARCHAR(500)`, NULL)
- `base_price` (`DECIMAL(10,2)`, NOT NULL)
- `discount_percent` (`DECIMAL(5,2)`, NOT NULL, DEFAULT 0.00)
- `is_veg` (`BOOLEAN`, NOT NULL, DEFAULT TRUE)
- `is_available` (`BOOLEAN`, NOT NULL, DEFAULT TRUE)
- `is_bestseller` (`BOOLEAN`, NOT NULL, DEFAULT FALSE)
- `is_customizable` (`BOOLEAN`, NOT NULL, DEFAULT FALSE)
- `sort_order` (`INT`, NOT NULL, DEFAULT 0)

#### `food_item_variants`
Size and portion options.
- `id` (`BIGINT`, PK)
- `food_item_id` (`BIGINT`, FK `food_items.id`, ON DELETE CASCADE)
- `name` (`VARCHAR(200)`, NOT NULL) e.g. `'Regular Portion'`, `'Jumbo Pack'`
- `additional_price` (`DECIMAL(10,2)`, NOT NULL, DEFAULT 0.00)
- `is_default` (`BOOLEAN`, NOT NULL, DEFAULT FALSE)

#### `food_item_addons`
Toppings, beverages, and optional add-ons.
- `id` (`BIGINT`, PK)
- `food_item_id` (`BIGINT`, FK `food_items.id`, ON DELETE CASCADE)
- `group_name` (`VARCHAR(100)`, NOT NULL) e.g. `'ADD-ONS'`, `'BEVERAGES'`
- `name` (`VARCHAR(200)`, NOT NULL)
- `price` (`DECIMAL(10,2)`, NOT NULL)
- `is_default` (`BOOLEAN`, NOT NULL, DEFAULT FALSE)

#### `coupons`
Promotional codes applicable to orders and rides.
- `id` (`BIGINT`, PK)
- `code` (`VARCHAR(20)`, NOT NULL, UNIQUE)
- `discount_type` (`VARCHAR(20)`, NOT NULL): `'PERCENTAGE'`, `'FLAT'`
- `discount_value` (`DECIMAL(10,2)`, NOT NULL)
- `min_order_amount` (`DECIMAL(10,2)`, NOT NULL, DEFAULT 0.00)
- `max_discount` (`DECIMAL(10,2)`, NULL)
- `start_date` (`TIMESTAMPTZ`, NOT NULL)
- `expiry_date` (`TIMESTAMPTZ`, NOT NULL)
- `per_user_limit` (`INT`, NOT NULL, DEFAULT 1)
- `applicable_module` (`VARCHAR(20)`, NOT NULL): `'FOOD'`, `'RIDE'`, `'ALL'`

#### `food_orders`
Customer food orders.
- `id` (`BIGINT`, PK)
- `order_number` (`VARCHAR(20)`, NOT NULL, UNIQUE): e.g. `'FO-1002'`
- `user_id` (`BIGINT`, FK `users.id`, ON DELETE RESTRICT)
- `restaurant_id` (`BIGINT`, FK `restaurants.id`, ON DELETE RESTRICT)
- `address_id` (`BIGINT`, FK `addresses.id`, ON DELETE SET NULL)
- `status` (`VARCHAR(20)`, NOT NULL, DEFAULT `'PENDING'`):
  - `'PENDING'`: Placed by customer.
  - `'ACCEPTED'`: Confirmed by restaurant kitchen.
  - `'PREPARING'`: Being cooked.
  - `'READY'`: Packed and waiting for delivery partner.
  - `'PICKED_UP'`: In transit with driver.
  - `'DELIVERED'`: Handed to customer.
  - `'CANCELLED'`: Terminated.
- `sub_total` (`DECIMAL(10,2)`, NOT NULL)
- `discount_amount` (`DECIMAL(10,2)`, NOT NULL, DEFAULT 0.00)
- `coupon_id` (`BIGINT`, FK `coupons.id`, ON DELETE SET NULL)
- `coupon_discount` (`DECIMAL(10,2)`, NOT NULL, DEFAULT 0.00)
- `delivery_fee` (`DECIMAL(10,2)`, NOT NULL, DEFAULT 0.00)
- `tax_amount` (`DECIMAL(10,2)`, NOT NULL, DEFAULT 0.00): 5% GST calculation.
- `grand_total` (`DECIMAL(10,2)`, NOT NULL)
- `payment_method` (`VARCHAR(20)`, NULL): `'COD'`, `'UPI'`, `'CARD'`
- `payment_status` (`VARCHAR(20)`, NOT NULL, DEFAULT `'PENDING'`)

#### `food_order_items`
Individual line items in an order.
- `id` (`BIGINT`, PK)
- `food_order_id` (`BIGINT`, FK `food_orders.id`, ON DELETE CASCADE)
- `food_item_id` (`BIGINT`, FK `food_items.id`, ON DELETE RESTRICT)
- `item_name` (`VARCHAR(200)`, NOT NULL)
- `quantity` (`INT`, NOT NULL, DEFAULT 1)
- `unit_price` (`DECIMAL(10,2)`, NOT NULL)
- `variant_name` (`VARCHAR(200)`, NULL)
- `variant_price` (`DECIMAL(10,2)`, NOT NULL, DEFAULT 0.00)
- `addons_json` (`TEXT`, NULL): Serialized array of chosen add-ons.
- `total_price` (`DECIMAL(10,2)`, NOT NULL)

---

### 4.3 Ride & Transportation Services

#### `drivers`
Verified ride partner profile.
- `id` (`BIGINT`, PK)
- `user_id` (`BIGINT`, FK `users.id`, ON DELETE CASCADE, UNIQUE)
- `license_number` (`VARCHAR(50)`, NULL)
- `is_verified` (`BOOLEAN`, NOT NULL, DEFAULT FALSE)
- `is_online` (`BOOLEAN`, NOT NULL, DEFAULT FALSE)
- `current_latitude` (`DECIMAL(10,7)`, NULL)
- `current_longitude` (`DECIMAL(10,7)`, NULL)
- `rating` (`DECIMAL(3,2)`, NOT NULL, DEFAULT 0.00)
- `total_rides` (`INT`, NOT NULL, DEFAULT 0)

#### `vehicles`
Registered vehicles assigned to drivers.
- `id` (`BIGINT`, PK)
- `driver_id` (`BIGINT`, FK `drivers.id`, ON DELETE CASCADE)
- `type` (`VARCHAR(20)`, NOT NULL): `'BIKE'`, `'AUTO'`, `'CAB'`
- `make` (`VARCHAR(100)`, NULL)
- `model` (`VARCHAR(100)`, NULL)
- `year` (`INT`, NULL)
- `registration_number` (`VARCHAR(20)`, NOT NULL, UNIQUE)
- `color` (`VARCHAR(50)`, NULL)

#### `rides`
Trip booking and execution.
- `id` (`BIGINT`, PK)
- `ride_number` (`VARCHAR(20)`, NOT NULL, UNIQUE): e.g. `'RD-5021'`
- `user_id` (`BIGINT`, FK `users.id`, ON DELETE RESTRICT)
- `driver_id` (`BIGINT`, FK `drivers.id`, ON DELETE RESTRICT, NULL)
- `vehicle_id` (`BIGINT`, FK `vehicles.id`, ON DELETE RESTRICT, NULL)
- `vehicle_type` (`VARCHAR(20)`, NOT NULL): `'BIKE'`, `'AUTO'`, `'CAB'`
- `pickup_address` (`VARCHAR(500)`, NOT NULL)
- `pickup_latitude` (`DECIMAL(10,7)`, NOT NULL)
- `pickup_longitude` (`DECIMAL(10,7)`, NOT NULL)
- `dropoff_address` (`VARCHAR(500)`, NOT NULL)
- `dropoff_latitude` (`DECIMAL(10,7)`, NOT NULL)
- `dropoff_longitude` (`DECIMAL(10,7)`, NOT NULL)
- `distance_km` (`DECIMAL(10,2)`, NULL)
- `estimated_fare` (`DECIMAL(10,2)`, NOT NULL)
- `actual_fare` (`DECIMAL(10,2)`, NULL)
- `status` (`VARCHAR(20)`, NOT NULL, DEFAULT `'REQUESTED'`):
  - `'REQUESTED'`: Customer requested pickup.
  - `'ASSIGNED'`: Driver matched.
  - `'ACCEPTED'`: Driver accepted dispatch.
  - `'ARRIVING'`: Driver approaching pickup.
  - `'STARTED'`: Ride verified via OTP and in progress.
  - `'COMPLETED'`: Arrived at destination.
  - `'CANCELLED'`: Trip cancelled.
- `otp_code` (`VARCHAR(10)`, NULL): 4-digit start-trip verification code (e.g. `'4829'`).
- `started_at` (`TIMESTAMPTZ`, NULL)
- `completed_at` (`TIMESTAMPTZ`, NULL)
- `cancelled_at` (`TIMESTAMPTZ`, NULL)

---

### 4.4 Community Marketplace (Bazaar)

#### `marketplace_categories`
- `id` (`INT`, PK)
- `name` (`VARCHAR(100)`, NOT NULL, UNIQUE): `'Mobiles'`, `'Vehicles'`, `'Electronics'`, `'Furniture'`, `'Fashion'`, `'Books'`, `'Sports'`, `'Others'`
- `icon_url` (`VARCHAR(500)`, NULL)
- `sort_order` (`INT`, NOT NULL, DEFAULT 0)

#### `marketplace_listings`
Classified ads posted by users.
- `id` (`BIGINT`, PK)
- `user_id` (`BIGINT`, FK `users.id`, ON DELETE RESTRICT)
- `category_id` (`INT`, FK `marketplace_categories.id`, ON DELETE RESTRICT)
- `title` (`VARCHAR(200)`, NOT NULL)
- `description` (`TEXT`, NULL)
- `price` (`DECIMAL(12,2)`, NOT NULL)
- `condition` (`VARCHAR(20)`, NOT NULL, DEFAULT `'USED'`): `'NEW'`, `'LIKE_NEW'`, `'USED'`, `'FAIR'`
- `location` (`VARCHAR(200)`, NULL)
- `latitude` (`DECIMAL(10,7)`, NULL)
- `longitude` (`DECIMAL(10,7)`, NULL)
- `status` (`VARCHAR(20)`, NOT NULL, DEFAULT `'ACTIVE'`): `'ACTIVE'`, `'SOLD'`, `'EXPIRED'`, `'REMOVED'`
- `is_featured` (`BOOLEAN`, NOT NULL, DEFAULT FALSE)
- `view_count` (`INT`, NOT NULL, DEFAULT 0)

#### `listing_images`
- `id` (`BIGINT`, PK)
- `listing_id` (`BIGINT`, FK `marketplace_listings.id`, ON DELETE CASCADE)
- `image_url` (`VARCHAR(500)`, NOT NULL)
- `sort_order` (`INT`, NOT NULL, DEFAULT 0)

#### `favorites`
- `id` (`BIGINT`, PK)
- `user_id` (`BIGINT`, FK `users.id`, ON DELETE CASCADE)
- `listing_id` (`BIGINT`, FK `marketplace_listings.id`, ON DELETE CASCADE)
- **Constraint**: `UNIQUE (user_id, listing_id)`

---

### 4.5 Device Push Notifications & Platform Commons

#### `notifications`
In-app alert notification feed.
- `id` (`BIGINT`, PK)
- `user_id` (`BIGINT`, FK `users.id`, ON DELETE CASCADE)
- `title` (`VARCHAR(200)`, NOT NULL)
- `body` (`TEXT`, NULL)
- `type` (`VARCHAR(50)`, NULL): `'ORDER'`, `'RIDE'`, `'MARKETPLACE'`, `'PROMO'`, `'SYSTEM'`
- `reference_id` (`VARCHAR(50)`, NULL)
- `is_read` (`BOOLEAN`, NOT NULL, DEFAULT FALSE)
- `created_at` (`TIMESTAMPTZ`, NOT NULL)

#### `user_device_tokens`
Expo push notification tokens registered from mobile devices.
- `id` (`BIGINT`, PK)
- `user_id` (`BIGINT`, FK `users.id`, ON DELETE CASCADE)
- `expo_push_token` (`VARCHAR(255)`, NOT NULL, UNIQUE)
- `platform` (`VARCHAR(20)`, NOT NULL): `'ios'`, `'android'`, `'web'`
- `device_name` (`VARCHAR(100)`, NULL)
- `is_active` (`BOOLEAN`, NOT NULL, DEFAULT TRUE)
- `created_at` (`TIMESTAMPTZ`, NOT NULL)
- `updated_at` (`TIMESTAMPTZ`, NULL)
- `last_seen_at` (`TIMESTAMPTZ`, NULL)

#### `banners`
- `id` (`BIGINT`, PK)
- `title` (`VARCHAR(200)`, NOT NULL)
- `image_url` (`VARCHAR(500)`, NULL)
- `target_type` (`VARCHAR(50)`, NULL)
- `module` (`VARCHAR(20)`, NOT NULL): `'HOME'`, `'FOOD'`, `'RIDE'`, `'MARKETPLACE'`
- `sort_order` (`INT`, NOT NULL, DEFAULT 0)
- `is_active` (`BOOLEAN`, NOT NULL, DEFAULT TRUE)

#### `reviews`
- `id` (`BIGINT`, PK)
- `user_id` (`BIGINT`, FK `users.id`, ON DELETE CASCADE)
- `target_type` (`VARCHAR(20)`, NOT NULL): `'RESTAURANT'`, `'DRIVER'`, `'LISTING'`
- `target_id` (`BIGINT`, NOT NULL)
- `rating` (`INT`, NOT NULL, CHECK: 1 to 5)
- `comment` (`TEXT`, NULL)

#### `payments`
- `id` (`BIGINT`, PK)
- `user_id` (`BIGINT`, FK `users.id`, ON DELETE RESTRICT)
- `module` (`VARCHAR(20)`, NOT NULL): `'FOOD'`, `'RIDE'`
- `order_id` (`BIGINT`, NOT NULL)
- `amount` (`DECIMAL(10,2)`, NOT NULL)
- `payment_method` (`VARCHAR(20)`, NOT NULL): `'COD'`, `'UPI'`, `'CARD'`, `'WALLET'`
- `transaction_id` (`VARCHAR(100)`, NULL)
- `status` (`VARCHAR(20)`, NOT NULL, DEFAULT `'PENDING'`): `'PENDING'`, `'COMPLETED'`, `'FAILED'`, `'REFUNDED'`

#### `app_settings`
- `id` (`INT`, PK)
- `setting_key` (`VARCHAR(100)`, NOT NULL, UNIQUE)
- `setting_value` (`TEXT`, NULL)
- `description` (`VARCHAR(255)`, NULL)
