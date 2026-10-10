using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace SuperApp.API.Migrations
{
    /// <inheritdoc />
    public partial class AddThumbObject : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "app_settings",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    setting_key = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    setting_value = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    description = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_app_settings", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "banners",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    subtitle = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    image_url = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    cta_text = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    target_type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    target_id = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    module = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    start_date = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    end_date = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_banners", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "coupons",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    code = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    title = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    description = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    discount_type = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    discount_value = table.Column<decimal>(type: "numeric(10,2)", nullable: false),
                    min_order_amount = table.Column<decimal>(type: "numeric(10,2)", nullable: false),
                    max_discount = table.Column<decimal>(type: "numeric(10,2)", nullable: true),
                    start_date = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    expiry_date = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    total_usage_limit = table.Column<int>(type: "integer", nullable: true),
                    per_user_limit = table.Column<int>(type: "integer", nullable: false),
                    current_usage_count = table.Column<int>(type: "integer", nullable: false),
                    applicable_module = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    applicable_restaurant_id = table.Column<long>(type: "bigint", nullable: true),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_coupons", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "marketplace_categories",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    icon_url = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_marketplace_categories", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "otp_requests",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    mobile_number = table.Column<string>(type: "character varying(15)", maxLength: 15, nullable: false),
                    otp_code = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    purpose = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    is_used = table.Column<bool>(type: "boolean", nullable: false),
                    expires_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    attempt_count = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_otp_requests", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "restaurants",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    image_url = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    phone = table.Column<string>(type: "character varying(15)", maxLength: 15, nullable: true),
                    email = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    address_line = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    city = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    latitude = table.Column<decimal>(type: "numeric(10,7)", nullable: true),
                    longitude = table.Column<decimal>(type: "numeric(10,7)", nullable: true),
                    rating = table.Column<decimal>(type: "numeric(3,2)", nullable: false),
                    total_ratings = table.Column<int>(type: "integer", nullable: false),
                    is_veg = table.Column<bool>(type: "boolean", nullable: false),
                    opening_time = table.Column<TimeSpan>(type: "interval", nullable: true),
                    closing_time = table.Column<TimeSpan>(type: "interval", nullable: true),
                    min_order_amount = table.Column<decimal>(type: "numeric(10,2)", nullable: false),
                    delivery_fee = table.Column<decimal>(type: "numeric(10,2)", nullable: false),
                    avg_delivery_time_minutes = table.Column<int>(type: "integer", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    is_featured = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_restaurants", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "ride_fare_options",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    code = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    name = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    description = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    additional_amount = table.Column<decimal>(type: "numeric(8,2)", nullable: false),
                    is_enabled = table.Column<bool>(type: "boolean", nullable: false),
                    vehicle_types = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_ride_fare_options", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "ride_fare_rules",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    vehicle_type = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    city = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    minimum_fare = table.Column<decimal>(type: "numeric(10,2)", nullable: false),
                    base_fare = table.Column<decimal>(type: "numeric(10,2)", nullable: false),
                    included_distance_km = table.Column<decimal>(type: "numeric(6,2)", nullable: false),
                    per_km_rate = table.Column<decimal>(type: "numeric(8,2)", nullable: false),
                    per_minute_rate = table.Column<decimal>(type: "numeric(8,2)", nullable: false),
                    booking_fee = table.Column<decimal>(type: "numeric(8,2)", nullable: false),
                    platform_fee = table.Column<decimal>(type: "numeric(8,2)", nullable: false),
                    night_surcharge_percent = table.Column<decimal>(type: "numeric(6,2)", nullable: false),
                    peak_multiplier = table.Column<decimal>(type: "numeric(6,2)", nullable: false),
                    tax_percentage = table.Column<decimal>(type: "numeric(6,2)", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_ride_fare_rules", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "roles",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    name = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    description = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_roles", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "users",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    mobile_number = table.Column<string>(type: "character varying(15)", maxLength: 15, nullable: false),
                    full_name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    email = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    profile_image_url = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    password_hash = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    last_login_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_users", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "restaurant_categories",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    restaurant_id = table.Column<long>(type: "bigint", nullable: false),
                    name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    description = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_restaurant_categories", x => x.id);
                    table.ForeignKey(
                        name: "fk_restaurant_categories_restaurants_restaurant_id",
                        column: x => x.restaurant_id,
                        principalTable: "restaurants",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "addresses",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    user_id = table.Column<long>(type: "bigint", nullable: false),
                    label = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    address_line1 = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    address_line2 = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    city = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    state = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    pin_code = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    latitude = table.Column<decimal>(type: "numeric(10,7)", nullable: true),
                    longitude = table.Column<decimal>(type: "numeric(10,7)", nullable: true),
                    is_default = table.Column<bool>(type: "boolean", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_addresses", x => x.id);
                    table.ForeignKey(
                        name: "fk_addresses_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "coupon_usages",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    coupon_id = table.Column<long>(type: "bigint", nullable: false),
                    user_id = table.Column<long>(type: "bigint", nullable: false),
                    order_id = table.Column<long>(type: "bigint", nullable: true),
                    used_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_coupon_usages", x => x.id);
                    table.ForeignKey(
                        name: "fk_coupon_usages_coupons_coupon_id",
                        column: x => x.coupon_id,
                        principalTable: "coupons",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_coupon_usages_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "documents",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    document_no = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    document_name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    blob_object = table.Column<byte[]>(type: "bytea", nullable: false),
                    thumb_object = table.Column<byte[]>(type: "bytea", nullable: true),
                    owner_user_id = table.Column<long>(type: "bigint", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_documents", x => x.id);
                    table.ForeignKey(
                        name: "fk_documents_users_owner_user_id",
                        column: x => x.owner_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "drivers",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    user_id = table.Column<long>(type: "bigint", nullable: false),
                    license_number = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    is_verified = table.Column<bool>(type: "boolean", nullable: false),
                    is_online = table.Column<bool>(type: "boolean", nullable: false),
                    current_latitude = table.Column<decimal>(type: "numeric(10,7)", nullable: true),
                    current_longitude = table.Column<decimal>(type: "numeric(10,7)", nullable: true),
                    rating = table.Column<decimal>(type: "numeric(3,2)", nullable: false),
                    total_rides = table.Column<int>(type: "integer", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_drivers", x => x.id);
                    table.ForeignKey(
                        name: "fk_drivers_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "marketplace_listings",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    user_id = table.Column<long>(type: "bigint", nullable: false),
                    category_id = table.Column<int>(type: "integer", nullable: false),
                    title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    description = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    price = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    condition = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    location = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    latitude = table.Column<decimal>(type: "numeric(10,7)", nullable: true),
                    longitude = table.Column<decimal>(type: "numeric(10,7)", nullable: true),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    is_featured = table.Column<bool>(type: "boolean", nullable: false),
                    view_count = table.Column<int>(type: "integer", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_marketplace_listings", x => x.id);
                    table.ForeignKey(
                        name: "fk_marketplace_listings_marketplace_categories_category_id",
                        column: x => x.category_id,
                        principalTable: "marketplace_categories",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "fk_marketplace_listings_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "notifications",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    user_id = table.Column<long>(type: "bigint", nullable: false),
                    title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    body = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    reference_id = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    is_read = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_notifications", x => x.id);
                    table.ForeignKey(
                        name: "fk_notifications_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "payments",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    user_id = table.Column<long>(type: "bigint", nullable: false),
                    module = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    order_id = table.Column<long>(type: "bigint", nullable: false),
                    amount = table.Column<decimal>(type: "numeric(10,2)", nullable: false),
                    payment_method = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    transaction_id = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_payments", x => x.id);
                    table.ForeignKey(
                        name: "fk_payments_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "restaurant_users",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    restaurant_id = table.Column<long>(type: "bigint", nullable: false),
                    user_id = table.Column<long>(type: "bigint", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_restaurant_users", x => x.id);
                    table.ForeignKey(
                        name: "fk_restaurant_users_restaurants_restaurant_id",
                        column: x => x.restaurant_id,
                        principalTable: "restaurants",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_restaurant_users_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "reviews",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    user_id = table.Column<long>(type: "bigint", nullable: false),
                    target_type = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    target_id = table.Column<long>(type: "bigint", nullable: false),
                    rating = table.Column<int>(type: "integer", nullable: false),
                    comment = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_reviews", x => x.id);
                    table.ForeignKey(
                        name: "fk_reviews_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "user_device_tokens",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    user_id = table.Column<long>(type: "bigint", nullable: false),
                    expo_push_token = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    platform = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    device_name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_user_device_tokens", x => x.id);
                    table.ForeignKey(
                        name: "fk_user_device_tokens_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "user_roles",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    user_id = table.Column<long>(type: "bigint", nullable: false),
                    role_id = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_user_roles", x => x.id);
                    table.ForeignKey(
                        name: "fk_user_roles_roles_role_id",
                        column: x => x.role_id,
                        principalTable: "roles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_user_roles_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "food_items",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    restaurant_category_id = table.Column<long>(type: "bigint", nullable: false),
                    restaurant_id = table.Column<long>(type: "bigint", nullable: false),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    image_url = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    base_price = table.Column<decimal>(type: "numeric(10,2)", nullable: false),
                    discount_percent = table.Column<decimal>(type: "numeric(5,2)", nullable: false),
                    is_veg = table.Column<bool>(type: "boolean", nullable: false),
                    is_available = table.Column<bool>(type: "boolean", nullable: false),
                    is_bestseller = table.Column<bool>(type: "boolean", nullable: false),
                    is_customizable = table.Column<bool>(type: "boolean", nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_food_items", x => x.id);
                    table.ForeignKey(
                        name: "fk_food_items_restaurant_categories_restaurant_category_id",
                        column: x => x.restaurant_category_id,
                        principalTable: "restaurant_categories",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_food_items_restaurants_restaurant_id",
                        column: x => x.restaurant_id,
                        principalTable: "restaurants",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "food_orders",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    order_number = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    user_id = table.Column<long>(type: "bigint", nullable: false),
                    restaurant_id = table.Column<long>(type: "bigint", nullable: false),
                    address_id = table.Column<long>(type: "bigint", nullable: true),
                    driver_id = table.Column<long>(type: "bigint", nullable: true),
                    driver_assigned_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    sub_total = table.Column<decimal>(type: "numeric(10,2)", nullable: false),
                    discount_amount = table.Column<decimal>(type: "numeric(10,2)", nullable: false),
                    coupon_id = table.Column<long>(type: "bigint", nullable: true),
                    coupon_discount = table.Column<decimal>(type: "numeric(10,2)", nullable: false),
                    delivery_fee = table.Column<decimal>(type: "numeric(10,2)", nullable: false),
                    tax_amount = table.Column<decimal>(type: "numeric(10,2)", nullable: false),
                    grand_total = table.Column<decimal>(type: "numeric(10,2)", nullable: false),
                    payment_method = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    payment_status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    estimated_delivery_minutes = table.Column<int>(type: "integer", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_food_orders", x => x.id);
                    table.ForeignKey(
                        name: "fk_food_orders_addresses_address_id",
                        column: x => x.address_id,
                        principalTable: "addresses",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "fk_food_orders_coupons_coupon_id",
                        column: x => x.coupon_id,
                        principalTable: "coupons",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "fk_food_orders_drivers_driver_id",
                        column: x => x.driver_id,
                        principalTable: "drivers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "fk_food_orders_restaurants_restaurant_id",
                        column: x => x.restaurant_id,
                        principalTable: "restaurants",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "fk_food_orders_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "vehicles",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    driver_id = table.Column<long>(type: "bigint", nullable: false),
                    type = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    make = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    model = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    year = table.Column<int>(type: "integer", nullable: true),
                    registration_number = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    color = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_vehicles", x => x.id);
                    table.ForeignKey(
                        name: "fk_vehicles_drivers_driver_id",
                        column: x => x.driver_id,
                        principalTable: "drivers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "favorites",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    user_id = table.Column<long>(type: "bigint", nullable: false),
                    listing_id = table.Column<long>(type: "bigint", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_favorites", x => x.id);
                    table.ForeignKey(
                        name: "fk_favorites_marketplace_listings_listing_id",
                        column: x => x.listing_id,
                        principalTable: "marketplace_listings",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "fk_favorites_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "listing_images",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    listing_id = table.Column<long>(type: "bigint", nullable: false),
                    image_url = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_listing_images", x => x.id);
                    table.ForeignKey(
                        name: "fk_listing_images_marketplace_listings_listing_id",
                        column: x => x.listing_id,
                        principalTable: "marketplace_listings",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "marketplace_offers",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    listing_id = table.Column<long>(type: "bigint", nullable: false),
                    buyer_id = table.Column<long>(type: "bigint", nullable: false),
                    seller_id = table.Column<long>(type: "bigint", nullable: false),
                    offered_price = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    message = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_marketplace_offers", x => x.id);
                    table.ForeignKey(
                        name: "fk_marketplace_offers_marketplace_listings_listing_id",
                        column: x => x.listing_id,
                        principalTable: "marketplace_listings",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_marketplace_offers_users_buyer_id",
                        column: x => x.buyer_id,
                        principalTable: "users",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "fk_marketplace_offers_users_seller_id",
                        column: x => x.seller_id,
                        principalTable: "users",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "food_item_addons",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    food_item_id = table.Column<long>(type: "bigint", nullable: false),
                    group_name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    price = table.Column<decimal>(type: "numeric(10,2)", nullable: false),
                    is_default = table.Column<bool>(type: "boolean", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_food_item_addons", x => x.id);
                    table.ForeignKey(
                        name: "fk_food_item_addons_food_items_food_item_id",
                        column: x => x.food_item_id,
                        principalTable: "food_items",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "food_item_variants",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    food_item_id = table.Column<long>(type: "bigint", nullable: false),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    additional_price = table.Column<decimal>(type: "numeric(10,2)", nullable: false),
                    is_default = table.Column<bool>(type: "boolean", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_food_item_variants", x => x.id);
                    table.ForeignKey(
                        name: "fk_food_item_variants_food_items_food_item_id",
                        column: x => x.food_item_id,
                        principalTable: "food_items",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "food_order_items",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    food_order_id = table.Column<long>(type: "bigint", nullable: false),
                    food_item_id = table.Column<long>(type: "bigint", nullable: false),
                    item_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    quantity = table.Column<int>(type: "integer", nullable: false),
                    unit_price = table.Column<decimal>(type: "numeric(10,2)", nullable: false),
                    variant_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    variant_price = table.Column<decimal>(type: "numeric(10,2)", nullable: false),
                    addons_json = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    total_price = table.Column<decimal>(type: "numeric(10,2)", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_food_order_items", x => x.id);
                    table.ForeignKey(
                        name: "fk_food_order_items_food_items_food_item_id",
                        column: x => x.food_item_id,
                        principalTable: "food_items",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "fk_food_order_items_food_orders_food_order_id",
                        column: x => x.food_order_id,
                        principalTable: "food_orders",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "rides",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ride_number = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    user_id = table.Column<long>(type: "bigint", nullable: false),
                    driver_id = table.Column<long>(type: "bigint", nullable: true),
                    vehicle_id = table.Column<long>(type: "bigint", nullable: true),
                    vehicle_type = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    pickup_address = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    pickup_latitude = table.Column<decimal>(type: "numeric(10,7)", nullable: false),
                    pickup_longitude = table.Column<decimal>(type: "numeric(10,7)", nullable: false),
                    dropoff_address = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    dropoff_latitude = table.Column<decimal>(type: "numeric(10,7)", nullable: false),
                    dropoff_longitude = table.Column<decimal>(type: "numeric(10,7)", nullable: false),
                    distance_km = table.Column<decimal>(type: "numeric(10,2)", nullable: true),
                    estimated_fare = table.Column<decimal>(type: "numeric(10,2)", nullable: false),
                    fare_breakdown = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    actual_fare = table.Column<decimal>(type: "numeric(10,2)", nullable: true),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    otp_code = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    payment_method = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    payment_status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    started_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    completed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    cancelled_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    cancellation_reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_rides", x => x.id);
                    table.ForeignKey(
                        name: "fk_rides_drivers_driver_id",
                        column: x => x.driver_id,
                        principalTable: "drivers",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "fk_rides_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "fk_rides_vehicles_vehicle_id",
                        column: x => x.vehicle_id,
                        principalTable: "vehicles",
                        principalColumn: "id");
                });

            migrationBuilder.InsertData(
                table: "marketplace_categories",
                columns: new[] { "id", "created_at", "icon_url", "is_active", "name", "sort_order", "updated_at" },
                values: new object[,]
                {
                    { 1, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), null, true, "Mobiles", 1, null },
                    { 2, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), null, true, "Vehicles", 2, null },
                    { 3, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), null, true, "Electronics", 3, null },
                    { 4, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), null, true, "Furniture", 4, null },
                    { 5, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), null, true, "Fashion", 5, null },
                    { 6, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), null, true, "Books", 6, null },
                    { 7, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), null, true, "Sports", 7, null },
                    { 8, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), null, true, "Others", 8, null }
                });

            migrationBuilder.InsertData(
                table: "roles",
                columns: new[] { "id", "created_at", "description", "is_active", "name", "updated_at" },
                values: new object[,]
                {
                    { 1, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "Regular customer", true, "CUSTOMER", null },
                    { 2, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "System administrator", true, "ADMIN", null },
                    { 3, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "Restaurant owner/manager", true, "RESTAURANT_OWNER", null },
                    { 4, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "Ride driver", true, "DRIVER", null },
                    { 5, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "Marketplace seller", true, "MARKETPLACE_SELLER", null }
                });

            migrationBuilder.InsertData(
                table: "users",
                columns: new[] { "id", "created_at", "email", "full_name", "is_active", "last_login_at", "mobile_number", "password_hash", "profile_image_url", "updated_at" },
                values: new object[] { 1L, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "admin@superapp.com", "Super Admin", true, null, "9999999999", "$2a$11$kEvB4pFxE0IhjD28yqLBZO.8xYR7daOP4JsmF8Ls4Oxfpcl3MYh5O", null, null });

            migrationBuilder.InsertData(
                table: "user_roles",
                columns: new[] { "id", "created_at", "role_id", "user_id" },
                values: new object[] { 1L, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), 2, 1L });

            migrationBuilder.CreateIndex(
                name: "ix_addresses_user_id",
                table: "addresses",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "ix_app_settings_setting_key",
                table: "app_settings",
                column: "setting_key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_banners_is_active",
                table: "banners",
                column: "is_active");

            migrationBuilder.CreateIndex(
                name: "ix_banners_module",
                table: "banners",
                column: "module");

            migrationBuilder.CreateIndex(
                name: "ix_coupon_usages_coupon_id_user_id",
                table: "coupon_usages",
                columns: new[] { "coupon_id", "user_id" });

            migrationBuilder.CreateIndex(
                name: "ix_coupon_usages_user_id",
                table: "coupon_usages",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "ix_coupons_code",
                table: "coupons",
                column: "code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_coupons_is_active",
                table: "coupons",
                column: "is_active");

            migrationBuilder.CreateIndex(
                name: "ix_documents_document_no",
                table: "documents",
                column: "document_no",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_documents_owner_user_id",
                table: "documents",
                column: "owner_user_id");

            migrationBuilder.CreateIndex(
                name: "ix_drivers_user_id",
                table: "drivers",
                column: "user_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_favorites_listing_id",
                table: "favorites",
                column: "listing_id");

            migrationBuilder.CreateIndex(
                name: "ix_favorites_user_id_listing_id",
                table: "favorites",
                columns: new[] { "user_id", "listing_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_food_item_addons_food_item_id",
                table: "food_item_addons",
                column: "food_item_id");

            migrationBuilder.CreateIndex(
                name: "ix_food_item_variants_food_item_id",
                table: "food_item_variants",
                column: "food_item_id");

            migrationBuilder.CreateIndex(
                name: "ix_food_items_is_available",
                table: "food_items",
                column: "is_available");

            migrationBuilder.CreateIndex(
                name: "ix_food_items_restaurant_category_id",
                table: "food_items",
                column: "restaurant_category_id");

            migrationBuilder.CreateIndex(
                name: "ix_food_items_restaurant_id",
                table: "food_items",
                column: "restaurant_id");

            migrationBuilder.CreateIndex(
                name: "ix_food_order_items_food_item_id",
                table: "food_order_items",
                column: "food_item_id");

            migrationBuilder.CreateIndex(
                name: "ix_food_order_items_food_order_id",
                table: "food_order_items",
                column: "food_order_id");

            migrationBuilder.CreateIndex(
                name: "ix_food_orders_address_id",
                table: "food_orders",
                column: "address_id");

            migrationBuilder.CreateIndex(
                name: "ix_food_orders_coupon_id",
                table: "food_orders",
                column: "coupon_id");

            migrationBuilder.CreateIndex(
                name: "ix_food_orders_created_at",
                table: "food_orders",
                column: "created_at");

            migrationBuilder.CreateIndex(
                name: "ix_food_orders_driver_id",
                table: "food_orders",
                column: "driver_id");

            migrationBuilder.CreateIndex(
                name: "ix_food_orders_order_number",
                table: "food_orders",
                column: "order_number",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_food_orders_restaurant_id",
                table: "food_orders",
                column: "restaurant_id");

            migrationBuilder.CreateIndex(
                name: "ix_food_orders_status",
                table: "food_orders",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "ix_food_orders_user_id",
                table: "food_orders",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "ix_listing_images_listing_id",
                table: "listing_images",
                column: "listing_id");

            migrationBuilder.CreateIndex(
                name: "ix_marketplace_categories_name",
                table: "marketplace_categories",
                column: "name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_marketplace_listings_category_id",
                table: "marketplace_listings",
                column: "category_id");

            migrationBuilder.CreateIndex(
                name: "ix_marketplace_listings_created_at",
                table: "marketplace_listings",
                column: "created_at");

            migrationBuilder.CreateIndex(
                name: "ix_marketplace_listings_status",
                table: "marketplace_listings",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "ix_marketplace_listings_user_id",
                table: "marketplace_listings",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "ix_marketplace_offers_buyer_id",
                table: "marketplace_offers",
                column: "buyer_id");

            migrationBuilder.CreateIndex(
                name: "ix_marketplace_offers_listing_id",
                table: "marketplace_offers",
                column: "listing_id");

            migrationBuilder.CreateIndex(
                name: "ix_marketplace_offers_seller_id",
                table: "marketplace_offers",
                column: "seller_id");

            migrationBuilder.CreateIndex(
                name: "ix_notifications_is_read",
                table: "notifications",
                column: "is_read");

            migrationBuilder.CreateIndex(
                name: "ix_notifications_user_id",
                table: "notifications",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "ix_otp_requests_expires_at",
                table: "otp_requests",
                column: "expires_at");

            migrationBuilder.CreateIndex(
                name: "ix_otp_requests_mobile_number",
                table: "otp_requests",
                column: "mobile_number");

            migrationBuilder.CreateIndex(
                name: "ix_payments_transaction_id",
                table: "payments",
                column: "transaction_id");

            migrationBuilder.CreateIndex(
                name: "ix_payments_user_id",
                table: "payments",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "ix_restaurant_categories_restaurant_id",
                table: "restaurant_categories",
                column: "restaurant_id");

            migrationBuilder.CreateIndex(
                name: "ix_restaurant_users_restaurant_id_user_id",
                table: "restaurant_users",
                columns: new[] { "restaurant_id", "user_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_restaurant_users_user_id",
                table: "restaurant_users",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "ix_restaurants_city",
                table: "restaurants",
                column: "city");

            migrationBuilder.CreateIndex(
                name: "ix_restaurants_is_active",
                table: "restaurants",
                column: "is_active");

            migrationBuilder.CreateIndex(
                name: "ix_restaurants_is_featured",
                table: "restaurants",
                column: "is_featured");

            migrationBuilder.CreateIndex(
                name: "ix_reviews_target_type_target_id",
                table: "reviews",
                columns: new[] { "target_type", "target_id" });

            migrationBuilder.CreateIndex(
                name: "ix_reviews_user_id",
                table: "reviews",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "ix_rides_created_at",
                table: "rides",
                column: "created_at");

            migrationBuilder.CreateIndex(
                name: "ix_rides_driver_id",
                table: "rides",
                column: "driver_id");

            migrationBuilder.CreateIndex(
                name: "ix_rides_ride_number",
                table: "rides",
                column: "ride_number",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_rides_status",
                table: "rides",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "ix_rides_user_id",
                table: "rides",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "ix_rides_vehicle_id",
                table: "rides",
                column: "vehicle_id");

            migrationBuilder.CreateIndex(
                name: "ix_roles_name",
                table: "roles",
                column: "name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_user_device_tokens_user_id_expo_push_token",
                table: "user_device_tokens",
                columns: new[] { "user_id", "expo_push_token" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_user_roles_role_id",
                table: "user_roles",
                column: "role_id");

            migrationBuilder.CreateIndex(
                name: "ix_user_roles_user_id_role_id",
                table: "user_roles",
                columns: new[] { "user_id", "role_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_users_email",
                table: "users",
                column: "email",
                unique: true,
                filter: "\"email\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_users_mobile_number",
                table: "users",
                column: "mobile_number",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_vehicles_driver_id",
                table: "vehicles",
                column: "driver_id");

            migrationBuilder.CreateIndex(
                name: "ix_vehicles_registration_number",
                table: "vehicles",
                column: "registration_number",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "app_settings");

            migrationBuilder.DropTable(
                name: "banners");

            migrationBuilder.DropTable(
                name: "coupon_usages");

            migrationBuilder.DropTable(
                name: "documents");

            migrationBuilder.DropTable(
                name: "favorites");

            migrationBuilder.DropTable(
                name: "food_item_addons");

            migrationBuilder.DropTable(
                name: "food_item_variants");

            migrationBuilder.DropTable(
                name: "food_order_items");

            migrationBuilder.DropTable(
                name: "listing_images");

            migrationBuilder.DropTable(
                name: "marketplace_offers");

            migrationBuilder.DropTable(
                name: "notifications");

            migrationBuilder.DropTable(
                name: "otp_requests");

            migrationBuilder.DropTable(
                name: "payments");

            migrationBuilder.DropTable(
                name: "restaurant_users");

            migrationBuilder.DropTable(
                name: "reviews");

            migrationBuilder.DropTable(
                name: "ride_fare_options");

            migrationBuilder.DropTable(
                name: "ride_fare_rules");

            migrationBuilder.DropTable(
                name: "rides");

            migrationBuilder.DropTable(
                name: "user_device_tokens");

            migrationBuilder.DropTable(
                name: "user_roles");

            migrationBuilder.DropTable(
                name: "food_items");

            migrationBuilder.DropTable(
                name: "food_orders");

            migrationBuilder.DropTable(
                name: "marketplace_listings");

            migrationBuilder.DropTable(
                name: "vehicles");

            migrationBuilder.DropTable(
                name: "roles");

            migrationBuilder.DropTable(
                name: "restaurant_categories");

            migrationBuilder.DropTable(
                name: "addresses");

            migrationBuilder.DropTable(
                name: "coupons");

            migrationBuilder.DropTable(
                name: "marketplace_categories");

            migrationBuilder.DropTable(
                name: "drivers");

            migrationBuilder.DropTable(
                name: "restaurants");

            migrationBuilder.DropTable(
                name: "users");
        }
    }
}
