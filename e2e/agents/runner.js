import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAgent } from './lib/agent.js';
import { loginAdmin, loginCitizen } from './lib/auth.js';
import { FLOW_NAMES, cleanupRun } from './lib/flows.js';
import { createLogger } from './lib/logger.js';
import { buildReport, writeReports } from './lib/reporter.js';
import { bindRecorder, runParallel } from './lib/scenario-runner.js';
import { FRAMEWORK_VERSION, createRunId, letterLabel, mobileFor } from './lib/utils.js';
import { adminActions } from './agents/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SCENARIOS = {
  auth: ['auth'],
  'food-order': ['food-order'],
  'restaurant-isolation': ['restaurant-isolation'],
  ride: ['ride'],
  marketplace: ['marketplace'],
  authorization: ['authorization'],
  admin: ['admin'],
  isolation: ['food-order', 'restaurant-isolation', 'ride', 'authorization'],
  'full-regression': ['auth', 'food-order', 'restaurant-isolation', 'ride', 'marketplace', 'admin', 'authorization'],
};

function parseArgs(argv) {
  const out = {
    scenario: 'full-regression',
    customers: 2,
    restaurantOwners: 2,
    captains: 2,
    sellers: 2,
    concurrency: 4,
    timeout: 20000,
    retries: 1,
    cleanup: false,
    thinkTimeMs: 0,
    rampUpMs: 0,
    baseUrl: process.env.API_BASE_URL || '',
    report: path.join(__dirname, 'reports'),
  };
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    const next = argv[i + 1];
    const take = () => argv[++i];
    if (key === '--scenario') out.scenario = take();
    else if (key === '--customers') out.customers = Number(take());
    else if (key === '--restaurant-owners') out.restaurantOwners = Number(take());
    else if (key === '--captains') out.captains = Number(take());
    else if (key === '--sellers') out.sellers = Number(take());
    else if (key === '--concurrency') out.concurrency = Number(take());
    else if (key === '--timeout') out.timeout = Number(take());
    else if (key === '--retries') out.retries = Number(take());
    else if (key === '--base-url') out.baseUrl = take();
    else if (key === '--report') out.report = take();
    else if (key === '--think-time') out.thinkTimeMs = Number(take());
    else if (key === '--ramp-up') out.rampUpMs = Number(take());
    else if (key === '--cleanup') out.cleanup = true;
    else if (key === '--help') out.help = true;
    else if (next && key.startsWith('--')) throw new Error(`Unknown argument ${key}`);
  }
  return out;
}

export function loadConfig(dir = __dirname) {
  const example = JSON.parse(fs.readFileSync(path.join(dir, 'config.example.json'), 'utf8'));
  const localPath = path.join(dir, 'config.local.json');
  const local = fs.existsSync(localPath) ? JSON.parse(fs.readFileSync(localPath, 'utf8')) : {};
  return {
    ...example,
    ...local,
    admin: { ...example.admin, ...(local.admin || {}) },
  };
}

function applyTemplate(value, vars) {
  return String(value).replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
}

async function authenticate(agent, config) {
  const fallbackOtp = process.env.TEST_OTP || config.testOtp || '';
  if (agent.role === 'ADMIN') {
    const password = process.env.ADMIN_PASSWORD || config.admin.password;
    if (!password) {
      agent.login = 'BLOCKED';
      return;
    }
    const result = await loginAdmin(agent.client, {
      mobile: agent.mobile,
      password,
      fallbackOtp,
    });
    if (result.ok) {
      agent.setToken(result.verify.data.token);
      agent.user = result.verify.data.user;
      agent.login = 'PASS';
    } else {
      agent.login = 'FAIL';
    }
    return;
  }
  const result = await loginCitizen(agent.client, {
    mobile: agent.mobile,
    fullName: agent.name,
    fallbackOtp,
  });
  if (result.ok) {
    agent.setToken(result.verify.data.token);
    agent.user = result.verify.data.user;
    agent.login = 'PASS';
  } else {
    agent.login = 'FAIL';
  }
}

async function provision(ctx) {
  const admin = ctx.agents.find((a) => a.role === 'ADMIN' && a.login === 'PASS');
  if (!admin) return;
  const drivers = ctx.agents.filter((a) => a.role === 'DRIVER' && a.login === 'PASS');
  const sellers = ctx.agents.filter((a) => a.role === 'MARKETPLACE_SELLER' && a.login === 'PASS');
  for (const driver of drivers) {
    await adminActions.assignRole(admin, driver.user.id, 'DRIVER');
  }
  const fleet = await adminActions.drivers(admin);
  const rows = fleet.data?.data || [];
  for (const driver of drivers) {
    const row = rows.find((item) => item.userId === driver.user.id);
    if (row?.id) {
      driver.resources.driverId = row.id;
      await adminActions.verifyDriver(admin, row.id);
    }
    await authenticate(driver, ctx.config);
  }
  for (const seller of sellers) {
    await adminActions.assignRole(admin, seller.user.id, 'MARKETPLACE_SELLER');
    await authenticate(seller, ctx.config);
  }
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log('node e2e/agents/runner.js --scenario full-regression --customers 2 --restaurant-owners 2 --captains 2 --sellers 2');
    return 0;
  }
  const flows = SCENARIOS[args.scenario];
  if (!flows) {
    console.error(`Unknown scenario ${args.scenario}. Known: ${Object.keys(SCENARIOS).join(', ')}`);
    return 2;
  }
  const config = loadConfig();
  const baseUrl = args.baseUrl || config.baseUrl;
  const log = createLogger();
  const runId = createRunId();
  const stamp = Date.now();
  const common = { baseUrl, timeoutMs: args.timeout, retries: args.retries };
  const agents = [];
  const add = (count, role, digit) => {
    for (let i = 0; i < count; i++) {
      const label = letterLabel(i);
      agents.push(createAgent({
        id: `${role.toLowerCase()}-${label}`,
        role,
        mobile: mobileFor(stamp, digit, i),
        name: `${role} ${label} ${runId}`,
        ...common,
      }));
    }
  };
  add(args.customers, 'CUSTOMER', 1);
  add(args.restaurantOwners, 'RESTAURANT_OWNER', 2);
  add(args.captains, 'DRIVER', 3);
  add(args.sellers, 'MARKETPLACE_SELLER', 4);
  agents.push(createAgent({
    id: 'admin',
    role: 'ADMIN',
    mobile: process.env.ADMIN_MOBILE || config.admin.mobile,
    name: 'Super Admin',
    ...common,
  }));

  log.info(`SuperApp agents ${FRAMEWORK_VERSION} ${runId} -> ${baseUrl} scenario=${args.scenario}`);
  const started = Date.now();
  await runParallel(agents, args.concurrency, args.thinkTimeMs, args.rampUpMs, (agent) => authenticate(agent, config));
  const results = [];
  const ctx = {
    agents,
    config,
    runId,
    concurrency: args.concurrency,
    thinkTimeMs: args.thinkTimeMs,
    rampUpMs: args.rampUpMs,
    cleanup: args.cleanup,
    shared: {},
    matrix: [],
    record: bindRecorder(results, null),
  };
  await provision(ctx);
  for (const name of flows) {
    log.info(`-- ${name}`);
    await FLOW_NAMES[name](ctx);
  }
  await cleanupRun(ctx);
  const report = buildReport({
    runId,
    startedAt: new Date(started).toISOString(),
    environment: process.env.EXPO_PUBLIC_ENV || 'dev',
    baseUrl,
    version: FRAMEWORK_VERSION,
    scenario: args.scenario,
    concurrency: args.concurrency,
    durationMs: Date.now() - started,
    cleanup: args.cleanup,
  }, agents, results, ctx.matrix);
  const written = writeReports(report, args.report);
  log.info(`Report ${written.latest}`);
  log.info(`PASS ${report.summary.PASS} FAIL ${report.summary.FAIL} BLOCKED ${report.summary.BLOCKED} NOT_IMPLEMENTED ${report.summary.NOT_IMPLEMENTED}`);
  return report.summary.FAIL > 0 || report.summary.ERROR > 0 ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then((code) => process.exit(code)).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

void applyTemplate;
