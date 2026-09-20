# SuperApp Database Specification & Architecture

**Target Engine:** Managed PostgreSQL 15+ (Supabase / AWS RDS / Self-Hosted)  
**ORM / Data Layer:** Entity Framework Core 10 (Npgsql.EntityFrameworkCore.PostgreSQL)  
**Total Tables:** 28 Active Relational Tables  
**Status:** Canonical Production Specification  

---

## 1. Relational Entity Architecture

The database enforces a unified relational contract across all 5 operational modules: Identity & Access Management, Food Delivery, Fleet Rides, Community Marketplace, and Device Notifications.

```
users
  ├── user_roles (CASCADE) ──────────> roles
  ├── addresses (CASCADE)
  ├── restaurant_users (CASCADE) ─────> restaurants
  │                                       ├── restaurant_categories (CASCADE) ─> food_items (CASCADE)
  │                                       │                                        ├── food_item_variants (CASCADE)
  │                                       │                                        └── food_item_addons (CASCADE)
  │                                       └── food_orders (RESTRICT)
  ├── drivers (CASCADE) ──────────────> vehicles (CASCADE)
  │     └── rides (RESTRICT)
  ├── marketplace_listings (RESTRICT) ─> listing_images (CASCADE)
  ├── favorites (CASCADE)
  ├── reviews (CASCADE)
  ├── notifications (CASCADE)
  ├── user_device_tokens (CASCADE)
  └── payments (RESTRICT)
```

---

## 2. Global Entity & Schema Conventions

1. **Naming Standard**: All table and column names strictly adhere to PostgreSQL `snake_case`.
2. **Primary Keys**:
   - `BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY` for high-velocity transaction entities (`users`, `food_orders`, `rides`, `marketplace_listings`, `payments`).
   - `INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY` for low-velocity catalog entities (`roles`, `marketplace_categories`, `app_settings`).
3. **Timestamps**: All timestamps use `TIMESTAMPTZ` (`timestamp with time zone`) defaulting to `clock_timestamp()` or `NOW()`.
4. **Historical Preservation**: Destructive cascading deletions are disabled on core financial and transactional records (`food_orders`, `rides`, `payments`) using `ON DELETE RESTRICT`. User soft-deletion is enforced via `is_active = FALSE`.
5. **No Destructive Resets**: Under no circumstances should destructive commands (`DROP SCHEMA public CASCADE`, `DROP DATABASE`) be run on staging or production. All schema evolutions must be non-destructive migrations.

---

## 3. Catalog of the 28 Verified Tables

### 3.1 Identity & Access Management (5 Tables)

#### `roles`
System authorization roles master catalog.
- `id` (`INT`, PK): 1 = `CUSTOMER`, 2 = `ADMIN`, 3 = `DRIVER`, 4 = `RESTAURANT_OWNER`, 5 = `MARKETPLACE_SELLER`
- `name` (`VARCHAR(50)`, UNIQUE, NOT NULL)
- `description` (`VARCHAR(255)`, NULL)
- `is_active` (`BOOLEAN`, NOT NULL, DEFAULT TRUE)
- `created_at` (`TIMESTAMPTZ`, NOT NULL, DEFAULT NOW())

#### `users`
Central user identity entity across all modules.
- `id` (`BIGINT`, PK)
- `mobile_number` (`VARCHAR(15)`, UNIQUE, NOT NULL): Primary login identifier (+91 format).
- `full_name` (`VARCHAR(100)`, NULL)
- `email` (`VARCHAR(255)`, UNIQUE, NULL)
- `profile_image_url` (`VARCHAR(500)`, NULL)
- `password_hash` (`VARCHAR(255)`, NULL): BCrypt hash for administrative login; NULL for OTP-only citizens.
- `is_active` (`BOOLEAN`, NOT NULL, DEFAULT TRUE): Soft-delete / account lock toggle.
- `created_at` (`TIMESTAMPTZ`, NOT NULL, DEFAULT NOW())
- `last_login_at` (`TIMESTAMPTZ`, NULL)

#### `user_roles`
Many-to-many user-role assignment table supporting unified multi-role accounts.
- `id` (`BIGINT`, PK)
- `user_id` (`BIGINT`, FK `users.id`, ON DELETE CASCADE, NOT NULL)
- `role_id` (`INT`, FK `roles.id`, ON DELETE CASCADE, NOT NULL)
- `created_at` (`TIMESTAMPTZ`, NOT NULL, DEFAULT NOW())
- **Constraint**: `UNIQUE (user_id, role_id)`

#### `otp_requests`
Audit log and verification state machine for SMS OTP authentication.
- `id` (`BIGINT`, PK)
- `mobile_number` (`VARCHAR(15)`, NOT NULL)
- `otp_code` (`VARCHAR(10)`, NOT NULL)
- `purpose` (`VARCHAR(50)`, NOT NULL, DEFAULT 'LOGIN')
- `is_used` (`BOOLEAN`, NOT NULL, DEFAULT FALSE)
- `attempt_count` (`INT`, NOT NULL, DEFAULT 0)
- `expires_at` (`TIMESTAMPTZ`, NOT NULL)
- `created_at` (`TIMESTAMPTZ`, NOT NULL, DEFAULT NOW())

#### `addresses`
Saved customer delivery and pickup addresses.
- `id` (`BIGINT`, PK)
- `user_id` (`BIGINT`, FK `users.id`, ON DELETE CASCADE, NOT NULL)
- `label` (`VARCHAR(50)`, NULL): `'Home'`, `'Work'`, `'Other'`
- `address_line1` (`VARCHAR(255)`, NOT NULL)
- `address_line2` (`VARCHAR(255)`, NULL)
- `landmark` (`VARCHAR(255)`, NULL)
- `city` (`VARCHAR(100)`, NOT NULL)
- `state` (`VARCHAR(100)`, NULL)
- `postal_code` (`VARCHAR(20)`, NULL)
- `latitude` (`NUMERIC(10,8)`, NOT NULL)
- `longitude` (`NUMERIC(11,8)`, NOT NULL)
- `is_default` (`BOOLEAN`, NOT NULL, DEFAULT FALSE)
- `is_active` (`BOOLEAN`, NOT NULL, DEFAULT TRUE)
- `created_at` (`TIMESTAMPTZ`, NOT NULL, DEFAULT NOW())

---

### 3.2 Food Ordering & Restaurant Management (8 Tables)

#### `restaurants`
Merchant food establishment profile and business rules.
- `id` (`BIGINT`, PK)
- `name` (`VARCHAR(150)`, NOT NULL)
- `description` (`TEXT`, NULL)
- `image_url` (`VARCHAR(500)`, NULL)
- `phone` (`VARCHAR(20)`, NULL)
- `address_line` (`VARCHAR(255)`, NOT NULL)
- `city` (`VARCHAR(100)`, NOT NULL, DEFAULT 'Bengaluru')
- `latitude` (`NUMERIC(10,8)`, NOT NULL, DEFAULT 12.9716)
- `longitude` (`NUMERIC(11,8)`, NOT NULL, DEFAULT 77.5946)
- `rating` (`NUMERIC(3,2)`, NOT NULL, DEFAULT 4.50)
- `total_ratings` (`INT`, NOT NULL, DEFAULT 0)
- `is_veg` (`BOOLEAN`, NOT NULL, DEFAULT FALSE)
- `opening_time` (`TIME`, NOT NULL, DEFAULT '09:00:00')
- `closing_time` (`TIME`, NOT NULL, DEFAULT '23:00:00')
- `min_order_amount` (`NUMERIC(10,2)`, NOT NULL, DEFAULT 100.00)
- `delivery_fee` (`NUMERIC(10,2)`, NOT NULL, DEFAULT 25.00)
- `avg_delivery_time_minutes` (`INT`, NOT NULL, DEFAULT 30)
- `is_active` (`BOOLEAN`, NOT NULL, DEFAULT TRUE)
- `is_featured` (`BOOLEAN`, NOT NULL, DEFAULT FALSE)
- `created_at` (`TIMESTAMPTZ`, NOT NULL, DEFAULT NOW())
- `updated_at` (`TIMESTAMPTZ`, NULL)

#### `restaurant_users`
Authorization mapping linking user accounts to managed restaurants.
- `id` (`BIGINT`, PK)
- `restaurant_id` (`BIGINT`, FK `restaurants.id`, ON DELETE CASCADE, NOT NULL)
- `user_id` (`BIGINT`, FK `users.id`, ON DELETE CASCADE, NOT NULL)
- `is_active` (`BOOLEAN`, NOT NULL, DEFAULT TRUE)
- `created_at` (`TIMESTAMPTZ`, NOT NULL, DEFAULT NOW())
- **Constraint**: `UNIQUE (restaurant_id, user_id)`

#### `restaurant_categories`
Menu categories defined per restaurant.
- `id` (`BIGINT`, PK)
- `restaurant_id` (`BIGINT`, FK `restaurants.id`, ON DELETE CASCADE, NOT NULL)
- `name` (`VARCHAR(100)`, NOT NULL)
- `description` (`VARCHAR(255)`, NULL)
- `sort_order` (`INT`, NOT NULL, DEFAULT 0)
- `is_active` (`BOOLEAN`, NOT NULL, DEFAULT TRUE)
- `created_at` (`TIMESTAMPTZ`, NOT NULL, DEFAULT NOW())

#### `food_items`
Dishes and culinary products available for ordering.
- `id` (`BIGINT`, PK)
- `restaurant_id` (`BIGINT`, FK `restaurants.id`, ON DELETE CASCADE, NOT NULL)
- `restaurant_category_id` (`BIGINT`, FK `restaurant_categories.id`, ON DELETE CASCADE, NOT NULL)
- `name` (`VARCHAR(150)`, NOT NULL)
- `description` (`TEXT`, NULL)
- `image_url` (`VARCHAR(500)`, NULL)
- `base_price` (`NUMERIC(10,2)`, NOT NULL)
- `discount_percent` (`NUMERIC(5,2)`, NOT NULL, DEFAULT 0.00)
- `discounted_price` (`NUMERIC(10,2)`, NOT NULL)
- `is_veg` (`BOOLEAN`, NOT NULL, DEFAULT TRUE)
- `is_available` (`BOOLEAN`, NOT NULL, DEFAULT TRUE)
- `is_bestseller` (`BOOLEAN`, NOT NULL, DEFAULT FALSE)
- `is_customizable` (`BOOLEAN`, NOT NULL, DEFAULT FALSE)
- `sort_order` (`INT`, NOT NULL, DEFAULT 0)
- `is_active` (`BOOLEAN`, NOT NULL, DEFAULT TRUE)
- `created_at` (`TIMESTAMPTZ`, NOT NULL, DEFAULT NOW())

#### `food_item_variants`
Portion sizing and variation options for customizable dishes.
- `id` (`BIGINT`, PK)
- `food_item_id` (`BIGINT`, FK `food_items.id`, ON DELETE CASCADE, NOT NULL)
- `name` (`VARCHAR(100)`, NOT NULL)
- `additional_price` (`NUMERIC(10,2)`, NOT NULL, DEFAULT 0.00)
- `is_default` (`BOOLEAN`, NOT NULL, DEFAULT FALSE)
- `sort_order` (`INT`, NOT NULL, DEFAULT 0)
- `is_active` (`BOOLEAN`, NOT NULL, DEFAULT TRUE)
- `created_at` (`TIMESTAMPTZ`, NOT NULL, DEFAULT NOW())

#### `food_item_addons`
Addon items and toppings available for menu dishes.
- `id` (`BIGINT`, PK)
- `food_item_id` (`BIGINT`, FK `food_items.id`, ON DELETE CASCADE, NOT NULL)
- `group_name` (`VARCHAR(100)`, NOT NULL, DEFAULT 'ADD-ONS')
- `name` (`VARCHAR(100)`, NOT NULL)
- `price` (`NUMERIC(10,2)`, NOT NULL, DEFAULT 0.00)
- `is_default` (`BOOLEAN`, NOT NULL, DEFAULT FALSE)
- `sort_order` (`INT`, NOT NULL, DEFAULT 0)
- `is_active` (`BOOLEAN`, NOT NULL, DEFAULT TRUE)
- `created_at` (`TIMESTAMPTZ`, NOT NULL, DEFAULT NOW())

#### `food_orders`
Food delivery order lifecycle and financial records.
- `id` (`BIGINT`, PK)
- `order_number` (`VARCHAR(30)`, UNIQUE, NOT NULL)
- `user_id` (`BIGINT`, FK `users.id`, ON DELETE RESTRICT, NOT NULL)
- `restaurant_id` (`BIGINT`, FK `restaurants.id`, ON DELETE RESTRICT, NOT NULL)
- `address_id` (`BIGINT`, FK `addresses.id`, ON DELETE RESTRICT, NOT NULL)
- `coupon_id` (`BIGINT`, FK `coupons.id`, ON DELETE SET NULL, NULL)
- `sub_total` (`NUMERIC(10,2)`, NOT NULL)
- `discount_amount` (`NUMERIC(10,2)`, NOT NULL, DEFAULT 0.00)
- `coupon_discount` (`NUMERIC(10,2)`, NOT NULL, DEFAULT 0.00)
- `delivery_fee` (`NUMERIC(10,2)`, NOT NULL, DEFAULT 0.00)
- `tax_amount` (`NUMERIC(10,2)`, NOT NULL, DEFAULT 0.00)
- `grand_total` (`NUMERIC(10,2)`, NOT NULL)
- `payment_method` (`VARCHAR(30)`, NOT NULL, DEFAULT 'CASH')
- `payment_status` (`VARCHAR(30)`, NOT NULL, DEFAULT 'PENDING')
- `status` (`VARCHAR(30)`, NOT NULL, DEFAULT 'PENDING')
  - Valid: `'PENDING'`, `'ACCEPTED'`, `'PREPARING'`, `'READY'`, `'PICKED_UP'`, `'DELIVERED'`, `'CANCELLED'`
- `notes` (`TEXT`, NULL)
- `estimated_delivery_minutes` (`INT`, NOT NULL, DEFAULT 35)
- `delivered_at` (`TIMESTAMPTZ`, NULL)
- `created_at` (`TIMESTAMPTZ`, NOT NULL, DEFAULT NOW())

#### `food_order_items`
Line items attached to food delivery orders.
- `id` (`BIGINT`, PK)
- `food_order_id` (`BIGINT`, FK `food_orders.id`, ON DELETE CASCADE, NOT NULL)
- `food_item_id` (`BIGINT`, FK `food_items.id`, ON DELETE RESTRICT, NOT NULL)
- `item_name` (`VARCHAR(150)`, NOT NULL)
- `unit_price` (`NUMERIC(10,2)`, NOT NULL)
- `quantity` (`INT`, NOT NULL, DEFAULT 1)
- `variant_name` (`VARCHAR(100)`, NULL)
- `variant_price` (`NUMERIC(10,2)`, NOT NULL, DEFAULT 0.00)
- `addons_json` (`TEXT`, NULL)
- `total_price` (`NUMERIC(10,2)`, NOT NULL)
- `created_at` (`TIMESTAMPTZ`, NOT NULL, DEFAULT NOW())

---

### 3.3 Rides & Fleet Dispatch (3 Tables)

#### `vehicles`
Registered vehicles assigned to driver partners.
- `id` (`BIGINT`, PK)
- `vehicle_type` (`VARCHAR(30)`, NOT NULL): `'BIKE'`, `'AUTO'`, `'CAB'`
- `plate_number` (`VARCHAR(20)`, UNIQUE, NOT NULL)
- `model` (`VARCHAR(100)`, NOT NULL)
- `color` (`VARCHAR(50)`, NULL)
- `capacity` (`INT`, NOT NULL, DEFAULT 1)
- `year` (`INT`, NULL)
- `rc_number` (`VARCHAR(50)`, NULL)
- `insurance_expiry` (`DATE`, NULL)
- `is_active` (`BOOLEAN`, NOT NULL, DEFAULT TRUE)
- `created_at` (`TIMESTAMPTZ`, NOT NULL, DEFAULT NOW())

#### `drivers`
Operational profile, online duty toggle, and GPS telemetry for drivers.
- `id` (`BIGINT`, PK)
- `user_id` (`BIGINT`, FK `users.id`, ON DELETE CASCADE, UNIQUE, NOT NULL)
- `vehicle_id` (`BIGINT`, FK `vehicles.id`, ON DELETE SET NULL, NULL)
- `license_number` (`VARCHAR(50)`, NULL)
- `current_latitude` (`NUMERIC(10,8)`, NULL)
- `current_longitude` (`NUMERIC(11,8)`, NULL)
- `is_online` (`BOOLEAN`, NOT NULL, DEFAULT FALSE)
- `is_verified` (`BOOLEAN`, NOT NULL, DEFAULT FALSE)
- `rating` (`NUMERIC(3,2)`, NOT NULL, DEFAULT 5.00)
- `total_rides` (`INT`, NOT NULL, DEFAULT 0)
- `is_active` (`BOOLEAN`, NOT NULL, DEFAULT TRUE)
- `created_at` (`TIMESTAMPTZ`, NOT NULL, DEFAULT NOW())

#### `rides`
Ride dispatch, passenger OTP handshake, route telemetry, and fare records.
- `id` (`BIGINT`, PK)
- `ride_number` (`VARCHAR(30)`, UNIQUE, NOT NULL)
- `user_id` (`BIGINT`, FK `users.id`, ON DELETE RESTRICT, NOT NULL)
- `driver_id` (`BIGINT`, FK `drivers.id`, ON DELETE RESTRICT, NULL)
- `vehicle_id` (`BIGINT`, FK `vehicles.id`, ON DELETE RESTRICT, NULL)
- `pickup_address` (`VARCHAR(255)`, NOT NULL)
- `pickup_latitude` (`NUMERIC(10,8)`, NOT NULL)
- `pickup_longitude` (`NUMERIC(11,8)`, NOT NULL)
- `drop_address` (`VARCHAR(255)`, NOT NULL)
- `drop_latitude` (`NUMERIC(10,8)`, NOT NULL)
- `drop_longitude` (`NUMERIC(11,8)`, NOT NULL)
- `distance_km` (`NUMERIC(8,2)`, NOT NULL, DEFAULT 0.00)
- `duration_minutes` (`INT`, NOT NULL, DEFAULT 0)
- `vehicle_type` (`VARCHAR(30)`, NOT NULL, DEFAULT 'CAB')
- `estimated_fare` (`NUMERIC(10,2)`, NOT NULL)
- `actual_fare` (`NUMERIC(10,2)`, NULL)
- `status` (`VARCHAR(30)`, NOT NULL, DEFAULT 'REQUESTED')
  - Valid: `'SEARCHING'`, `'REQUESTED'`, `'ASSIGNED'`, `'ACCEPTED'`, `'ARRIVING'`, `'STARTED'`, `'COMPLETED'`, `'CANCELLED'`
- `otp_code` (`VARCHAR(10)`, NOT NULL)
- `payment_method` (`VARCHAR(30)`, NOT NULL, DEFAULT 'CASH')
- `payment_status` (`VARCHAR(30)`, NOT NULL, DEFAULT 'PENDING')
- `cancellation_reason` (`VARCHAR(255)`, NULL)
- `started_at` (`TIMESTAMPTZ`, NULL)
- `completed_at` (`TIMESTAMPTZ`, NULL)
- `created_at` (`TIMESTAMPTZ`, NOT NULL, DEFAULT NOW())

---

### 3.4 Community Marketplace (3 Tables)

#### `marketplace_categories`
Classification hierarchy for pre-owned community ads.
- `id` (`INT`, PK)
- `name` (`VARCHAR(100)`, UNIQUE, NOT NULL)
- `icon_name` (`VARCHAR(50)`, NULL)
- `sort_order` (`INT`, NOT NULL, DEFAULT 0)
- `is_active` (`BOOLEAN`, NOT NULL, DEFAULT TRUE)
- `created_at` (`TIMESTAMPTZ`, NOT NULL, DEFAULT NOW())

#### `marketplace_listings`
Peer-to-peer classified ads and used goods listings.
- `id` (`BIGINT`, PK)
- `user_id` (`BIGINT`, FK `users.id`, ON DELETE RESTRICT, NOT NULL)
- `category_id` (`INT`, FK `marketplace_categories.id`, ON DELETE RESTRICT, NOT NULL)
- `title` (`VARCHAR(150)`, NOT NULL)
- `description` (`TEXT`, NOT NULL)
- `price` (`NUMERIC(10,2)`, NOT NULL)
- `condition` (`VARCHAR(30)`, NOT NULL): `'BRAND_NEW'`, `'LIKE_NEW'`, `'GENTLY_USED'`, `'HEAVILY_USED'`
- `location` (`VARCHAR(255)`, NOT NULL)
- `latitude` (`NUMERIC(10,8)`, NULL)
- `longitude` (`NUMERIC(11,8)`, NULL)
- `is_featured` (`BOOLEAN`, NOT NULL, DEFAULT FALSE)
- `status` (`VARCHAR(30)`, NOT NULL, DEFAULT 'ACTIVE')
  - Valid: `'ACTIVE'`, `'SOLD'`, `'EXPIRED'`, `'REMOVED'`, `'FLAGGED'`
- `view_count` (`INT`, NOT NULL, DEFAULT 0)
- `is_active` (`BOOLEAN`, NOT NULL, DEFAULT TRUE)
- `created_at` (`TIMESTAMPTZ`, NOT NULL, DEFAULT NOW())
- `updated_at` (`TIMESTAMPTZ`, NULL)

#### `listing_images`
Image attachments for marketplace classifieds.
- `id` (`BIGINT`, PK)
- `listing_id` (`BIGINT`, FK `marketplace_listings.id`, ON DELETE CASCADE, NOT NULL)
- `image_url` (`VARCHAR(500)`, NOT NULL)
- `is_primary` (`BOOLEAN`, NOT NULL, DEFAULT FALSE)
- `created_at` (`TIMESTAMPTZ`, NOT NULL, DEFAULT NOW())

---

### 3.5 Marketing, Financials & Engagement (5 Tables)

#### `coupons`
Discount codes and promotional rules.
- `id` (`BIGINT`, PK)
- `code` (`VARCHAR(50)`, UNIQUE, NOT NULL)
- `description` (`VARCHAR(255)`, NULL)
- `discount_type` (`VARCHAR(20)`, NOT NULL): `'PERCENTAGE'`, `'FLAT'`
- `discount_value` (`NUMERIC(10,2)`, NOT NULL)
- `min_order_amount` (`NUMERIC(10,2)`, NOT NULL, DEFAULT 0.00)
- `max_discount_amount` (`NUMERIC(10,2)`, NULL)
- `usage_limit_per_user` (`INT`, NOT NULL, DEFAULT 1)
- `total_usage_limit` (`INT`, NULL)
- `total_used_count` (`INT`, NOT NULL, DEFAULT 0)
- `valid_from` (`TIMESTAMPTZ`, NOT NULL)
- `valid_to` (`TIMESTAMPTZ`, NOT NULL)
- `applicable_module` (`VARCHAR(30)`, NOT NULL, DEFAULT 'FOOD'): `'FOOD'`, `'RIDE'`, `'ALL'`
- `is_active` (`BOOLEAN`, NOT NULL, DEFAULT TRUE)
- `created_at` (`TIMESTAMPTZ`, NOT NULL, DEFAULT NOW())

#### `coupon_usages`
Audit trail of per-user coupon redemption.
- `id` (`BIGINT`, PK)
- `coupon_id` (`BIGINT`, FK `coupons.id`, ON DELETE CASCADE, NOT NULL)
- `user_id` (`BIGINT`, FK `users.id`, ON DELETE CASCADE, NOT NULL)
- `order_id` (`BIGINT`, NULL)
- `discount_amount` (`NUMERIC(10,2)`, NOT NULL)
- `used_at` (`TIMESTAMPTZ`, NOT NULL, DEFAULT NOW())

#### `banners`
Promotional flash deal banners rendered on Home, Food, and Marketplace screens.
- `id` (`BIGINT`, PK)
- `title` (`VARCHAR(150)`, NOT NULL)
- `image_url` (`VARCHAR(500)`, NOT NULL)
- `action_type` (`VARCHAR(50)`, NULL): `'NAVIGATE'`, `'EXTERNAL_URL'`
- `action_value` (`VARCHAR(255)`, NULL)
- `display_order` (`INT`, NOT NULL, DEFAULT 0)
- `target_screen` (`VARCHAR(50)`, NOT NULL, DEFAULT 'HOME')
- `valid_from` (`TIMESTAMPTZ`, NOT NULL)
- `valid_to` (`TIMESTAMPTZ`, NOT NULL)
- `is_active` (`BOOLEAN`, NOT NULL, DEFAULT TRUE)
- `created_at` (`TIMESTAMPTZ`, NOT NULL, DEFAULT NOW())

#### `reviews`
Ratings and text feedback submitted for restaurants and driver partners.
- `id` (`BIGINT`, PK)
- `user_id` (`BIGINT`, FK `users.id`, ON DELETE CASCADE, NOT NULL)
- `target_type` (`VARCHAR(30)`, NOT NULL): `'RESTAURANT'`, `'DRIVER'`
- `target_id` (`BIGINT`, NOT NULL)
- `rating` (`INT`, NOT NULL): Check `1 <= rating <= 5`
- `comment` (`TEXT`, NULL)
- `created_at` (`TIMESTAMPTZ`, NOT NULL, DEFAULT NOW())

#### `favorites`
Saved bookmarks for favorite restaurants and marketplace items.
- `id` (`BIGINT`, PK)
- `user_id` (`BIGINT`, FK `users.id`, ON DELETE CASCADE, NOT NULL)
- `target_type` (`VARCHAR(30)`, NOT NULL): `'RESTAURANT'`, `'MARKETPLACE'`
- `target_id` (`BIGINT`, NOT NULL)
- `created_at` (`TIMESTAMPTZ`, NOT NULL, DEFAULT NOW())
- **Constraint**: `UNIQUE (user_id, target_type, target_id)`

---

### 3.6 Payments, System & Notifications (4 Tables)

#### `payments`
Unified payment audit log supporting Easebuzz payment orders, transaction tokens, and refunds.
- `id` (`BIGINT`, PK)
- `transaction_id` (`VARCHAR(100)`, UNIQUE, NOT NULL)
- `order_id` (`VARCHAR(100)`, NOT NULL)
- `user_id` (`BIGINT`, FK `users.id`, ON DELETE RESTRICT, NOT NULL)
- `module` (`VARCHAR(30)`, NOT NULL): `'FOOD'`, `'RIDE'`, `'MARKETPLACE'`, `'WALLET'`, `'GENERAL'`
- `amount` (`NUMERIC(10,2)`, NOT NULL)
- `currency` (`VARCHAR(10)`, NOT NULL, DEFAULT 'INR')
- `provider` (`VARCHAR(50)`, NOT NULL, DEFAULT 'Easebuzz')
- `status` (`VARCHAR(30)`, NOT NULL, DEFAULT 'PENDING')
- `created_at` (`TIMESTAMPTZ`, NOT NULL, DEFAULT NOW())

#### `notifications`
In-app user notifications and broadcast system alerts.
- `id` (`BIGINT`, PK)
- `user_id` (`BIGINT`, FK `users.id`, ON DELETE CASCADE, NOT NULL)
- `title` (`VARCHAR(150)`, NOT NULL)
- `body` (`TEXT`, NOT NULL)
- `type` (`VARCHAR(50)`, NOT NULL, DEFAULT 'GENERAL')
- `data_json` (`TEXT`, NULL)
- `is_read` (`BOOLEAN`, NOT NULL, DEFAULT FALSE)
- `created_at` (`TIMESTAMPTZ`, NOT NULL, DEFAULT NOW())

#### `user_device_tokens`
Expo push notification hardware tokens for mobile alerts.
- `id` (`BIGINT`, PK)
- `user_id` (`BIGINT`, FK `users.id`, ON DELETE CASCADE, NOT NULL)
- `device_token` (`VARCHAR(255)`, NOT NULL)
- `device_platform` (`VARCHAR(20)`, NOT NULL): `'ANDROID'`, `'IOS'`, `'WEB'`
- `is_active` (`BOOLEAN`, NOT NULL, DEFAULT TRUE)
- `created_at` (`TIMESTAMPTZ`, NOT NULL, DEFAULT NOW())
- `updated_at` (`TIMESTAMPTZ`, NULL)
- **Constraint**: `UNIQUE (user_id, device_token)`

#### `app_settings`
System-wide global parameters, commission percentages, and helpline configurations managed via Web Admin.
- `id` (`INT`, PK)
- `setting_key` (`VARCHAR(100)`, UNIQUE, NOT NULL)
- `setting_value` (`TEXT`, NOT NULL)
- `description` (`VARCHAR(255)`, NULL)
- `updated_at` (`TIMESTAMPTZ`, NOT NULL, DEFAULT NOW())

---

## 4. Applied Schema Enhancements & Foreign Key Indexing

To prevent table-level locking during high-concurrency order placement and dispatch operations, foreign key indexes and check constraint enhancements are maintained in `database/migrations/20260919_schema_audit_enhancements.sql`:

```sql
-- High-concurrency query optimization indexes
CREATE INDEX IF NOT EXISTS ix_food_orders_address_id ON food_orders(address_id);
CREATE INDEX IF NOT EXISTS ix_food_orders_coupon_id ON food_orders(coupon_id);
CREATE INDEX IF NOT EXISTS ix_food_order_items_food_item_id ON food_order_items(food_item_id);
CREATE INDEX IF NOT EXISTS ix_rides_vehicle_id ON rides(vehicle_id);

-- Check constraints for valid business logic statuses
ALTER TABLE marketplace_listings DROP CONSTRAINT IF EXISTS chk_marketplace_listings_status;
ALTER TABLE marketplace_listings ADD CONSTRAINT chk_marketplace_listings_status 
  CHECK (status IN ('ACTIVE', 'SOLD', 'EXPIRED', 'REMOVED', 'FLAGGED'));

ALTER TABLE rides DROP CONSTRAINT IF EXISTS chk_rides_status;
ALTER TABLE rides ADD CONSTRAINT chk_rides_status 
  CHECK (status IN ('SEARCHING', 'REQUESTED', 'ASSIGNED', 'ACCEPTED', 'ARRIVING', 'STARTED', 'COMPLETED', 'CANCELLED'));

ALTER TABLE payments DROP CONSTRAINT IF EXISTS chk_payments_module;
ALTER TABLE payments ADD CONSTRAINT chk_payments_module 
  CHECK (module IN ('FOOD', 'RIDE', 'MARKETPLACE', 'WALLET', 'GENERAL'));
```

---

## 5. Seed Data & Test Credentials

The database is provisioned with non-destructive initial fixtures:
- **Admin Account**: Mobile `9999999999`, Password `Admin@123`, Roles `ADMIN`, `CUSTOMER`.
- **Multi-Role Test Account**: Mobile `6375002348` / `9876543210`, Roles `CUSTOMER`, `DRIVER`, `RESTAURANT_OWNER`, `MARKETPLACE_SELLER`.
- **Primary Assigned Restaurant**: `Meghana Foods (Special Biryani)` (ID `1`, `is_active = true`), mapped to user `6375002348` via `restaurant_users`.
- **Driver Profile**: Driver linked to vehicle `Splendor Plus` (`KA-01-EQ-9876`).
