const fs = require('fs');
const path = require('path');
const { Client } = require("pg");

function getDbPassword() {
  if (process.env.SUPABASE_PASSWORD) return process.env.SUPABASE_PASSWORD;
  if (process.env.DB_PASSWORD) return process.env.DB_PASSWORD;
  try {
    const envFile = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
    const match = envFile.match(/Password=([^;]+);/i);
    if (match && match[1]) return match[1];
  } catch (_) {}
  return process.env.SUPABASE_DB_PASSWORD || '';
}

const c = new Client({
  host: process.env.SUPABASE_HOST || "aws-0-ap-northeast-1.pooler.supabase.com",
  port: parseInt(process.env.SUPABASE_PORT || "5432", 10),
  database: process.env.SUPABASE_DB || "postgres",
  user: process.env.SUPABASE_USER || "postgres.drhjfkqeiijdmyettumz",
  password: getDbPassword(),
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await c.connect();
  await c.query("BEGIN");

  const h1 = await c.query(
    `insert into restaurant_categories (restaurant_id, name, description, sort_order, is_active, created_at)
     values (2, 'Thali', 'Full meals', 1, true, now()) returning id`
  );
  const h2 = await c.query(
    `insert into restaurant_categories (restaurant_id, name, description, sort_order, is_active, created_at)
     values (2, 'Sweets', 'Mithai', 2, true, now()) returning id`
  );
  const h3 = await c.query(
    `insert into restaurant_categories (restaurant_id, name, description, sort_order, is_active, created_at)
     values (2, 'Snacks', 'Namkeen and chaat', 3, true, now()) returning id`
  );
  const hid = { thali: h1.rows[0].id, sweets: h2.rows[0].id, snacks: h3.rows[0].id };

  const foods = [
    [1, 1, "Mutton Dum Biryani", "Slow cooked Hyderabadi mutton biryani", "https://images.unsplash.com/photo-1563379926898-05f4575a45d8?w=800", 420, 0, false, true, true],
    [2, 1, "Chicken 65 Starter Combo", "Spicy starter with dip", "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=800", 280, 10, false, true, false],
    [3, 1, "Gulab Jamun (2 pcs)", "Warm gulab jamun", "https://images.unsplash.com/photo-1666190092142-0614c1c2d3b0?w=800", 90, 0, true, true, false],
    [3, 1, "Qubani Ka Meetha", "Apricot dessert", "https://images.unsplash.com/photo-1488477181946-6428a8390956?w=800", 140, 0, true, true, false],
    [hid.thali, 2, "Deluxe Veg Thali", "Dal, paneer, roti, rice, sweet", "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800", 249, 5, true, true, true],
    [hid.thali, 2, "Raj Kachori Thali", "Chaat + mini thali", "https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=800", 199, 0, true, true, false],
    [hid.sweets, 2, "Rasgulla (4 pcs)", "Soft spongy rasgulla", "https://images.unsplash.com/photo-1668236543090-82eba5ee5972?w=800", 120, 0, true, true, true],
    [hid.sweets, 2, "Kaju Katli Box 250g", "Premium kaju katli", "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=800", 350, 8, true, true, false],
    [hid.snacks, 2, "Aloo Tikki Chaat", "Street style chaat", "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=800", 110, 0, true, true, false],
    [hid.snacks, 2, "Samosa (2 pcs)", "Crispy potato samosa", "https://images.unsplash.com/photo-1601050690117-94f5f6a16b1e?w=800", 50, 0, true, true, true],
  ];

  for (const [cat, rest, name, desc, img, price, disc, veg, avail, best] of foods) {
    await c.query(
      `insert into food_items (restaurant_category_id, restaurant_id, name, description, image_url, base_price, discount_percent, is_veg, is_available, is_bestseller, is_customizable, sort_order, is_active, created_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,false,0,true,now())`,
      [cat, rest, name, desc, img, price, disc, veg, avail, best]
    );
  }

  const r = await c.query(
    `insert into restaurants (name, description, image_url, phone, city, address_line, rating, total_ratings, is_veg, min_order_amount, delivery_fee, avg_delivery_time_minutes, is_active, is_featured, created_at)
     values ('Pizza Hub Indore', 'Wood fired pizza and pasta', 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800', '07314001234', 'Indore', 'Vijay Nagar, Indore', 4.3, 210, false, 149, 29, 35, true, true, now()) returning id`
  );
  const rid = r.rows[0].id;
  const pc = await c.query(
    `insert into restaurant_categories (restaurant_id, name, sort_order, is_active, created_at) values ($1, 'Pizzas', 1, true, now()) returning id`,
    [rid]
  );
  const pasta = await c.query(
    `insert into restaurant_categories (restaurant_id, name, sort_order, is_active, created_at) values ($1, 'Pasta', 2, true, now()) returning id`,
    [rid]
  );
  const pizzaFoods = [
    [pc.rows[0].id, "Margherita Pizza", "Classic cheese tomato", "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=800", 199, true, true],
    [pc.rows[0].id, "Farmhouse Pizza", "Veg loaded", "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800", 329, true, true],
    [pc.rows[0].id, "Chicken Pepperoni", "Non veg pepperoni", "https://images.unsplash.com/photo-1628840042765-356cda07504e?w=800", 399, false, true],
    [pasta.rows[0].id, "White Sauce Pasta", "Creamy pasta", "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=800", 249, true, false],
    [pasta.rows[0].id, "Arrabbiata Pasta", "Spicy red sauce", "https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=800", 229, true, false],
  ];
  for (const [cat, name, desc, img, price, veg, best] of pizzaFoods) {
    await c.query(
      `insert into food_items (restaurant_category_id, restaurant_id, name, description, image_url, base_price, discount_percent, is_veg, is_available, is_bestseller, is_customizable, sort_order, is_active, created_at)
       values ($1,$2,$3,$4,$5,$6,0,$7,true,$8,false,0,true,now())`,
      [cat, rid, name, desc, img, price, veg, best]
    );
  }

  const listings = [
    [3, 3, "Sony WH-1000XM5 Headphones", "Noise cancelling, 6 months old, bill included", 18999, "LIKE_NEW", "Vijay Nagar, Indore", true],
    [3, 1, "Samsung 55 inch 4K Smart TV", "Crystal UHD, wall mount included", 32000, "USED", "Palasia, Indore", false],
    [4, 2, "Solid Teakwood Dining Table (6 seater)", "Scratch-free, with 6 chairs", 18500, "USED", "Scheme 78, Indore", true],
    [4, 3, "IKEA Study Table + Chair", "White study combo", 4500, "LIKE_NEW", "Bhawarkua, Indore", false],
    [5, 3, "Nike Air Force 1 White (UK 8)", "Worn twice only", 5200, "LIKE_NEW", "MG Road, Indore", false],
    [5, 2, "Levis Denim Jacket L", "Classic blue denim", 1800, "USED", "Rajwada, Indore", false],
    [6, 1, "Atomic Habits + Ikigai Combo", "Paperback, almost new", 450, "LIKE_NEW", "Vijay Nagar, Indore", false],
    [6, 3, "NEET Biology Set (MTG)", "2025 edition, unused", 900, "NEW", "Geeta Bhawan, Indore", false],
    [7, 2, "Yonex Badminton Racket + Shuttle", "Astrox 99 copy with 10 shuttles", 2200, "USED", "AB Road, Indore", false],
    [7, 1, "Decathlon Gym Dumbbells 10kg pair", "Cast iron with grips", 1600, "USED", "Bhawarkua, Indore", false],
    [1, 2, "OnePlus Nord CE 3 128GB", "Aqua Silver, 90Hz, with box", 14500, "USED", "Palasia, Indore", true],
    [2, 3, "Honda Activa 6G 2023", "Single owner, 8k km", 72000, "USED", "MR 10, Indore", true],
    [8, 1, "Philips Air Fryer 4.1L", "Used 3 months, working perfect", 3800, "LIKE_NEW", "Vijay Nagar, Indore", false],
  ];

  for (const [cat, user, title, desc, price, cond, loc, feat] of listings) {
    const ins = await c.query(
      `insert into marketplace_listings (user_id, category_id, title, description, price, condition, location, latitude, longitude, status, is_featured, view_count, is_active, created_at)
       values ($1,$2,$3,$4,$5,$6,$7,22.7196,75.8577,'ACTIVE',$8,0,true,now()) returning id`,
      [user, cat, title, desc, price, cond, loc, feat]
    );
    const lid = ins.rows[0].id;
    const img = "https://picsum.photos/seed/listing" + lid + "/800/600";
    await c.query(
      `insert into listing_images (listing_id, image_url, sort_order, created_at) values ($1,$2,0,now())`,
      [lid, img]
    );
  }

  await c.query("COMMIT");
  const counts = await c.query(`select
    (select count(*)::int from restaurants) as restaurants,
    (select count(*)::int from food_items) as food_items,
    (select count(*)::int from marketplace_listings) as listings`);
  console.log("DONE", counts.rows[0]);
  await c.end();
}

main().catch(async (e) => {
  console.error(e);
  try {
    await c.query("ROLLBACK");
  } catch {}
  process.exit(1);
});
