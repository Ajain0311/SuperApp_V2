const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

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

const client = new Client({
  host: process.env.SUPABASE_HOST || 'aws-0-ap-northeast-1.pooler.supabase.com',
  port: parseInt(process.env.SUPABASE_PORT || '5432', 10),
  database: process.env.SUPABASE_DB || 'postgres',
  user: process.env.SUPABASE_USER || 'postgres.drhjfkqeiijdmyettumz',
  password: getDbPassword(),
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
