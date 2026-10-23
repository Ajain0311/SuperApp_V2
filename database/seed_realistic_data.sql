-- Comprehensive Realistic Seed Script for SuperApp (azuredb)
BEGIN;

-- 1. ROLES
INSERT INTO roles (name, description, is_active) VALUES
    ('CUSTOMER', 'Regular customer user account', TRUE),
    ('ADMIN', 'System administrator with full privileges', TRUE),
    ('RESTAURANT_OWNER', 'Restaurant owner and food partner manager', TRUE),
    ('DRIVER', 'Ride partner and delivery pilot', TRUE),
    ('MARKETPLACE_SELLER', 'Marketplace verified vendor and seller', TRUE)
ON CONFLICT (name) DO UPDATE SET is_active = TRUE;

-- 2. USERS (1 Admin + 2 of each role + 1 multi-role = 10 users)
-- Password for all users: Test@123 -> $2a$11$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy (BCrypt)
INSERT INTO users (id, mobile_number, full_name, email, profile_image_url, password_hash, is_active, notifications_enabled)
OVERRIDING SYSTEM VALUE VALUES
    (1, '9999999999', 'Aditya Sharma (Admin)', 'admin@superapp.com', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400', '$2a$11$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', TRUE, TRUE),
    (2, '9811122233', 'Rahul Verma', 'rahul.verma@gmail.com', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400', '$2a$11$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', TRUE, TRUE),
    (3, '9822233344', 'Priya Patel', 'priya.patel@gmail.com', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400', '$2a$11$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', TRUE, TRUE),
    (4, '9833344455', 'Chef Sanjeev Kapoor', 'sanjeev.punjabigrill@gmail.com', 'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=400', '$2a$11$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', TRUE, TRUE),
    (5, '9844455566', 'Ananya Deshmukh', 'ananya.southspices@gmail.com', 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400', '$2a$11$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', TRUE, TRUE),
    (6, '9855566677', 'Vikram Singh', 'vikram.rider@superapp.com', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400', '$2a$11$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', TRUE, TRUE),
    (7, '9866677788', 'Gurpreet Singh', 'gurpreet.driver@superapp.com', 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400', '$2a$11$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', TRUE, TRUE),
    (8, '9877788899', 'Rohan Mehra', 'rohan.gadgets@gmail.com', 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400', '$2a$11$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', TRUE, TRUE),
    (9, '9888899900', 'Neha Gupta', 'neha.thriftstore@gmail.com', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400', '$2a$11$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', TRUE, TRUE),
    (10, '9899900011', 'Arjun Kapoor', 'arjun.poweruser@gmail.com', 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400', '$2a$11$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', TRUE, TRUE)
ON CONFLICT (id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('users', 'id'), 10, true);

-- 3. USER ROLES MAPPING
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u, roles r WHERE u.id = 1 AND r.name = 'ADMIN'
UNION ALL
SELECT u.id, r.id FROM users u, roles r WHERE u.id IN (2, 3) AND r.name = 'CUSTOMER'
UNION ALL
SELECT u.id, r.id FROM users u, roles r WHERE u.id IN (4, 5) AND r.name = 'RESTAURANT_OWNER'
UNION ALL
SELECT u.id, r.id FROM users u, roles r WHERE u.id IN (6, 7) AND r.name = 'DRIVER'
UNION ALL
SELECT u.id, r.id FROM users u, roles r WHERE u.id IN (8, 9) AND r.name = 'MARKETPLACE_SELLER'
UNION ALL
SELECT u.id, r.id FROM users u, roles r WHERE u.id = 10 AND r.name IN ('CUSTOMER', 'MARKETPLACE_SELLER')
ON CONFLICT DO NOTHING;

-- 4. APP SETTINGS
INSERT INTO app_settings (setting_key, setting_value, description) VALUES
    ('App:Name', 'SuperApp', 'Public branding name'),
    ('Food:TaxPercent', '5.0', 'GST percentage applied to food orders'),
    ('Food:CommissionPercent', '15.0', 'Platform commission on food orders'),
    ('Ride:UrbanFactor', '1.25', 'Road layout tortuosity factor for distance estimation'),
    ('Ride:AverageSpeedKmh', '24.0', 'Average urban driving speed in km/h'),
    ('Support:Phone', '+91 9999999999', 'Customer helpline phone number'),
    ('Support:Email', 'support@superapp.com', 'Helpline email address')
ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value;

-- 5. ADDRESSES (Matching public.addresses schema)
INSERT INTO addresses (id, user_id, label, address_line1, address_line2, city, state, pin_code, latitude, longitude, is_default, is_active)
OVERRIDING SYSTEM VALUE VALUES
    (1, 2, 'Home', 'Flat 402, Tower B, ATS Greens', 'Sector 50', 'Noida', 'Uttar Pradesh', '201301', 28.5700000, 77.3600000, TRUE, TRUE),
    (2, 2, 'Work', 'Plot 14, Candor TechSpace', 'Sector 62', 'Noida', 'Uttar Pradesh', '201309', 28.6250000, 77.3750000, FALSE, TRUE),
    (3, 3, 'Home', 'House 128, Block C', 'Defence Colony', 'New Delhi', 'Delhi', '110024', 28.5720000, 77.2300000, TRUE, TRUE),
    (4, 10, 'Home', 'Apartment 12A, DLF Phase 5', 'Golf Course Road', 'Gurugram', 'Haryana', '122002', 28.4590000, 77.0980000, TRUE, TRUE)
ON CONFLICT (id) DO NOTHING;
SELECT setval(pg_get_serial_sequence('addresses', 'id'), 4, true);

-- 6. RESTAURANTS & CATEGORIES
INSERT INTO restaurants (id, name, description, image_url, phone, address_line, city, latitude, longitude, rating, total_ratings, is_veg, opening_time, closing_time, min_order_amount, delivery_fee, avg_delivery_time_minutes, is_active, is_featured)
OVERRIDING SYSTEM VALUE VALUES
    (1, 'Punjab Grill Royal', 'North Indian, Mughlai, Dal Makhani, Butter Chicken', 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=700', '9833344455', 'Shop 12-14, Connaught Place Inner Circle', 'New Delhi', 28.6328000, 77.2195000, 4.80, 540, FALSE, '11:00:00', '23:30:00', 250.00, 40.00, 32, TRUE, TRUE),
    (2, 'Dakshin Spices & Dosa Cafe', 'Authentic South Indian, Filter Coffee, Ghee Roast Dosa', 'https://images.unsplash.com/photo-1610192244261-3f33de3f55e4?w=700', '9844455566', 'B-4, Hauz Khas Village Main Market', 'New Delhi', 28.5494000, 77.1932000, 4.70, 390, TRUE, '08:00:00', '22:30:00', 150.00, 30.00, 25, TRUE, TRUE)
ON CONFLICT (id) DO NOTHING;
SELECT setval(pg_get_serial_sequence('restaurants', 'id'), 2, true);

INSERT INTO restaurant_users (restaurant_id, user_id, is_active) VALUES
    (1, 4, TRUE),
    (2, 5, TRUE)
ON CONFLICT DO NOTHING;

INSERT INTO restaurant_categories (id, restaurant_id, name, sort_order, is_active)
OVERRIDING SYSTEM VALUE VALUES
    (1, 1, 'Starters & Tandoor', 1, TRUE),
    (2, 1, 'Main Course Curries', 2, TRUE),
    (3, 1, 'Breads & Rice', 3, TRUE),
    (4, 2, 'Crispy Dosas & Idlis', 1, TRUE),
    (5, 2, 'South Indian Meals & Beverages', 2, TRUE)
ON CONFLICT (id) DO NOTHING;
SELECT setval(pg_get_serial_sequence('restaurant_categories', 'id'), 5, true);

INSERT INTO food_items (id, restaurant_id, restaurant_category_id, name, description, image_url, base_price, discount_percent, is_veg, is_available, is_bestseller, is_customizable, sort_order)
OVERRIDING SYSTEM VALUE VALUES
    (1, 1, 1, 'Murgh Malai Tikka (6 Pcs)', 'Succulent boneless chicken marinated in cream, cheese and royal aromatic herbs roasted in clay oven.', 'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?w=500', 380.00, 10.00, FALSE, TRUE, TRUE, TRUE, 1),
    (2, 1, 1, 'Amritsari Paneer Tikka', 'Tandoori spiced soft cottage cheese cubes grilled with crunchy capsicum and onions.', 'https://images.unsplash.com/photo-1567184109191-37a6727f9b8c?w=500', 320.00, 0.00, TRUE, TRUE, FALSE, FALSE, 2),
    (3, 1, 2, 'Dal Makhani Bukhara', 'Slow simmered black lentils cooked overnight with churned butter and rich vine-ripened tomatoes.', 'https://images.unsplash.com/photo-1546833998-877b37c2e5c6?w=500', 310.00, 5.00, TRUE, TRUE, TRUE, FALSE, 3),
    (4, 1, 2, 'Butter Chicken Delhi Special', 'Traditional boneless tandoori chicken cooked in velvety satin tomato gravy finished with fenugreek.', 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=500', 440.00, 15.00, FALSE, TRUE, TRUE, TRUE, 4),
    (5, 2, 4, 'Mysore Masala Butter Dosa', 'Golden crispy rice crepe smeared with fiery red garlic chutney and stuffed with spiced potato mash.', 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=500', 160.00, 0.00, TRUE, TRUE, TRUE, FALSE, 1),
    (6, 2, 4, 'Ghee Podi Idli (4 Pcs)', 'Bite sized button idlis tossed generously with coarse spiced gunpowder podi and desi ghee.', 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=500', 140.00, 0.00, TRUE, TRUE, FALSE, FALSE, 2),
    (7, 2, 5, 'Degree Filter Coffee', 'Traditional Kumbakonam frothy hot chicory coffee served in authentic brass dabarah.', 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=500', 70.00, 0.00, TRUE, TRUE, TRUE, FALSE, 3)
ON CONFLICT (id) DO NOTHING;
SELECT setval(pg_get_serial_sequence('food_items', 'id'), 7, true);

INSERT INTO food_item_variants (food_item_id, name, additional_price, is_default, sort_order) VALUES
    (1, 'Regular Portion (6 Pcs)', 0.00, TRUE, 1),
    (1, 'Sharing Platter (10 Pcs)', 220.00, FALSE, 2),
    (4, 'Half Portion', 0.00, TRUE, 1),
    (4, 'Full Handi (Serves 3)', 260.00, FALSE, 2)
ON CONFLICT DO NOTHING;

INSERT INTO food_item_addons (food_item_id, group_name, name, price, is_default, sort_order) VALUES
    (1, 'Chutney & Dip', 'Extra Mint Yogurt Chutney', 25.00, FALSE, 1),
    (3, 'Bread Companion', 'Garlic Butter Naan', 60.00, FALSE, 1),
    (4, 'Bread Companion', 'Lachha Paratha', 50.00, FALSE, 1)
ON CONFLICT DO NOTHING;

-- 7. DRIVERS & VEHICLES
INSERT INTO drivers (id, user_id, license_number, is_verified, is_online, current_latitude, current_longitude, rating, total_rides, is_active)
OVERRIDING SYSTEM VALUE VALUES
    (1, 6, 'DL-04-2022-778899', TRUE, TRUE, 28.6312000, 77.2185000, 4.92, 1420, TRUE),
    (2, 7, 'DL-07-2021-334455', TRUE, TRUE, 28.5710000, 77.2315000, 4.88, 980, TRUE)
ON CONFLICT (id) DO NOTHING;
SELECT setval(pg_get_serial_sequence('drivers', 'id'), 2, true);

INSERT INTO vehicles (id, driver_id, type, make, model, year, registration_number, color, is_active)
OVERRIDING SYSTEM VALUE VALUES
    (1, 1, 'BIKE', 'Hero', 'Splendor Plus Xtec', 2023, 'DL 04 AB 8899', 'Pearl Black', TRUE),
    (2, 2, 'CAB', 'Maruti Suzuki', 'Dzire ZXi (CNG)', 2022, 'DL 07 CY 4455', 'Silky Silver', TRUE)
ON CONFLICT (id) DO NOTHING;
SELECT setval(pg_get_serial_sequence('vehicles', 'id'), 2, true);

INSERT INTO ride_fare_rules (vehicle_type, city, minimum_fare, base_fare, included_distance_km, per_km_rate, per_minute_rate, booking_fee, platform_fee, night_surcharge_percent, peak_multiplier, tax_percentage, is_active) VALUES
    ('BIKE', 'DEFAULT', 35.00, 25.00, 2.00, 9.00, 1.00, 5.00, 5.00, 0.00, 1.00, 5.00, TRUE),
    ('AUTO', 'DEFAULT', 50.00, 40.00, 2.00, 14.00, 1.50, 7.00, 8.00, 0.00, 1.00, 5.00, TRUE),
    ('CAB',  'DEFAULT', 100.00, 80.00, 4.00, 18.00, 2.00, 15.00, 15.00, 0.00, 1.00, 5.00, TRUE)
ON CONFLICT DO NOTHING;

-- 8. MARKETPLACE CATEGORIES & LISTINGS
INSERT INTO marketplace_categories (id, name, sort_order, is_active)
OVERRIDING SYSTEM VALUE VALUES
    (1, 'Smartphones & Tablets', 1, TRUE),
    (2, 'Vehicles & Two-Wheelers', 2, TRUE),
    (3, 'Electronics & Audio', 3, TRUE),
    (4, 'Home & Furniture', 4, TRUE),
    (5, 'Fashion & Watches', 5, TRUE)
ON CONFLICT (id) DO NOTHING;
SELECT setval(pg_get_serial_sequence('marketplace_categories', 'id'), 5, true);

INSERT INTO marketplace_listings (id, user_id, category_id, title, description, price, condition, location, latitude, longitude, status, is_featured, view_count, is_active)
OVERRIDING SYSTEM VALUE VALUES
    (1, 8, 1, 'Apple iPhone 15 Pro Max 256GB Natural Titanium', 'Used for 6 months with extreme care. 98% battery health, bill, original box and Type-C cable included. No scratches.', 94500.00, 'LIKE_NEW', 'Connaught Place, New Delhi', 28.6315000, 77.2167000, 'ACTIVE', TRUE, 128, TRUE),
    (2, 8, 3, 'Sony WH-1000XM5 Wireless Noise Cancelling Headphones', 'Silver color, untouched earmuffs, outstanding active noise cancellation. 1 year warranty left with Croma invoice.', 21000.00, 'LIKE_NEW', 'Karol Bagh, New Delhi', 28.6517000, 77.1907000, 'ACTIVE', FALSE, 74, TRUE),
    (3, 9, 2, 'Royal Enfield Meteor 350 Supernova (Dual Tone Blue)', '2022 model, 14,200 km genuine reading, touring windscreen and backrest installed. Single owner, insured till 2027.', 175000.00, 'USED', 'Lajpat Nagar 2, New Delhi', 28.5677000, 77.2433000, 'ACTIVE', TRUE, 310, TRUE),
    (4, 9, 4, 'Solid Sheesham Wood 6-Seater Dining Table', 'Pure natural honey finish Sheesham wood with 6 high-back cushioned chairs. Selling due to house relocation.', 28000.00, 'LIKE_NEW', 'Sector 50, Noida', 28.5712000, 77.3621000, 'ACTIVE', FALSE, 58, TRUE)
ON CONFLICT (id) DO NOTHING;
SELECT setval(pg_get_serial_sequence('marketplace_listings', 'id'), 4, true);

INSERT INTO listing_images (listing_id, image_url, sort_order) VALUES
    (1, 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=600', 1),
    (2, 'https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=600', 1),
    (3, 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=600', 1),
    (4, 'https://images.unsplash.com/photo-1617806118233-18e1de247200?w=600', 1)
ON CONFLICT DO NOTHING;

-- 9. COUPONS & BANNERS
INSERT INTO coupons (code, description, discount_type, discount_value, min_order_amount, max_discount, start_date, expiry_date, applicable_module, is_active) VALUES
    ('WELCOME50', '50% off on your first food order', 'PERCENTAGE', 50.00, 150.00, 120.00, clock_timestamp(), clock_timestamp() + INTERVAL '180 days', 'FOOD', TRUE),
    ('DELHI30', 'Flat Rs 30 off on daily cab/bike rides', 'FLAT', 30.00, 60.00, 30.00, clock_timestamp(), clock_timestamp() + INTERVAL '180 days', 'RIDE', TRUE),
    ('TASTY100', 'Flat Rs 100 off on dining feast orders above 500', 'FLAT', 100.00, 500.00, 100.00, clock_timestamp(), clock_timestamp() + INTERVAL '180 days', 'FOOD', TRUE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO banners (title, subtitle, image_url, target_type, module, sort_order, is_active, cta_text) VALUES
    ('Royal Mughlai Treat', 'Up to 50% OFF on Top Biryanis & Tandoor', 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=800', 'MODULE', 'FOOD', 1, TRUE, 'Order Now'),
    ('Daily Commute Made Easy', 'Instant Bike & Auto Rides at Your Doorstep', 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=800', 'MODULE', 'RIDE', 2, TRUE, 'Book Ride'),
    ('Verified Marketplace Deals', 'Pre-owned electronics, mobiles and bikes with chat', 'https://images.unsplash.com/photo-1550009158-9ebf69173e03?w=800', 'MODULE', 'MARKETPLACE', 3, TRUE, 'Explore')
ON CONFLICT DO NOTHING;

-- 10. REALISTIC ACTIVE & PAST RIDES
INSERT INTO rides (id, ride_number, user_id, driver_id, vehicle_id, vehicle_type, pickup_address, pickup_latitude, pickup_longitude, dropoff_address, dropoff_latitude, dropoff_longitude, distance_km, estimated_fare, actual_fare, status, otp_code, payment_method, payment_status, started_at, completed_at, fare_breakdown)
OVERRIDING SYSTEM VALUE VALUES
    (1, 'RD-20261023-0101', 2, 1, 1, 'BIKE', 'Flat 402, ATS Greens, Sector 50, Noida', 28.5700000, 77.3600000, 'Candor TechSpace, Sector 62, Noida', 28.6250000, 77.3750000, 7.80, 95.00, 95.00, 'COMPLETED', '4821', 'ONLINE', 'PAID', clock_timestamp() - INTERVAL '3 hours', clock_timestamp() - INTERVAL '2 hours 35 minutes', '{"base":25,"distance":70.2,"tax":4.8}'),
    (2, 'RD-20261023-0102', 3, 2, 2, 'CAB', 'Defence Colony Flyover Market, New Delhi', 28.5720000, 77.2300000, 'Connaught Place Inner Circle, New Delhi', 28.6328000, 77.2195000, 9.40, 245.00, 245.00, 'COMPLETED', '1934', 'CASH', 'PAID', clock_timestamp() - INTERVAL '5 hours', clock_timestamp() - INTERVAL '4 hours 20 minutes', '{"base":80,"distance":135.0,"tax":11.5}'),
    (3, 'RD-20261023-0103', 10, 1, 1, 'BIKE', 'DLF Phase 5, Golf Course Road, Gurugram', 28.4590000, 77.0980000, 'Cyber Hub Building 10, Gurugram', 28.4950000, 77.0890000, 5.20, 68.00, NULL, 'ARRIVING', '6290', 'ONLINE', 'PENDING', NULL, NULL, '{"base":25,"distance":46.8}')
ON CONFLICT (id) DO NOTHING;
SELECT setval(pg_get_serial_sequence('rides', 'id'), 3, true);

-- 11. REALISTIC FOOD ORDERS & ORDER ITEMS
INSERT INTO food_orders (id, order_number, user_id, restaurant_id, address_id, status, sub_total, discount_amount, coupon_discount, delivery_fee, tax_amount, grand_total, payment_method, payment_status, notes, estimated_delivery_minutes, driver_id, driver_assigned_at)
OVERRIDING SYSTEM VALUE VALUES
    (1, 'FO-20261023-5001', 2, 1, 1, 'DELIVERED', 750.00, 0.00, 100.00, 40.00, 32.50, 722.50, 'ONLINE', 'PAID', 'Please ring the bell and hand over to security if not answered', 30, 1, clock_timestamp() - INTERVAL '4 hours'),
    (2, 'FO-20261023-5002', 3, 2, 3, 'PREPARING', 300.00, 0.00, 50.00, 30.00, 14.00, 294.00, 'ONLINE', 'PAID', 'Extra coconut chutney please, make coffee hot', 25, 1, clock_timestamp() - INTERVAL '15 minutes')
ON CONFLICT (id) DO NOTHING;
SELECT setval(pg_get_serial_sequence('food_orders', 'id'), 2, true);

INSERT INTO food_order_items (food_order_id, food_item_id, item_name, quantity, unit_price, variant_name, variant_price, total_price) VALUES
    (1, 1, 'Murgh Malai Tikka (6 Pcs)', 1, 380.00, 'Regular Portion (6 Pcs)', 0.00, 380.00),
    (1, 3, 'Dal Makhani Bukhara', 1, 310.00, NULL, 0.00, 310.00),
    (1, 4, 'Butter Chicken Delhi Special', 1, 440.00, 'Half Portion', 0.00, 440.00),
    (2, 5, 'Mysore Masala Butter Dosa', 1, 160.00, NULL, 0.00, 160.00),
    (2, 7, 'Degree Filter Coffee', 2, 70.00, NULL, 0.00, 140.00)
ON CONFLICT DO NOTHING;

-- 12. PAYMENTS (Matching public.payments schema: module, order_id, amount, payment_method, transaction_id, status)
INSERT INTO payments (user_id, module, order_id, amount, payment_method, transaction_id, status) VALUES
    (2, 'FOOD', 1, 722.50, 'UPI', 'TXN-EAS-99882211', 'COMPLETED'),
    (3, 'FOOD', 2, 294.00, 'UPI', 'TXN-EAS-99882212', 'COMPLETED'),
    (2, 'RIDE', 1, 95.00, 'UPI', 'TXN-EAS-99882213', 'COMPLETED')
ON CONFLICT DO NOTHING;

-- 13. CHAT CONVERSATIONS & MESSAGES (Marketplace)
INSERT INTO chat_conversations (id, listing_id, buyer_id, seller_id, created_at, updated_at)
VALUES (1, 1, 2, 8, clock_timestamp() - INTERVAL '2 days', clock_timestamp() - INTERVAL '1 hour')
ON CONFLICT DO NOTHING;
SELECT setval(pg_get_serial_sequence('chat_conversations', 'id'), 1, true);

INSERT INTO chat_messages (conversation_id, sender_id, message_text, created_at) VALUES
    (1, 2, 'Hi Rohan, is the iPhone 15 Pro Max still available?', clock_timestamp() - INTERVAL '2 days'),
    (1, 8, 'Hello Rahul! Yes, it is available in mint condition with invoice.', clock_timestamp() - INTERVAL '2 days' + INTERVAL '10 minutes'),
    (1, 2, 'Can you do 90k cash pickup tomorrow at CP?', clock_timestamp() - INTERVAL '1 day'),
    (1, 8, 'I can do 92k final. Let me know if that works for you.', clock_timestamp() - INTERVAL '1 hour')
ON CONFLICT DO NOTHING;

-- 14. MARKETPLACE OFFERS & FAVORITES
INSERT INTO marketplace_offers (listing_id, buyer_id, seller_id, offered_price, message, status) VALUES
    (1, 2, 8, 90000.00, 'Can you do 90k for quick pickup today?', 'PENDING')
ON CONFLICT DO NOTHING;

INSERT INTO favorites (user_id, listing_id) VALUES
    (2, 1),
    (3, 3),
    (10, 2)
ON CONFLICT DO NOTHING;

-- 15. REVIEWS & RATINGS
INSERT INTO reviews (user_id, target_type, target_id, rating, comment) VALUES
    (2, 'RESTAURANT', 1, 5, 'Best Dal Makhani in Delhi! Dal was creamy and slow cooked to perfection.'),
    (3, 'RESTAURANT', 2, 5, 'Crispy Ghee roast dosa and authentic filter coffee, felt like Bangalore!'),
    (2, 'DRIVER', 1, 5, 'Very polite rider, reached on time and drove safely with helmet.')
ON CONFLICT DO NOTHING;

-- 16. NOTIFICATIONS
INSERT INTO notifications (user_id, title, body, type, reference_id, is_read) VALUES
    (2, 'Order Delivered! 🎉', 'Your order from Punjab Grill Royal has been delivered. Enjoy your meal!', 'ORDER_DELIVERED', '1', TRUE),
    (3, 'Food is being prepared 🍳', 'Dakshin Spices is preparing your fresh Mysore Masala Dosa.', 'ORDER_PREPARING', '2', FALSE),
    (10, 'Driver Arriving 🛵', 'Vikram Singh is arriving in a Hero Splendor (DL 04 AB 8899). OTP is 6290.', 'RIDE_ARRIVING', '3', FALSE),
    (8, 'New Offer on iPhone 15 Pro Max', 'Rahul Verma sent an offer of ₹90,000 for your listing.', 'OFFER_RECEIVED', '1', FALSE)
ON CONFLICT DO NOTHING;

COMMIT;
