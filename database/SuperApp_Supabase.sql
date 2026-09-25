-- ==============================================================================
-- SuperApp Database Schema for Supabase (PostgreSQL 15+)
-- Platform: Supabase / PostgreSQL
-- Generated: September 2026
-- Description: Complete idempotent relational database schema for SuperApp
-- Domains: Identity & Auth, Restaurants & Food, Rides & Transport,
--          Marketplace & Bazaar, Notifications & Push Tokens, Common Services
--
-- EXECUTION:
--   MANUAL EXECUTION ONLY.
--   Run this entire script inside the Supabase SQL Editor.
--   Do NOT execute automatically from unverified automated agents.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 00. EXTENSIONS & PREREQUISITES
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 01. DOMAIN: IDENTITY & ACCESS MANAGEMENT
-- ------------------------------------------------------------------------------

-- 1. Roles
CREATE TABLE IF NOT EXISTS roles (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    description VARCHAR(255) NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_roles_name UNIQUE (name)
);

-- 2. Users (Central Identity)
CREATE TABLE IF NOT EXISTS users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    mobile_number VARCHAR(15) NOT NULL,
    full_name VARCHAR(100) NULL,
    email VARCHAR(255) NULL,
    profile_image_url VARCHAR(500) NULL,
    password_hash VARCHAR(255) NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NULL,
    last_login_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_users_mobile_number UNIQUE (mobile_number)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users (email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users (is_active);

-- 3. User Roles (Many-to-Many Identity Mapping)
CREATE TABLE IF NOT EXISTS user_roles (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL,
    role_id INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT fk_user_roles_users FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_roles_roles FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    CONSTRAINT uq_user_roles_user_role UNIQUE (user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles (role_id);

-- 4. OTP Requests (Phone Verification & Audit)
CREATE TABLE IF NOT EXISTS otp_requests (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    mobile_number VARCHAR(15) NOT NULL,
    otp_code VARCHAR(10) NOT NULL,
    purpose VARCHAR(50) NOT NULL DEFAULT 'LOGIN',
    is_used BOOLEAN NOT NULL DEFAULT FALSE,
    attempt_count INT NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_otp_requests_lookup ON otp_requests (mobile_number, expires_at);
CREATE INDEX IF NOT EXISTS idx_otp_requests_expires_at ON otp_requests (expires_at);

-- 5. User Addresses
CREATE TABLE IF NOT EXISTS addresses (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL,
    label VARCHAR(50) NULL, -- 'Home', 'Work', 'Other'
    address_line1 VARCHAR(255) NOT NULL,
    address_line2 VARCHAR(255) NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    pin_code VARCHAR(10) NOT NULL,
    latitude DECIMAL(10, 7) NULL,
    longitude DECIMAL(10, 7) NULL,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NULL,
    CONSTRAINT fk_addresses_users FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON addresses (user_id);
CREATE INDEX IF NOT EXISTS idx_addresses_city ON addresses (city);

-- ------------------------------------------------------------------------------
-- 02. DOMAIN: RESTAURANTS & FOOD ORDERING
-- ------------------------------------------------------------------------------

-- 6. Restaurants
CREATE TABLE IF NOT EXISTS restaurants (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT NULL,
    image_url VARCHAR(500) NULL,
    phone VARCHAR(15) NULL,
    email VARCHAR(255) NULL,
    address_line VARCHAR(500) NULL,
    city VARCHAR(100) NULL,
    latitude DECIMAL(10, 7) NULL,
    longitude DECIMAL(10, 7) NULL,
    rating DECIMAL(3, 2) NOT NULL DEFAULT 0.00,
    total_ratings INT NOT NULL DEFAULT 0,
    is_veg BOOLEAN NOT NULL DEFAULT FALSE,
    opening_time TIME NULL,
    closing_time TIME NULL,
    min_order_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    delivery_fee DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    avg_delivery_time_minutes INT NOT NULL DEFAULT 30,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_restaurants_city_active ON restaurants (city, is_active);
CREATE INDEX IF NOT EXISTS idx_restaurants_featured ON restaurants (is_featured) WHERE is_featured = TRUE;
CREATE INDEX IF NOT EXISTS idx_restaurants_rating ON restaurants (rating DESC);

-- 7. Restaurant Users (Ownership / Management Link)
CREATE TABLE IF NOT EXISTS restaurant_users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    restaurant_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT fk_restaurant_users_restaurants FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    CONSTRAINT fk_restaurant_users_users FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT uq_restaurant_users_pair UNIQUE (restaurant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_restaurant_users_user_id ON restaurant_users (user_id);

-- 8. Restaurant Categories (Menu Groups)
CREATE TABLE IF NOT EXISTS restaurant_categories (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    restaurant_id BIGINT NOT NULL,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(255) NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NULL,
    CONSTRAINT fk_restaurant_categories_restaurants FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_restaurant_categories_restaurant ON restaurant_categories (restaurant_id, sort_order);

-- 9. Food Items (Menu Dishes)
CREATE TABLE IF NOT EXISTS food_items (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    restaurant_id BIGINT NOT NULL,
    restaurant_category_id BIGINT NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT NULL,
    image_url VARCHAR(500) NULL,
    base_price DECIMAL(10, 2) NOT NULL,
    discount_percent DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    is_veg BOOLEAN NOT NULL DEFAULT TRUE,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    is_bestseller BOOLEAN NOT NULL DEFAULT FALSE,
    is_customizable BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NULL,
    CONSTRAINT fk_food_items_restaurants FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE RESTRICT,
    CONSTRAINT fk_food_items_categories FOREIGN KEY (restaurant_category_id) REFERENCES restaurant_categories(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_food_items_restaurant_available ON food_items (restaurant_id, is_available);
CREATE INDEX IF NOT EXISTS idx_food_items_category ON food_items (restaurant_category_id);

-- 10. Food Item Variants (Portion Sizes)
CREATE TABLE IF NOT EXISTS food_item_variants (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    food_item_id BIGINT NOT NULL,
    name VARCHAR(200) NOT NULL,
    additional_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT fk_food_item_variants_items FOREIGN KEY (food_item_id) REFERENCES food_items(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_food_item_variants_item ON food_item_variants (food_item_id);

-- 11. Food Item Add-ons
CREATE TABLE IF NOT EXISTS food_item_addons (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    food_item_id BIGINT NOT NULL,
    group_name VARCHAR(100) NOT NULL,
    name VARCHAR(200) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT fk_food_item_addons_items FOREIGN KEY (food_item_id) REFERENCES food_items(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_food_item_addons_item ON food_item_addons (food_item_id);

-- 12. Coupons & Discounts
CREATE TABLE IF NOT EXISTS coupons (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code VARCHAR(20) NOT NULL,
    description VARCHAR(255) NULL,
    discount_type VARCHAR(20) NOT NULL DEFAULT 'PERCENTAGE',
    discount_value DECIMAL(10, 2) NOT NULL,
    min_order_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    max_discount DECIMAL(10, 2) NULL,
    start_date TIMESTAMPTZ NOT NULL,
    expiry_date TIMESTAMPTZ NOT NULL,
    total_usage_limit INT NULL,
    per_user_limit INT NOT NULL DEFAULT 1,
    current_usage_count INT NOT NULL DEFAULT 0,
    applicable_module VARCHAR(20) NOT NULL DEFAULT 'FOOD',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_coupons_code UNIQUE (code),
    CONSTRAINT chk_coupons_discount_type CHECK (discount_type IN ('PERCENTAGE', 'FLAT')),
    CONSTRAINT chk_coupons_module CHECK (applicable_module IN ('FOOD', 'RIDE', 'ALL'))
);

CREATE INDEX IF NOT EXISTS idx_coupons_active_dates ON coupons (code, is_active, start_date, expiry_date);

-- 13. Coupon Usages
CREATE TABLE IF NOT EXISTS coupon_usages (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    coupon_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    order_id BIGINT NULL,
    used_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT fk_coupon_usages_coupons FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE CASCADE,
    CONSTRAINT fk_coupon_usages_users FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_coupon_usages_lookup ON coupon_usages (coupon_id, user_id);

-- 14. Food Orders
CREATE TABLE IF NOT EXISTS food_orders (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_number VARCHAR(20) NOT NULL,
    user_id BIGINT NOT NULL,
    restaurant_id BIGINT NOT NULL,
    address_id BIGINT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    sub_total DECIMAL(10, 2) NOT NULL,
    discount_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    coupon_id BIGINT NULL,
    coupon_discount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    delivery_fee DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    tax_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    grand_total DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(20) NULL,
    payment_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    notes TEXT NULL,
    estimated_delivery_minutes INT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_food_orders_order_number UNIQUE (order_number),
    CONSTRAINT fk_food_orders_users FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_food_orders_restaurants FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE RESTRICT,
    CONSTRAINT fk_food_orders_addresses FOREIGN KEY (address_id) REFERENCES addresses(id) ON DELETE SET NULL,
    CONSTRAINT fk_food_orders_coupons FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE SET NULL,
    CONSTRAINT chk_food_orders_status CHECK (status IN ('PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'PICKED_UP', 'DELIVERED', 'CANCELLED'))
);

CREATE INDEX IF NOT EXISTS idx_food_orders_user_created ON food_orders (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_food_orders_restaurant_status ON food_orders (restaurant_id, status);
CREATE INDEX IF NOT EXISTS idx_food_orders_status ON food_orders (status);

-- 15. Food Order Items
CREATE TABLE IF NOT EXISTS food_order_items (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    food_order_id BIGINT NOT NULL,
    food_item_id BIGINT NOT NULL,
    item_name VARCHAR(200) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_price DECIMAL(10, 2) NOT NULL,
    variant_name VARCHAR(200) NULL,
    variant_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    addons_json TEXT NULL,
    total_price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT fk_food_order_items_orders FOREIGN KEY (food_order_id) REFERENCES food_orders(id) ON DELETE CASCADE,
    CONSTRAINT fk_food_order_items_items FOREIGN KEY (food_item_id) REFERENCES food_items(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_food_order_items_order_id ON food_order_items (food_order_id);

-- ------------------------------------------------------------------------------
-- 03. DOMAIN: DRIVERS, VEHICLES & RIDES
-- ------------------------------------------------------------------------------

-- 16. Drivers (Driver Profile & Live State)
CREATE TABLE IF NOT EXISTS drivers (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL,
    license_number VARCHAR(50) NULL,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    is_online BOOLEAN NOT NULL DEFAULT FALSE,
    current_latitude DECIMAL(10, 7) NULL,
    current_longitude DECIMAL(10, 7) NULL,
    rating DECIMAL(3, 2) NOT NULL DEFAULT 0.00,
    total_rides INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_drivers_user_id UNIQUE (user_id),
    CONSTRAINT fk_drivers_users FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_drivers_online_active ON drivers (is_online, is_active) WHERE is_online = TRUE;

-- 17. Vehicles
CREATE TABLE IF NOT EXISTS vehicles (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    driver_id BIGINT NOT NULL,
    type VARCHAR(20) NOT NULL,
    make VARCHAR(100) NULL,
    model VARCHAR(100) NULL,
    year INT NULL,
    registration_number VARCHAR(20) NOT NULL,
    color VARCHAR(50) NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_vehicles_registration UNIQUE (registration_number),
    CONSTRAINT fk_vehicles_drivers FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE,
    CONSTRAINT chk_vehicles_type CHECK (type IN ('BIKE', 'AUTO', 'CAB'))
);

CREATE INDEX IF NOT EXISTS idx_vehicles_driver_id ON vehicles (driver_id);

-- 18. Rides (Booking, Routing & Real-Time Tracking)
CREATE TABLE IF NOT EXISTS rides (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ride_number VARCHAR(20) NOT NULL,
    user_id BIGINT NOT NULL,
    driver_id BIGINT NULL,
    vehicle_id BIGINT NULL,
    vehicle_type VARCHAR(20) NOT NULL,
    pickup_address VARCHAR(500) NOT NULL,
    pickup_latitude DECIMAL(10, 7) NOT NULL,
    pickup_longitude DECIMAL(10, 7) NOT NULL,
    dropoff_address VARCHAR(500) NOT NULL,
    dropoff_latitude DECIMAL(10, 7) NOT NULL,
    dropoff_longitude DECIMAL(10, 7) NOT NULL,
    distance_km DECIMAL(10, 2) NULL,
    estimated_fare DECIMAL(10, 2) NOT NULL,
    actual_fare DECIMAL(10, 2) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'REQUESTED',
    otp_code VARCHAR(10) NULL,
    payment_method VARCHAR(20) NULL,
    payment_status VARCHAR(20) NULL,
    started_at TIMESTAMPTZ NULL,
    completed_at TIMESTAMPTZ NULL,
    cancelled_at TIMESTAMPTZ NULL,
    cancellation_reason VARCHAR(500) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_rides_ride_number UNIQUE (ride_number),
    CONSTRAINT fk_rides_users FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_rides_drivers FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE RESTRICT,
    CONSTRAINT fk_rides_vehicles FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE RESTRICT,
    CONSTRAINT chk_rides_status CHECK (status IN ('REQUESTED', 'ASSIGNED', 'ACCEPTED', 'ARRIVING', 'STARTED', 'COMPLETED', 'CANCELLED')),
    CONSTRAINT chk_rides_vehicle_type CHECK (vehicle_type IN ('BIKE', 'AUTO', 'CAB'))
);

CREATE INDEX IF NOT EXISTS idx_rides_user_created ON rides (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rides_driver_status ON rides (driver_id, status);
CREATE INDEX IF NOT EXISTS idx_rides_status ON rides (status);

-- ------------------------------------------------------------------------------
-- 04. DOMAIN: MARKETPLACE (COMMUNITY BAZAAR)
-- ------------------------------------------------------------------------------

-- 19. Marketplace Categories
CREATE TABLE IF NOT EXISTS marketplace_categories (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    icon_url VARCHAR(500) NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_marketplace_categories_name UNIQUE (name)
);

CREATE INDEX IF NOT EXISTS idx_marketplace_categories_sort ON marketplace_categories (sort_order, is_active);

-- 20. Marketplace Listings
CREATE TABLE IF NOT EXISTS marketplace_listings (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL,
    category_id INT NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT NULL,
    price DECIMAL(12, 2) NOT NULL,
    condition VARCHAR(20) NOT NULL DEFAULT 'USED',
    location VARCHAR(200) NULL,
    latitude DECIMAL(10, 7) NULL,
    longitude DECIMAL(10, 7) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    view_count INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NULL,
    CONSTRAINT fk_marketplace_listings_users FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_marketplace_listings_categories FOREIGN KEY (category_id) REFERENCES marketplace_categories(id) ON DELETE RESTRICT,
    CONSTRAINT chk_marketplace_listings_condition CHECK (condition IN ('NEW', 'LIKE_NEW', 'USED', 'FAIR')),
    CONSTRAINT chk_marketplace_listings_status CHECK (status IN ('ACTIVE', 'SOLD', 'EXPIRED', 'REMOVED'))
);

CREATE INDEX IF NOT EXISTS idx_marketplace_listings_category_status ON marketplace_listings (category_id, status);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_user_id ON marketplace_listings (user_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_created ON marketplace_listings (created_at DESC);

-- 21. Listing Images
CREATE TABLE IF NOT EXISTS listing_images (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    listing_id BIGINT NOT NULL,
    image_url VARCHAR(500) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT fk_listing_images_listings FOREIGN KEY (listing_id) REFERENCES marketplace_listings(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_listing_images_listing_id ON listing_images (listing_id, sort_order);

-- 22. Listing Favorites
CREATE TABLE IF NOT EXISTS favorites (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL,
    listing_id BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT fk_favorites_users FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_favorites_listings FOREIGN KEY (listing_id) REFERENCES marketplace_listings(id) ON DELETE CASCADE,
    CONSTRAINT uq_favorites_user_listing UNIQUE (user_id, listing_id)
);

CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites (user_id);

-- 22a. Marketplace Offers
CREATE TABLE IF NOT EXISTS marketplace_offers (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    listing_id BIGINT NOT NULL,
    buyer_id BIGINT NOT NULL,
    seller_id BIGINT NOT NULL,
    offered_price DECIMAL(18,2) NOT NULL,
    message VARCHAR(500) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NULL,
    CONSTRAINT fk_marketplace_offers_listing FOREIGN KEY (listing_id) REFERENCES marketplace_listings(id) ON DELETE CASCADE,
    CONSTRAINT fk_marketplace_offers_buyer FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_marketplace_offers_seller FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT chk_marketplace_offers_status CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED'))
);

CREATE INDEX IF NOT EXISTS idx_marketplace_offers_listing ON marketplace_offers (listing_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_offers_buyer ON marketplace_offers (buyer_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_offers_seller ON marketplace_offers (seller_id);

-- ------------------------------------------------------------------------------
-- 05. DOMAIN: NOTIFICATIONS & DEVICE PUSH TOKENS
-- ------------------------------------------------------------------------------

-- 23. Notifications (In-App Feed & Push History)
CREATE TABLE IF NOT EXISTS notifications (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL,
    title VARCHAR(200) NOT NULL,
    body TEXT NULL,
    type VARCHAR(50) NULL, -- 'ORDER', 'RIDE', 'MARKETPLACE', 'PROMO', 'SYSTEM'
    reference_id VARCHAR(50) NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT fk_notifications_users FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications (user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications (user_id, created_at DESC);

-- 24. User Device Push Tokens (Expo Notifications Integration)
CREATE TABLE IF NOT EXISTS user_device_tokens (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL,
    expo_push_token VARCHAR(255) NOT NULL,
    platform VARCHAR(20) NOT NULL, -- 'ios', 'android', 'web'
    device_name VARCHAR(100) NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NULL,
    last_seen_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_user_device_tokens_token UNIQUE (expo_push_token),
    CONSTRAINT fk_user_device_tokens_users FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT chk_user_device_tokens_platform CHECK (platform IN ('ios', 'android', 'web'))
);

CREATE INDEX IF NOT EXISTS idx_user_device_tokens_user ON user_device_tokens (user_id, is_active);

-- ------------------------------------------------------------------------------
-- 06. DOMAIN: PLATFORM COMMONS (BANNERS, REVIEWS, PAYMENTS, SETTINGS)
-- ------------------------------------------------------------------------------

-- 25. Promotional Banners
CREATE TABLE IF NOT EXISTS banners (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    image_url VARCHAR(500) NULL,
    target_type VARCHAR(50) NULL, -- 'RESTAURANT', 'FOOD_ITEM', 'LISTING', 'URL', 'MODULE'
    target_id VARCHAR(50) NULL,
    module VARCHAR(20) NOT NULL DEFAULT 'HOME',
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    start_date TIMESTAMPTZ NULL,
    end_date TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NULL,
    CONSTRAINT chk_banners_module CHECK (module IN ('HOME', 'FOOD', 'RIDE', 'MARKETPLACE'))
);

CREATE INDEX IF NOT EXISTS idx_banners_module_active ON banners (module, is_active, sort_order);

-- 26. Customer Reviews & Ratings
CREATE TABLE IF NOT EXISTS reviews (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL,
    target_type VARCHAR(20) NOT NULL, -- 'RESTAURANT', 'DRIVER', 'LISTING'
    target_id BIGINT NOT NULL,
    rating INT NOT NULL,
    comment TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT fk_reviews_users FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT chk_reviews_rating CHECK (rating BETWEEN 1 AND 5),
    CONSTRAINT chk_reviews_target_type CHECK (target_type IN ('RESTAURANT', 'DRIVER', 'LISTING'))
);

CREATE INDEX IF NOT EXISTS idx_reviews_target ON reviews (target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews (user_id);

-- 27. Payments (Transaction Records)
CREATE TABLE IF NOT EXISTS payments (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL,
    module VARCHAR(20) NOT NULL, -- 'FOOD', 'RIDE'
    order_id BIGINT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(20) NOT NULL, -- 'COD', 'UPI', 'CARD', 'WALLET'
    transaction_id VARCHAR(100) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NULL,
    CONSTRAINT fk_payments_users FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT chk_payments_module CHECK (module IN ('FOOD', 'RIDE')),
    CONSTRAINT chk_payments_status CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'))
);

CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments (user_id);
CREATE INDEX IF NOT EXISTS idx_payments_transaction ON payments (transaction_id);

-- 28. Application Settings
CREATE TABLE IF NOT EXISTS app_settings (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    setting_key VARCHAR(100) NOT NULL,
    setting_value TEXT NULL,
    description VARCHAR(255) NULL,
    updated_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_app_settings_key UNIQUE (setting_key)
);

-- ==============================================================================
-- 07. MASTER SEED DATA (ESSENTIAL FOR APPLICATION BOOTSTRAP)
-- ==============================================================================

-- Seed 1: Roles (Matching RoleNames constants in SuperApp.API)
INSERT INTO roles (name, description) VALUES
    ('CUSTOMER', 'Regular customer user account'),
    ('ADMIN', 'System administrator with management access'),
    ('RESTAURANT_OWNER', 'Restaurant owner or partner manager'),
    ('DRIVER', 'Ride partner / vehicle operator'),
    ('MARKETPLACE_SELLER', 'Marketplace registered vendor or seller')
ON CONFLICT (name) DO NOTHING;

-- Seed 2: Default Super Admin User (Phone: 9999999999, Password: Admin@123)
-- BCrypt password hash matching ASP.NET Core identity seeding
INSERT INTO users (mobile_number, full_name, email, password_hash, is_active, created_at)
VALUES (
    '9999999999',
    'Super Admin',
    'admin@superapp.com',
    '$2a$11$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
    TRUE,
    clock_timestamp()
)
ON CONFLICT (mobile_number) DO NOTHING;

-- Seed 3: Assign Admin Role to Default Super Admin
DO $$
DECLARE
    v_admin_user_id BIGINT;
    v_admin_role_id INT;
BEGIN
    SELECT id INTO v_admin_user_id FROM users WHERE mobile_number = '9999999999' LIMIT 1;
    SELECT id INTO v_admin_role_id FROM roles WHERE name = 'ADMIN' LIMIT 1;

    IF v_admin_user_id IS NOT NULL AND v_admin_role_id IS NOT NULL THEN
        INSERT INTO user_roles (user_id, role_id, created_at)
        VALUES (v_admin_user_id, v_admin_role_id, clock_timestamp())
        ON CONFLICT (user_id, role_id) DO NOTHING;
    END IF;
END $$;

-- Seed 4: Marketplace Categories
INSERT INTO marketplace_categories (name, sort_order, is_active) VALUES
    ('Mobiles', 1, TRUE),
    ('Vehicles', 2, TRUE),
    ('Electronics', 3, TRUE),
    ('Furniture', 4, TRUE),
    ('Fashion', 5, TRUE),
    ('Books', 6, TRUE),
    ('Sports', 7, TRUE),
    ('Others', 8, TRUE)
ON CONFLICT (name) DO NOTHING;

-- Seed 5: Baseline Application Configuration
INSERT INTO app_settings (setting_key, setting_value, description) VALUES
    ('App:Name', 'SuperApp', 'Public branding name'),
    ('Food:TaxPercent', '5.0', 'GST percentage applied to food orders'),
    ('Ride:UrbanFactor', '1.25', 'Road layout tortuosity factor for distance estimation'),
    ('Ride:AverageSpeedKmh', '22.0', 'Average urban driving speed in km/h')
ON CONFLICT (setting_key) DO NOTHING;

-- ==============================================================================
-- 08. OPTIONAL DEMO SEED DATA (DEVELOPMENT & UI TESTING)
-- ==============================================================================
-- The following section can be executed to populate rich demo cards matching
-- the live mobile screens and reference designs.

DO $$
DECLARE
    v_admin_id BIGINT;
    v_rest1_id BIGINT;
    v_rest2_id BIGINT;
    v_cat1_id BIGINT;
    v_cat2_id BIGINT;
    v_cat3_id BIGINT;
    v_item1_id BIGINT;
    v_item2_id BIGINT;
    v_mcat_mobiles INT;
    v_mcat_vehicles INT;
    v_mcat_electronics INT;
    v_driver_user_id BIGINT;
    v_driver_id BIGINT;
    v_vehicle_id BIGINT;
BEGIN
    SELECT id INTO v_admin_id FROM users WHERE mobile_number = '9999999999' LIMIT 1;

    -- A. Seed Demo Promotional Coupons
    INSERT INTO coupons (code, description, discount_type, discount_value, min_order_amount, max_discount, start_date, expiry_date, applicable_module, is_active)
    VALUES
        ('WELCOME50', '50% off on your first food order', 'PERCENTAGE', 50.00, 150.00, 100.00, clock_timestamp(), clock_timestamp() + INTERVAL '180 days', 'FOOD', TRUE),
        ('FLAT30', 'Flat Rs 30 off on rides', 'FLAT', 30.00, 50.00, 30.00, clock_timestamp(), clock_timestamp() + INTERVAL '180 days', 'RIDE', TRUE)
    ON CONFLICT (code) DO NOTHING;

    -- B. Seed Demo Promotional Banners
    INSERT INTO banners (title, image_url, target_type, module, sort_order, is_active)
    VALUES
        ('50% OFF on Top Biryanis', 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=600', 'MODULE', 'FOOD', 1, TRUE),
        ('Fastest Bike Rides in Town', 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=600', 'MODULE', 'RIDE', 2, TRUE)
    ON CONFLICT DO NOTHING;

    -- C. Seed Demo Restaurants
    INSERT INTO restaurants (name, description, image_url, phone, address_line, city, latitude, longitude, rating, total_ratings, is_veg, opening_time, closing_time, min_order_amount, delivery_fee, avg_delivery_time_minutes, is_active, is_featured)
    VALUES (
        'Meghana Foods (Special Biryani)',
        'Biryani, Hyderabadi, Andhra, Kebabs',
        'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=500',
        '9876543210',
        'Connaught Place, Central Delhi',
        'New Delhi',
        28.6304000,
        77.2177000,
        4.60,
        1280,
        FALSE,
        '10:00:00',
        '23:00:00',
        200.00,
        0.00,
        22,
        TRUE,
        TRUE
    ) RETURNING id INTO v_rest1_id;

    INSERT INTO restaurants (name, description, image_url, phone, address_line, city, latitude, longitude, rating, total_ratings, is_veg, opening_time, closing_time, min_order_amount, delivery_fee, avg_delivery_time_minutes, is_active, is_featured)
    VALUES (
        'Haldiram''s Sweets & Thali',
        'North Indian, Chaat, Pure Veg, Mithai',
        'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=500',
        '9876543211',
        'Barakhamba Road, Central Delhi',
        'New Delhi',
        28.6315000,
        77.2240000,
        4.50,
        940,
        TRUE,
        '09:00:00',
        '22:30:00',
        150.00,
        25.00,
        18,
        TRUE,
        TRUE
    ) RETURNING id INTO v_rest2_id;

    -- D. Seed Menu Categories for Meghana Foods
    IF v_rest1_id IS NOT NULL THEN
        INSERT INTO restaurant_categories (restaurant_id, name, sort_order, is_active)
        VALUES (v_rest1_id, 'Biryani Specials', 1, TRUE) RETURNING id INTO v_cat1_id;

        INSERT INTO restaurant_categories (restaurant_id, name, sort_order, is_active)
        VALUES (v_rest1_id, 'Starters', 2, TRUE) RETURNING id INTO v_cat2_id;

        INSERT INTO restaurant_categories (restaurant_id, name, sort_order, is_active)
        VALUES (v_rest1_id, 'Desserts', 3, TRUE) RETURNING id INTO v_cat3_id;

        -- Dishes
        IF v_cat1_id IS NOT NULL THEN
            INSERT INTO food_items (restaurant_id, restaurant_category_id, name, description, image_url, base_price, discount_percent, is_veg, is_available, is_bestseller, is_customizable, sort_order)
            VALUES (
                v_rest1_id,
                v_cat1_id,
                'Meghana Special Chicken Biryani',
                'Fragrant Basmati rice topped with boneless spiced chicken marinated in Andhra green chili paste.',
                'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=300',
                340.00,
                0.00,
                FALSE,
                TRUE,
                TRUE,
                TRUE,
                1
            ) RETURNING id INTO v_item1_id;

            INSERT INTO food_items (restaurant_id, restaurant_category_id, name, description, image_url, base_price, discount_percent, is_veg, is_available, is_bestseller, is_customizable, sort_order)
            VALUES (
                v_rest1_id,
                v_cat1_id,
                'Paneer 65 Biryani (Dum Style)',
                'Spiced golden paneer cubes layered with saffron long grain basmati rice.',
                'https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=300',
                290.00,
                0.00,
                TRUE,
                TRUE,
                TRUE,
                TRUE,
                2
            ) RETURNING id INTO v_item2_id;

            -- Variants and Addons for Chicken Biryani
            IF v_item1_id IS NOT NULL THEN
                INSERT INTO food_item_variants (food_item_id, name, additional_price, is_default, sort_order) VALUES
                    (v_item1_id, 'Regular Portion', 0.00, TRUE, 1),
                    (v_item1_id, 'Jumbo Pack (Serves 3)', 210.00, FALSE, 2);

                INSERT INTO food_item_addons (food_item_id, group_name, name, price, is_default, sort_order) VALUES
                    (v_item1_id, 'ADD-ONS', 'Boondi Raita Bowl', 35.00, FALSE, 1),
                    (v_item1_id, 'ADD-ONS', 'Extra Mirchi Ka Salan', 45.00, FALSE, 2);
            END IF;
        END IF;

        IF v_cat2_id IS NOT NULL THEN
            INSERT INTO food_items (restaurant_id, restaurant_category_id, name, description, image_url, base_price, discount_percent, is_veg, is_available, is_bestseller, is_customizable, sort_order)
            VALUES (
                v_rest1_id,
                v_cat2_id,
                'Crispy Boneless Chicken 65',
                'Tender chicken bites tossed with south curry leaves, mustard seeds, and Andhra red chili glaze.',
                'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?w=300',
                310.00,
                0.00,
                FALSE,
                TRUE,
                TRUE,
                FALSE,
                3
            );
        END IF;
    END IF;

    -- E. Seed Demo Marketplace Listings
    SELECT id INTO v_mcat_mobiles FROM marketplace_categories WHERE name = 'Mobiles' LIMIT 1;
    SELECT id INTO v_mcat_vehicles FROM marketplace_categories WHERE name = 'Vehicles' LIMIT 1;
    SELECT id INTO v_mcat_electronics FROM marketplace_categories WHERE name = 'Electronics' LIMIT 1;

    IF v_admin_id IS NOT NULL AND v_mcat_mobiles IS NOT NULL THEN
        INSERT INTO marketplace_listings (user_id, category_id, title, description, price, condition, location, status, is_featured, view_count, is_active)
        VALUES (
            v_admin_id,
            v_mcat_mobiles,
            'iPhone 14 Pro Max 256GB Deep Purple (Like New)',
            'Battery health 94%, pristine condition with apple box, genuine charging cable and invoice.',
            68000.00,
            'LIKE_NEW',
            'Connaught Place, Central Delhi',
            'ACTIVE',
            TRUE,
            142,
            TRUE
        );

        INSERT INTO marketplace_listings (user_id, category_id, title, description, price, condition, location, status, is_featured, view_count, is_active)
        VALUES (
            v_admin_id,
            v_mcat_vehicles,
            'Royal Enfield Classic 350 (2022 Stealth Black)',
            'Single owner, 12,000 km driven, showroom serviced with comprehensive insurance valid till Nov 2027.',
            145000.00,
            'USED',
            'Karol Bagh, Delhi',
            'ACTIVE',
            TRUE,
            310,
            TRUE
        );
    END IF;

    -- F. Seed Demo Driver and Vehicle (Matching ActiveRideScreen Amit Singh)
    INSERT INTO users (mobile_number, full_name, email, is_active)
    VALUES ('9876543220', 'Amit Singh', 'amit.driver@superapp.com', TRUE)
    ON CONFLICT (mobile_number) DO UPDATE SET full_name = EXCLUDED.full_name
    RETURNING id INTO v_driver_user_id;

    IF v_driver_user_id IS NOT NULL THEN
        INSERT INTO drivers (user_id, license_number, is_verified, is_online, current_latitude, current_longitude, rating, total_rides, is_active)
        VALUES (v_driver_user_id, 'DL-04-2021-009821', TRUE, TRUE, 28.6304000, 77.2177000, 4.90, 1240, TRUE)
        ON CONFLICT (user_id) DO NOTHING
        RETURNING id INTO v_driver_id;

        IF v_driver_id IS NOT NULL THEN
            INSERT INTO vehicles (driver_id, type, make, model, year, registration_number, color, is_active)
            VALUES (v_driver_id, 'BIKE', 'Hero', 'Splendor Plus (Black)', 2023, 'DL 04 AB 9821', 'Black', TRUE)
            ON CONFLICT (registration_number) DO NOTHING;
        END IF;
    END IF;

END $$;

-- ------------------------------------------------------------------------------
-- 09. SUPABASE ROW LEVEL SECURITY (RLS) GUIDELINES
-- ------------------------------------------------------------------------------
-- By default, when accessed through the ASP.NET Core backend using the direct
-- connection string (postgres / service_role credentials), queries operate
-- with administrative permissions and bypass RLS automatically.
--
-- If you choose to enable RLS for direct Supabase Client / PostgREST access in
-- the future, uncomment and execute the following policies:
--
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE food_orders ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE rides ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE marketplace_listings ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE user_device_tokens ENABLE ROW LEVEL SECURITY;
--
-- CREATE POLICY "Users can read own profile" ON users
--     FOR SELECT USING (auth.uid()::text = id::text);
--
-- CREATE POLICY "Users can view active marketplace listings" ON marketplace_listings
--     FOR SELECT USING (status = 'ACTIVE');
--
-- ------------------------------------------------------------------------------
-- SCRIPT END
-- ------------------------------------------------------------------------------
