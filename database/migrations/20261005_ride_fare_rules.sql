ALTER TABLE rides ADD COLUMN IF NOT EXISTS fare_breakdown VARCHAR(1000) NULL;

CREATE TABLE IF NOT EXISTS ride_fare_rules (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    vehicle_type VARCHAR(20) NOT NULL,
    city VARCHAR(40) NOT NULL DEFAULT 'DEFAULT',
    minimum_fare DECIMAL(10,2) NOT NULL,
    base_fare DECIMAL(10,2) NOT NULL,
    included_distance_km DECIMAL(6,2) NOT NULL,
    per_km_rate DECIMAL(8,2) NOT NULL,
    per_minute_rate DECIMAL(8,2) NOT NULL,
    booking_fee DECIMAL(8,2) NOT NULL,
    platform_fee DECIMAL(8,2) NOT NULL,
    night_surcharge_percent DECIMAL(6,2) NOT NULL DEFAULT 0,
    peak_multiplier DECIMAL(6,2) NOT NULL DEFAULT 1,
    tax_percentage DECIMAL(6,2) NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS ride_fare_options (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code VARCHAR(40) NOT NULL,
    name VARCHAR(80) NOT NULL,
    description VARCHAR(200) NULL,
    additional_amount DECIMAL(8,2) NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    vehicle_types VARCHAR(80) NOT NULL DEFAULT 'ALL'
);
