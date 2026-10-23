/**
 * Continuous multi-wave chaos loop. Keeps inventing seeds until stopped.
 * Usage: node e2e/agents/chaos-continuous-loop.mjs [rounds=5]
 * Env: CHAOS_ROUNDS, CHAOS_START_SEED, API_BASE_URL, TEST_OTP
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROUNDS = parseInt(process.argv[2] || process.env.CHAOS_ROUNDS || '5', 10);
const START = parseInt(process.env.CHAOS_START_SEED || String(Date.now() % 1e9), 10);

const WAVES = [
  'chaos-random-suite.mjs',
  'chaos-random-wave2.mjs',
  'chaos-random-wave3.mjs',
  'chaos-random-wave4.mjs',
  'chaos-random-wave5.mjs',
  'chaos-random-wave6.mjs',
];

function run(script, seed) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(__dirname, script), String(seed)], {
      cwd: path.join(__dirname, '../..'),
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    child.stdout.on('data', (d) => {
      const s = d.toString();
      out += s;
      process.stdout.write(s);
    });
    child.stderr.on('data', (d) => {
      const s = d.toString();
      out += s;
      process.stderr.write(s);
    });
    child.on('close', (code) => {
      const m = out.match(/PASS=(\d+)\s+FAIL=(\d+)/);
      resolve({
        script,
        seed,
        code: code ?? 1,
        pass: m ? Number(m[1]) : null,
        fail: m ? Number(m[2]) : null,
      });
    });
  });
}

async function main() {
  console.log(`CONTINUOUS LOOP rounds=${ROUNDS} startSeed=${START} waves=${WAVES.length}`);
  const summary = [];
  for (let r = 0; r < ROUNDS; r++) {
    const seed = (START + r * 9973 + Math.floor(Math.random() * 1000)) % 1e9;
    console.log(`\n######## ROUND ${r + 1}/${ROUNDS} seed=${seed} ########`);
    for (const w of WAVES) {
      console.log(`\n---- ${w} seed=${seed} ----`);
      const res = await run(w, seed);
      summary.push(res);
      if (res.code !== 0) {
        console.log(`\n!! WAVE FAILED ${w} seed=${seed} code=${res.code} FAIL=${res.fail}`);
      }
    }
  }

  console.log('\n======== CONTINUOUS SUMMARY ========');
  let totalFail = 0;
  for (const s of summary) {
    const line = `${s.code === 0 ? 'OK' : 'BAD'} ${s.script} seed=${s.seed} PASS=${s.pass} FAIL=${s.fail}`;
    console.log(line);
    totalFail += s.fail || (s.code !== 0 ? 1 : 0);
  }
  console.log(`TOTAL_ROWS=${summary.length} AGG_FAIL_MARKERS=${totalFail}`);
  process.exit(totalFail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
