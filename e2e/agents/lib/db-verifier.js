import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

export function parsePgConnection(raw) {
  if (!raw) return null;
  if (raw.startsWith('postgres://') || raw.startsWith('postgresql://')) return raw;
  const map = {};
  for (const part of raw.split(';')) {
    const index = part.indexOf('=');
    if (index < 1) continue;
    map[part.slice(0, index).trim().toLowerCase()] = part.slice(index + 1).trim();
  }
  const host = map.host;
  const user = map.username || map.user || map['user id'];
  const database = map.database;
  if (!host || !user || !database || !map.password) return null;
  return {
    host,
    port: Number(map.port || 5432),
    user,
    password: map.password,
    database,
    ssl: /require/i.test(map['ssl mode'] || '') ? { rejectUnauthorized: false } : undefined,
  };
}

export function loadDotEnv(file = path.resolve(process.cwd(), '.env')) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#') || !line.includes('=')) continue;
    const index = line.indexOf('=');
    const key = line.slice(0, index).trim();
    if (!process.env[key]) process.env[key] = line.slice(index + 1).trim();
  }
}

export function connectionFromEnv() {
  loadDotEnv();
  // Prefer overnight tunnel URL when set (same DB the live API uses on B-series).
  return process.env.OVERNIGHT_DB_URL
    || process.env.SUPABASE_DB_URL
    || process.env.ConnectionStrings__SupabaseConnection
    || process.env.DATABASE_URL
    || '';
}

/** Build node-postgres Pool options from parsePgConnection output (URL string or object). */
export function poolOptionsFromParsed(config, extras = {}) {
  const base = { max: 4, connectionTimeoutMillis: 8000, ...extras };
  if (typeof config === 'string') {
    return { connectionString: config, ...base };
  }
  return { ...config, ...base };
}

export async function openVerifier() {
  const raw = connectionFromEnv();
  const config = parsePgConnection(raw);
  if (!config) return { ok: false, reason: 'No database connection string in the environment' };
  // URL strings must use connectionString — spreading a string yields {0:'p',1:'o',...} and silent connect failures.
  const pool = new pg.Pool(poolOptionsFromParsed(config));
  try {
    await pool.query('select 1');
  } catch (err) {
    await pool.end().catch(() => {});
    return { ok: false, reason: `Database connection failed: ${err.message || err.code || String(err)}` };
  }
  return {
    ok: true,
    async query(text, params) {
      const started = Date.now();
      const result = await pool.query(text, params);
      return { rows: result.rows, durationMs: Date.now() - started };
    },
    async close() {
      await pool.end();
    },
  };
}

export async function countWhere(db, table, column, value) {
  const result = await db.query(`select count(*)::int as n from ${table} where ${column} like $1`, [`%${value}%`]);
  return result.rows[0].n;
}
