-- Citizen role applications: DRIVER (rider) and RESTAURANT_OWNER (hotel).
-- Marketplace sell remains open without an application (auto-grants MARKETPLACE_SELLER).
-- Default citizen role remains CUSTOMER on signup.

CREATE TABLE IF NOT EXISTS role_applications (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    requested_role VARCHAR(40) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    license_number VARCHAR(50) NULL,
    license_document_no VARCHAR(40) NULL,
    vehicle_type VARCHAR(20) NULL,
    vehicle_registration_number VARCHAR(30) NULL,
    vehicle_make VARCHAR(40) NULL,
    vehicle_model VARCHAR(40) NULL,
    hotel_name VARCHAR(150) NULL,
    hotel_address VARCHAR(300) NULL,
    hotel_city VARCHAR(80) NULL,
    hotel_phone VARCHAR(20) NULL,
    business_document_no VARCHAR(40) NULL,
    applicant_notes VARCHAR(500) NULL,
    admin_notes VARCHAR(500) NULL,
    reviewed_by_admin_id BIGINT NULL REFERENCES users(id),
    reviewed_by_admin_name VARCHAR(100) NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE NULL,
    result_restaurant_id BIGINT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NULL
);

CREATE INDEX IF NOT EXISTS ix_role_applications_user_id ON role_applications(user_id);
CREATE INDEX IF NOT EXISTS ix_role_applications_status ON role_applications(status);
