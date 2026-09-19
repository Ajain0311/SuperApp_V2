-- ==============================================================================
-- Migration: 20260919_schema_audit_enhancements.sql
-- Purpose: Schema audit alignment & performance optimizations
-- Applied To: Supabase Managed PostgreSQL (db.drhjfkqeiijdmyettumz.supabase.co)
-- Author: Autonomous AI Database Engineer
-- Date: September 19, 2026
-- ==============================================================================

-- 1. FOREIGN KEY INDEX OPTIMIZATION
-- Add missing indexes on foreign key columns to eliminate table-level lock contention
-- and sequential scan overhead on parent table row modifications.

CREATE INDEX IF NOT EXISTS idx_food_orders_address_id 
    ON food_orders (address_id);

CREATE INDEX IF NOT EXISTS idx_food_orders_coupon_id 
    ON food_orders (coupon_id);

CREATE INDEX IF NOT EXISTS idx_food_order_items_food_item_id 
    ON food_order_items (food_item_id);

CREATE INDEX IF NOT EXISTS idx_rides_vehicle_id 
    ON rides (vehicle_id);


-- 2. CHECK CONSTRAINT MODERNIZATION FOR STATUS VALUES
-- Broaden check constraints to support application-level moderation and search states
-- without violating relational constraints.

-- 2.1 Marketplace Listings Status: Add 'FLAGGED' for content moderation
ALTER TABLE marketplace_listings DROP CONSTRAINT IF EXISTS chk_marketplace_listings_status;
ALTER TABLE marketplace_listings ADD CONSTRAINT chk_marketplace_listings_status 
    CHECK (status IN ('ACTIVE', 'SOLD', 'EXPIRED', 'REMOVED', 'FLAGGED'));

-- 2.2 Rides Status: Add 'SEARCHING' for driver dispatch pool state
ALTER TABLE rides DROP CONSTRAINT IF EXISTS chk_rides_status;
ALTER TABLE rides ADD CONSTRAINT chk_rides_status 
    CHECK (status IN ('REQUESTED', 'SEARCHING', 'ASSIGNED', 'ACCEPTED', 'ARRIVING', 'STARTED', 'COMPLETED', 'CANCELLED'));

-- 2.3 Payments Module: Add 'MARKETPLACE', 'WALLET', 'GENERAL' for cross-module support
ALTER TABLE payments DROP CONSTRAINT IF EXISTS chk_payments_module;
ALTER TABLE payments ADD CONSTRAINT chk_payments_module 
    CHECK (module IN ('FOOD', 'RIDE', 'MARKETPLACE', 'WALLET', 'GENERAL'));

-- ==============================================================================
-- ROLLBACK SCRIPT (In case rollback is required):
-- ==============================================================================
-- DROP INDEX IF EXISTS idx_food_orders_address_id;
-- DROP INDEX IF EXISTS idx_food_orders_coupon_id;
-- DROP INDEX IF EXISTS idx_food_order_items_food_item_id;
-- DROP INDEX IF EXISTS idx_rides_vehicle_id;
-- ALTER TABLE marketplace_listings DROP CONSTRAINT IF EXISTS chk_marketplace_listings_status;
-- ALTER TABLE marketplace_listings ADD CONSTRAINT chk_marketplace_listings_status CHECK (status IN ('ACTIVE', 'SOLD', 'EXPIRED', 'REMOVED'));
-- ALTER TABLE rides DROP CONSTRAINT IF EXISTS chk_rides_status;
-- ALTER TABLE rides ADD CONSTRAINT chk_rides_status CHECK (status IN ('REQUESTED', 'ASSIGNED', 'ACCEPTED', 'ARRIVING', 'STARTED', 'COMPLETED', 'CANCELLED'));
-- ALTER TABLE payments DROP CONSTRAINT IF EXISTS chk_payments_module;
-- ALTER TABLE payments ADD CONSTRAINT chk_payments_module CHECK (module IN ('FOOD', 'RIDE'));
-- ==============================================================================
