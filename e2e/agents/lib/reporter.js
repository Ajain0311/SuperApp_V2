import fs from 'node:fs';
import path from 'node:path';
import { median, percentile, redact } from './utils.js';

const STATUSES = ['PASS', 'FAIL', 'BLOCKED', 'SKIPPED', 'NOT_IMPLEMENTED', 'ERROR'];

export function summarize(results) {
  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  for (const r of results) counts[r.status] = (counts[r.status] || 0) + 1;
  const decided = results.filter((r) => r.status === 'PASS' || r.status === 'FAIL').length;
  const latencies = results.map((r) => r.latencyMs).filter((n) => typeof n === 'number');
  const failedReq = results.filter((r) => r.status === 'FAIL' || r.status === 'ERROR').length;
  return {
    total: results.length,
    ...counts,
    passPercentage: decided === 0 ? 0 : Math.round((counts.PASS / decided) * 1000) / 10,
    totalRequests: results.filter((r) => r.endpoint).length,
    failedRequests: failedReq,
    averageLatency: latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0,
    medianLatency: median(latencies),
    p95Latency: percentile(latencies, 95),
    p99Latency: percentile(latencies, 99),
  };
}

export function buildReport(meta, agents, results, matrix) {
  const summary = summarize(results);
  const bySuite = {};
  for (const r of results) {
    bySuite[r.suite] ??= [];
    bySuite[r.suite].push(r);
  }
  return { meta, summary, agents: agents.map(publicAgent), results: results.map((r) => ({ ...r, request: redact(r.request), response: redact(r.response) })), bySuite, matrix, security: results.filter((r) => r.security && r.status === 'FAIL') };
}

function publicAgent(a) {
  return {
    id: a.id,
    role: a.role,
    mobile: a.mobile,
    login: a.login,
    tests: a.counts.tests,
    passed: a.counts.passed,
    failed: a.counts.failed,
    resources: a.resources,
  };
}

function mdTable(headers, rows) {
  const head = `| ${headers.join(' | ')} |\n| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map((r) => `| ${r.join(' | ')} |`).join('\n');
  return `${head}\n${body}`;
}

export function toMarkdown(report) {
  const { meta, summary, agents, results, matrix } = report;
  const failures = results.filter((r) => r.status === 'FAIL' || r.status === 'ERROR');
  const missing = results.filter((r) => r.status === 'NOT_IMPLEMENTED');
  const slow = [...results].filter((r) => r.latencyMs).sort((a, b) => b.latencyMs - a.latencyMs).slice(0, 5);
  const suites = [...new Set(results.map((r) => r.suite))];

  const lines = [];
  lines.push('# SuperApp Live Multi-Agent Test Report');
  lines.push('');
  lines.push('## 1. Test Run Information');
  lines.push('');
  lines.push(`- Run ID: ${meta.runId}`);
  lines.push(`- Date/time: ${meta.startedAt}`);
  lines.push(`- Environment: ${meta.environment}`);
  lines.push(`- Base URL: ${meta.baseUrl}`);
  lines.push(`- Framework version: ${meta.version}`);
  lines.push(`- Scenario: ${meta.scenario}`);
  lines.push(`- Agents: ${agents.length}`);
  lines.push(`- Concurrency: ${meta.concurrency}`);
  lines.push(`- Duration: ${meta.durationMs} ms`);
  lines.push('');
  lines.push('## 2. Agent Summary');
  lines.push('');
  lines.push(mdTable(
    ['Agent', 'Role', 'Login', 'Tests', 'Passed', 'Failed'],
    agents.map((a) => [a.id, a.role, a.login, String(a.tests), String(a.passed), String(a.failed)]),
  ));
  lines.push('');
  lines.push('## 3. Overall Summary');
  lines.push('');
  lines.push(`- Total Tests: ${summary.total}`);
  lines.push(`- Passed: ${summary.PASS}`);
  lines.push(`- Failed: ${summary.FAIL}`);
  lines.push(`- Blocked: ${summary.BLOCKED}`);
  lines.push(`- Skipped: ${summary.SKIPPED}`);
  lines.push(`- Not Implemented: ${summary.NOT_IMPLEMENTED}`);
  lines.push(`- Errors: ${summary.ERROR}`);
  lines.push(`- Pass Percentage: ${summary.passPercentage}% (PASS / (PASS+FAIL))`);
  lines.push(`- Total Requests: ${summary.totalRequests}`);
  lines.push(`- Failed Requests: ${summary.failedRequests}`);
  lines.push(`- Average Latency: ${summary.averageLatency} ms`);
  lines.push(`- Median Latency: ${summary.medianLatency} ms`);
  lines.push(`- P95 Latency: ${summary.p95Latency} ms`);
  lines.push(`- P99 Latency: ${summary.p99Latency} ms`);
  lines.push('');
  lines.push('## 4. Feature Summary');
  lines.push('');
  for (const suite of suites) {
    const rows = results.filter((r) => r.suite === suite);
    const s = summarize(rows);
    lines.push(`### ${suite}`);
    lines.push(`PASS ${s.PASS} / FAIL ${s.FAIL} / BLOCKED ${s.BLOCKED} / NOT_IMPLEMENTED ${s.NOT_IMPLEMENTED} / ERROR ${s.ERROR}`);
    lines.push('');
  }
  lines.push('## 5. Security Findings');
  lines.push('');
  const sec = results.filter((r) => r.security);
  if (!sec.length) lines.push('No security checks were recorded.');
  for (const r of sec) {
    lines.push(`- Severity: ${r.status === 'FAIL' ? 'HIGH' : 'INFO'}`);
    lines.push(`  - Endpoint: ${r.method} ${r.endpoint}`);
    lines.push(`  - Agent: ${r.agent}`);
    lines.push(`  - Expected: ${JSON.stringify(r.expected)}`);
    lines.push(`  - Actual: ${r.actual}`);
    lines.push(`  - Evidence: ${r.details}`);
    lines.push('');
  }
  lines.push('## 6. Failed Tests');
  lines.push('');
  if (!failures.length) lines.push('None.');
  for (const r of failures) {
    lines.push(`- Test: ${r.scenario}`);
    lines.push(`  - Agent: ${r.agent}`);
    lines.push(`  - Endpoint: ${r.method} ${r.endpoint}`);
    lines.push(`  - Request: ${JSON.stringify(r.request)}`);
    lines.push(`  - Expected: ${JSON.stringify(r.expected)}`);
    lines.push(`  - Actual: ${r.actual}`);
    lines.push(`  - HTTP status: ${r.actual}`);
    lines.push(`  - Response: ${JSON.stringify(r.response)?.slice(0, 500)}`);
    lines.push(`  - Root-cause hint: ${r.hint || r.details}`);
    lines.push('');
  }
  lines.push('## 7. Blocked scenarios');
  lines.push('');
  const blocked = results.filter((r) => r.status === 'BLOCKED');
  if (!blocked.length) lines.push('None.');
  for (const r of blocked) lines.push(`- BLOCKED: ${r.agent} ${r.scenario} — ${r.details}`);
  lines.push('');
  lines.push('## 8. Not Implemented Features');
  lines.push('');
  if (!missing.length) lines.push('None.');
  for (const r of missing) lines.push(`- NOT_IMPLEMENTED: ${r.scenario} — ${r.details}`);
  lines.push('');
  lines.push('## 9. Performance Snapshot');
  lines.push('');
  lines.push(`- request count: ${summary.totalRequests}`);
  lines.push(`- average latency: ${summary.averageLatency} ms`);
  lines.push(`- median: ${summary.medianLatency} ms`);
  lines.push(`- p95: ${summary.p95Latency} ms`);
  lines.push(`- p99: ${summary.p99Latency} ms`);
  lines.push(`- error rate: ${summary.total ? Math.round((summary.failedRequests / summary.total) * 1000) / 10 : 0}%`);
  lines.push('- slowest requests:');
  for (const r of slow) lines.push(`  - ${r.latencyMs} ms ${r.method} ${r.endpoint} (${r.scenario})`);
  lines.push('');
  lines.push('## 10. Data Isolation Matrix');
  lines.push('');
  if (!matrix?.length) lines.push('No isolation matrix rows.');
  else {
    const cols = Object.keys(matrix[0]);
    lines.push(mdTable(cols, matrix.map((row) => cols.map((c) => String(row[c])))));
  }
  lines.push('');
  lines.push('## 11. Final Findings');
  lines.push('');
  if (!failures.length) {
    lines.push('No failing assertions were recorded in this run. This does not prove the product is free of defects outside the executed scenario.');
  } else {
    for (const r of failures) {
      lines.push(`- Issue: ${r.scenario}`);
      lines.push(`  - Evidence: expected ${JSON.stringify(r.expected)} actual ${r.actual}`);
      lines.push(`  - Affected endpoint: ${r.method} ${r.endpoint}`);
      lines.push(`  - Affected role: ${r.agent}`);
      lines.push(`  - Impact: ${r.security ? 'authorization or data isolation' : 'functional'}`);
      lines.push(`  - Suggested fix: ${r.hint || 'Inspect the controller authorization for this route.'}`);
      lines.push('');
    }
  }
  return lines.join('\n');
}

export function writeReports(report, reportDir) {
  fs.mkdirSync(reportDir, { recursive: true });
  const stamp = report.meta.runId;
  const folder = path.join(reportDir, stamp);
  fs.mkdirSync(folder, { recursive: true });
  const json = JSON.stringify(report, null, 2);
  const md = toMarkdown(report);
  const failures = report.results.filter((r) => r.status === 'FAIL' || r.status === 'ERROR');
  fs.writeFileSync(path.join(folder, 'report.json'), json);
  fs.writeFileSync(path.join(folder, 'report.md'), md);
  fs.writeFileSync(path.join(folder, 'failures.json'), JSON.stringify(failures, null, 2));
  fs.writeFileSync(path.join(reportDir, 'latest.json'), json);
  fs.writeFileSync(path.join(reportDir, 'latest.md'), md);
  return { folder, latest: path.join(reportDir, 'latest.md') };
}
