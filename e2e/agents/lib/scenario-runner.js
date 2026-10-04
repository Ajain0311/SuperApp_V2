import { payload } from './assertions.js';
import { mapPool, sleep } from './utils.js';

export function bindRecorder(results, agentsById) {
  return function record(agent, entry) {
    const row = {
      suite: entry.suite,
      agent: agent?.id || entry.agent || 'system',
      scenario: entry.scenario,
      endpoint: entry.endpoint || '',
      method: entry.method || '',
      expected: entry.expected,
      actual: entry.actual,
      status: entry.status,
      latencyMs: entry.latencyMs ?? entry.res?.latencyMs ?? 0,
      timestamp: new Date().toISOString(),
      details: entry.details || '',
      hint: entry.hint || '',
      security: !!entry.security,
      request: entry.request ?? null,
      response: entry.res ? (entry.res.data ?? entry.res.error) : entry.response ?? null,
    };
    results.push(row);
    if (agent?.counts) {
      agent.counts.tests += 1;
      if (row.status === 'PASS') agent.counts.passed += 1;
      if (row.status === 'FAIL' || row.status === 'ERROR') agent.counts.failed += 1;
    }
    const mark = row.status === 'PASS' ? 'PASS' : row.status;
    console.log(`[${mark}] ${row.agent} ${row.scenario} ${row.method} ${row.endpoint} -> ${row.actual}`);
    return row;
  };
}

export function expectHttp(record, agent, spec, res) {
  const expected = spec.expected;
  const match = Array.isArray(expected) ? expected.includes(res.status) : res.status === expected;
  let status = match ? 'PASS' : 'FAIL';
  if (res.status === 0) status = 'ERROR';
  if (res.status === 404 && spec.missingIs === 'NOT_IMPLEMENTED') status = 'NOT_IMPLEMENTED';
  return record(agent, { ...spec, res, actual: res.status, status });
}

export async function runParallel(items, concurrency, thinkTimeMs, rampUpMs, worker) {
  return mapPool(items, concurrency, async (item, index) => {
    if (rampUpMs) await sleep(rampUpMs * index);
    const result = await worker(item, index);
    if (thinkTimeMs) await sleep(thinkTimeMs);
    return result;
  });
}

export function dataOf(res) {
  return payload(res);
}
