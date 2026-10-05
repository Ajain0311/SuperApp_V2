import fs from 'node:fs';
import path from 'node:path';

const reportDir = process.argv[2] || 'e2e/agents/reports';
const latestPath = path.join(reportDir, 'latest.json');
const dbPath = path.join(reportDir, 'latest-db-validation.json');

function readJson(file) {
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function count(results, status) {
  return (results || []).filter((row) => row.status === status).length;
}

function suiteStatus(rows) {
  if (!rows.length) return 'NOT_TESTED';
  if (rows.some((row) => row.status === 'FAIL' || row.status === 'ERROR')) return 'FAIL';
  if (rows.some((row) => row.status === 'BLOCKED')) return 'BLOCKED';
  if (rows.every((row) => row.status === 'PASS')) return 'PASS';
  return 'NOT_TESTED';
}

function cleanupStatus(cleanup) {
  if (cleanup == null || cleanup === 'not requested') return 'NOT_TESTED';
  if (cleanup.skipped) return 'SKIPPED';
  if (cleanup.status === 'CLEANUP_BLOCKED') return 'BLOCKED';
  if (!Array.isArray(cleanup) || !cleanup.length) return 'NOT_TESTED';
  if (cleanup.some((row) => row.result === 'FAIL')) return 'FAIL';
  if (cleanup.some((row) => row.result === 'CLEANUP_BLOCKED')) return 'BLOCKED';
  return cleanup.every((row) => row.result === 'PASS') ? 'PASS' : 'NOT_TESTED';
}

const report = readJson(latestPath);
const db = readJson(dbPath);
const lines = [];
lines.push('## Overnight SuperApp Test');
lines.push('');

if (!report) {
  lines.push('Status: FAIL');
  lines.push('');
  lines.push('The runner did not write `e2e/agents/reports/latest.json`. No counts were invented.');
  lines.push('');
  lines.push('Earlier hours in this IST window stay in their own artifacts. This job cannot see those files, so there is no consolidated overnight total.');
  process.stdout.write(`${lines.join('\n')}\n`);
  process.exit(0);
}

const results = report.results || [];
const summary = report.summary || {};
const failed = results.filter((row) => row.status === 'FAIL' || row.status === 'ERROR');
const isolation = results.filter((row) => row.suite === 'DATA_ISOLATION' || row.security);
const dbRows = results.filter((row) => row.suite === 'DATABASE');
const cleanupLabel = cleanupStatus(db?.cleanup);
const dbStatus = (db?.db?.mismatch > 0 || db?.db?.orphan > 0) ? 'FAIL' : suiteStatus(dbRows);
const failedCount = summary.FAIL || 0;
const errorCount = summary.ERROR || 0;
const status = failedCount + errorCount > 0 ? 'FAIL' : 'PASS';
const meta = report.meta || {};
const agents = report.agents || [];
const byRole = (role) => agents.filter((agent) => agent.role === role).length;

lines.push(`Status: ${status}`);
lines.push('');
lines.push('| Metric | Result |');
lines.push('| --- | --- |');
lines.push(`| Users | ${agents.length} |`);
lines.push(`| Customers | ${byRole('CUSTOMER')} |`);
lines.push(`| Restaurant owners | ${byRole('RESTAURANT_OWNER')} |`);
lines.push(`| Captains | ${byRole('DRIVER')} |`);
lines.push(`| Sellers | ${byRole('MARKETPLACE_SELLER')} |`);
lines.push(`| Concurrency | ${meta.concurrency ?? ''} |`);
lines.push(`| Passed | ${summary.PASS ?? count(results, 'PASS')} |`);
lines.push(`| Failed | ${failedCount} |`);
lines.push(`| Blocked | ${summary.BLOCKED ?? count(results, 'BLOCKED')} |`);
lines.push(`| Not Implemented | ${summary.NOT_IMPLEMENTED ?? count(results, 'NOT_IMPLEMENTED')} |`);
lines.push(`| Not Tested | ${count(results, 'NOT_TESTED')} |`);
lines.push(`| Duration | ${meta.durationMs ?? ''} ms |`);
lines.push(`| DB Verification | ${dbStatus} |`);
lines.push(`| Isolation | ${suiteStatus(isolation)} |`);
lines.push(`| Cleanup | ${cleanupLabel} |`);
lines.push('');
lines.push(`Run ID: ${meta.runId || ''}`);
lines.push(`Commit: ${process.env.GITHUB_SHA || ''}`);
lines.push(`Branch: ${process.env.GITHUB_REF_NAME || ''}`);
lines.push(`Actions run: ${process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : ''}`);
lines.push('');
lines.push('### Failed Scenarios');
lines.push('');
if (!failed.length) {
  lines.push('None.');
} else {
  for (const row of failed.slice(0, 40)) {
    const message = String(row.details || row.actual || row.status).replace(/\s+/g, ' ').slice(0, 240);
    lines.push(`- ${row.suite || ''} ${row.scenario || ''}: ${message}`);
  }
}
lines.push('');
lines.push('This artifact is one hourly run. A same-night total is not computed here because earlier report files are not in this workspace.');
process.stdout.write(`${lines.join('\n')}\n`);
