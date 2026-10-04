import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createAgent } from '../lib/agent.js';
import { statusMatches } from '../lib/assertions.js';
import { loadConfig } from '../runner.js';
import { buildReport, summarize, toMarkdown, writeReports } from '../lib/reporter.js';
import { mapPool, mobileFor } from '../lib/utils.js';

test('config example has placeholders and no live password', () => {
  const config = loadConfig(path.join(import.meta.dirname, '..'));
  assert.equal(config.baseUrl, 'http://localhost:80');
  assert.equal(config.admin.password, '');
  const raw = fs.readFileSync(path.join(import.meta.dirname, '..', 'config.example.json'), 'utf8');
  assert.match(raw, /password/);
  assert.doesNotMatch(raw, /Adi@/);
});

test('agent creation keeps independent clients', () => {
  const a = createAgent({ id: 'customer-A', role: 'CUSTOMER', mobile: '9810000001', name: 'A', baseUrl: 'http://localhost', timeoutMs: 1000, retries: 0 });
  const b = createAgent({ id: 'customer-B', role: 'CUSTOMER', mobile: '9810000002', name: 'B', baseUrl: 'http://localhost', timeoutMs: 1000, retries: 0 });
  a.setToken('token-a');
  assert.equal(b.getToken?.() || b.client.getToken(), null);
  assert.equal(a.client.getToken(), 'token-a');
  assert.notEqual(mobileFor(123, 1, 0), mobileFor(123, 2, 0));
});

test('assertions accept the backend isolation statuses', () => {
  assert.equal(statusMatches(403, [403, 404]), true);
  assert.equal(statusMatches(200, [403, 404]), false);
  assert.equal(statusMatches(401, 401), true);
});

test('status calculation does not count NOT_IMPLEMENTED as failure', () => {
  const summary = summarize([
    { status: 'PASS', latencyMs: 10, endpoint: '/a' },
    { status: 'NOT_IMPLEMENTED', latencyMs: 0, endpoint: '/b' },
    { status: 'FAIL', latencyMs: 30, endpoint: '/c' },
  ]);
  assert.equal(summary.PASS, 1);
  assert.equal(summary.FAIL, 1);
  assert.equal(summary.NOT_IMPLEMENTED, 1);
  assert.equal(summary.passPercentage, 50);
});

test('report markdown contains the required sections', () => {
  const agent = createAgent({ id: 'customer-A', role: 'CUSTOMER', mobile: '9810000001', name: 'A', baseUrl: 'http://localhost', timeoutMs: 1000, retries: 0 });
  agent.login = 'PASS';
  const report = buildReport({
    runId: 'run-test',
    startedAt: '2026-09-29T00:00:00.000Z',
    environment: 'dev',
    baseUrl: 'http://localhost:80',
    version: '1.0.0',
    scenario: 'auth',
    concurrency: 2,
    durationMs: 5,
  }, [agent], [{
    suite: 'SECURITY',
    agent: 'customer-A',
    scenario: 'no-token',
    endpoint: '/api/FoodOrders/my-orders',
    method: 'GET',
    expected: 401,
    actual: 401,
    status: 'PASS',
    latencyMs: 12,
    timestamp: '2026-09-29T00:00:00.000Z',
    details: 'ok',
    security: true,
    request: { token: 'secret' },
  }], [{ Resource: 'Order 1', 'Customer A': 'ALLOW', 'Customer B': 'DENY' }]);
  const md = toMarkdown(report);
  assert.match(md, /# SuperApp Live Multi-Agent Test Report/);
  assert.match(md, /## 5. Security Findings/);
  assert.match(md, /## 10. Data Isolation Matrix/);
  assert.match(md, /## 7. Blocked scenarios/);
  assert.equal(report.results[0].request.token, '[redacted]');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agents-'));
  const written = writeReports(report, dir);
  const latest = JSON.parse(fs.readFileSync(path.join(dir, 'latest.json'), 'utf8'));
  assert.equal(latest.summary.PASS, 1);
  assert.equal(fs.existsSync(path.join(written.folder, 'failures.json')), true);
});

test('concurrency runs overlapping work', async () => {
  let active = 0;
  let max = 0;
  await mapPool([1, 2, 3, 4], 2, async () => {
    active += 1;
    max = Math.max(max, active);
    await new Promise((resolve) => setTimeout(resolve, 30));
    active -= 1;
  });
  assert.equal(max, 2);
});

test('failure handling records a non-200 without throwing', () => {
  const summary = summarize([{ status: 'ERROR', endpoint: '/api/auth/send-otp', latencyMs: 20 }]);
  assert.equal(summary.ERROR, 1);
  assert.equal(summary.failedRequests, 1);
});
