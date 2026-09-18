const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const client = new Client({
  host: 'aws-0-ap-northeast-1.pooler.supabase.com',
  port: 5432,
  database: 'postgres',
  user: 'postgres.drhjfkqeiijdmyettumz',
  password: 'Adi@supabase123!',
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const apply = process.argv.includes('--apply');
  await client.connect();
  console.log('CONNECTED');

  const tables = await client.query(
    "select to_regclass('public.users') as users, to_regclass('public.roles') as roles"
  );
  console.log('TABLES', JSON.stringify(tables.rows[0]));

  const missing = !tables.rows[0].users || !tables.rows[0].roles;
  if (missing && apply) {
    const sqlPath = path.join(__dirname, '..', 'database', 'SuperApp_Supabase.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.log('APPLYING_SCHEMA', sqlPath);
    await client.query(sql);
    console.log('SCHEMA_APPLIED');
  } else if (missing) {
    console.log('SCHEMA_MISSING');
  } else {
    const admin = await client.query(
      "select id, mobile_number, full_name, is_active from users where mobile_number = '9999999999'"
    );
    console.log('ADMIN', JSON.stringify(admin.rows));
  }

  await client.end();
}

main().catch((err) => {
  console.error('ERR', err.message);
  process.exit(1);
});
