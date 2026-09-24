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

async function ensureRestaurant(row) {
  const existing = await c.query("select id from restaurants where name = $1", [row.name]);
  if (existing.rows[0]) return existing.rows[0].id;
  const ins = await c.query(
    `insert into restaurants (name, description, image_url, phone, city, address_line, rating, total_ratings, is_veg, min_order_amount, delivery_fee, avg_delivery_time_minutes, is_active, is_featured, created_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,true,$13,now()) returning id`,
    [
      row.name,
      row.description,
      row.image,
      row.phone,
      row.city,
      row.address,
      row.rating,
      row.ratings,
      row.veg,
      row.minOrder,
      row.fee,
      row.mins,
      row.featured,
    ]
  );
  return ins.rows[0].id;
}

async function ensureCategory(restaurantId, name, sort) {
  const existing = await c.query(
    "select id from restaurant_categories where restaurant_id = $1 and name = $2",
    [restaurantId, name]
  );
  if (existing.rows[0]) return existing.rows[0].id;
  const ins = await c.query(
    `insert into restaurant_categories (restaurant_id, name, sort_order, is_active, created_at)
     values ($1,$2,$3,true,now()) returning id`,
    [restaurantId, name, sort]
  );
  return ins.rows[0].id;
}

async function ensureFood(catId, restId, item) {
  const existing = await c.query(
    "select id from food_items where restaurant_id = $1 and name = $2",
    [restId, item.name]
  );
  if (existing.rows[0]) return;
  await c.query(
    `insert into food_items (restaurant_category_id, restaurant_id, name, description, image_url, base_price, discount_percent, is_veg, is_available, is_bestseller, is_customizable, sort_order, is_active, created_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,true,$9,false,0,true,now())`,
    [
      catId,
      restId,
      item.name,
      item.desc,
      item.img,
      item.price,
      item.disc || 0,
      item.veg,
      item.best || false,
    ]
  );
}

async function main() {
  await c.connect();
  await c.query("BEGIN");

  const meghana = (await c.query("select id from restaurants where id = 1")).rows[0].id;
  const starters = await ensureCategory(meghana, "Starters", 2);
  const desserts = await ensureCategory(meghana, "Desserts", 3);
  await ensureFood(starters, meghana, {
    name: "Apollo Fish Fry",
    desc: "Flaky fillets fried crisp and tossed in spiced yogurt seasoning.",
    img: "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=800",
    price: 360,
    veg: false,
  });
  await ensureFood(desserts, meghana, {
    name: "Gulab Jamun with Rabri",
    desc: "Warm reduced milk dumplings served with chilled saffron rabri.",
    img: "https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=800",
    price: 110,
    veg: true,
  });

  const restaurants = [
    {
      name: "Burger King (Gourmet Burgers)",
      description: "Burgers • American • Fast Food • Shakes",
      image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800",
      phone: "07314005501",
      city: "New Delhi",
      address: "Connaught Place, New Delhi",
      rating: 4.3,
      ratings: 2150,
      veg: false,
      minOrder: 150,
      fee: 0,
      mins: 25,
      featured: false,
      cats: {
        Burgers: [
          { name: "Whopper", desc: "Flame grilled beef/veg patty with fresh veggies", img: "https://images.unsplash.com/photo-1550547660-d9450f859349?w=800", price: 199, veg: false, best: true },
          { name: "Veg Crunchy Burger", desc: "Crispy veg patty with mayo", img: "https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=800", price: 129, veg: true },
          { name: "Chicken Tandoor Grill", desc: "Tandoori chicken burger", img: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800", price: 179, veg: false, best: true },
        ],
        Sides: [
          { name: "King Fries Regular", desc: "Salted fries", img: "https://images.unsplash.com/photo-1576107232684-1279f390859f?w=800", price: 89, veg: true },
          { name: "Peri Peri Fries", desc: "Spiced fries", img: "https://images.unsplash.com/photo-1630384060421-cb20d0e3b275?w=800", price: 109, veg: true },
        ],
        Shakes: [
          { name: "Chocolate Thick Shake", desc: "Rich chocolate shake", img: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=800", price: 149, veg: true },
        ],
      },
    },
    {
      name: "Dosa Plaza (South Indian)",
      description: "South Indian • Dosa • Idli • Filter Coffee",
      image: "https://images.unsplash.com/photo-1668236543090-82eba5ee5972?w=800",
      phone: "07314005502",
      city: "New Delhi",
      address: "Karol Bagh, New Delhi",
      rating: 4.4,
      ratings: 980,
      veg: true,
      minOrder: 120,
      fee: 20,
      mins: 28,
      featured: true,
      cats: {
        Dosas: [
          { name: "Masala Dosa", desc: "Crispy dosa with potato masala", img: "https://images.unsplash.com/photo-1668236543090-82eba5ee5972?w=800", price: 140, veg: true, best: true },
          { name: "Mysore Masala Dosa", desc: "Red chutney dosa", img: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=800", price: 160, veg: true },
          { name: "Cheese Onion Dosa", desc: "Loaded cheese dosa", img: "https://images.unsplash.com/photo-1630384060421-cb20d0e3b275?w=800", price: 180, veg: true },
        ],
        Tiffin: [
          { name: "Idli Sambar (3 pcs)", desc: "Soft idli with sambar", img: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=800", price: 90, veg: true, best: true },
          { name: "Medu Vada (2 pcs)", desc: "Crispy urad vada", img: "https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=800", price: 80, veg: true },
        ],
        Beverages: [
          { name: "Filter Coffee", desc: "South Indian filter coffee", img: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800", price: 60, veg: true },
        ],
      },
    },
    {
      name: "Roll Junction",
      description: "Rolls • Kathi • Street Food",
      image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=800",
      phone: "07314005503",
      city: "New Delhi",
      address: "Chandni Chowk, New Delhi",
      rating: 4.2,
      ratings: 640,
      veg: false,
      minOrder: 99,
      fee: 25,
      mins: 20,
      featured: false,
      cats: {
        Rolls: [
          { name: "Egg Chicken Kathi Roll", desc: "Kolkata style kathi roll", img: "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=800", price: 160, veg: false, best: true },
          { name: "Paneer Tikka Roll", desc: "Spiced paneer wrap", img: "https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=800", price: 140, veg: true, best: true },
          { name: "Mutton Seekh Roll", desc: "Seekh kebab roll", img: "https://images.unsplash.com/photo-1603360946369-dc9bb6258143?w=800", price: 190, veg: false },
        ],
        Sides: [
          { name: "Masala Coke", desc: "Street masala soda", img: "https://images.unsplash.com/photo-1629203851122-3726ecdf080e?w=800", price: 50, veg: true },
        ],
      },
    },
    {
      name: "Sweet Tooth Desserts",
      description: "Desserts • Cakes • Ice Cream",
      image: "https://images.unsplash.com/photo-1488477181946-6428a8390956?w=800",
      phone: "07314005504",
      city: "New Delhi",
      address: "Khan Market, New Delhi",
      rating: 4.6,
      ratings: 410,
      veg: true,
      minOrder: 80,
      fee: 30,
      mins: 22,
      featured: false,
      cats: {
        Cakes: [
          { name: "Chocolate Truffle Slice", desc: "Rich ganache slice", img: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800", price: 180, veg: true, best: true },
          { name: "Red Velvet Slice", desc: "Cream cheese frosting", img: "https://images.unsplash.com/photo-1586985289688-ca3cf47d3e6e?w=800", price: 190, veg: true },
        ],
        "Ice Cream": [
          { name: "Brownie Fudge Sundae", desc: "Hot brownie with vanilla", img: "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=800", price: 160, veg: true, best: true },
          { name: "Kulfi Falooda", desc: "Royal falooda kulfi", img: "https://images.unsplash.com/photo-1488477181946-6428a8390956?w=800", price: 140, veg: true },
        ],
      },
    },
  ];

  for (const r of restaurants) {
    const id = await ensureRestaurant(r);
    let sort = 1;
    for (const [catName, items] of Object.entries(r.cats)) {
      const catId = await ensureCategory(id, catName, sort++);
      for (const item of items) {
        await ensureFood(catId, id, item);
      }
    }
  }

  await c.query("COMMIT");
  const counts = await c.query(`select
    (select count(*)::int from restaurants) as restaurants,
    (select count(*)::int from food_items) as food_items,
    (select json_agg(x) from (
      select r.name, count(f.id)::int as items
      from restaurants r
      left join food_items f on f.restaurant_id = r.id
      group by r.name order by r.name
    ) x) as per_restaurant`);
  console.log(JSON.stringify(counts.rows[0], null, 2));
  await c.end();
}

main().catch(async (e) => {
  console.error(e);
  try {
    await c.query("ROLLBACK");
  } catch {}
  process.exit(1);
});
