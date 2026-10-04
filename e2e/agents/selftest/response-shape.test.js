import test from 'node:test';
import assert from 'node:assert/strict';
import { asList, payload } from '../lib/assertions.js';
import { chooseOtp, classifyLogin } from '../lib/auth.js';
import { blockIfLoggedOut } from '../lib/flows.js';

test('unwraps ApiResponse data and paged items', () => {
  assert.deepEqual(payload({ data: { success: true, data: [{ id: 1 }] } }), [{ id: 1 }]);
  assert.deepEqual(payload({ data: { Data: { id: 9 } } }), { id: 9 });
  assert.equal(asList(payload({ data: { data: { items: [{ id: 3 }] } } }))[0].id, 3);
  assert.equal(asList({ Items: [{ id: 4 }] })[0].id, 4);
  assert.equal(asList({ message: 'no' }), null);
});

test('marketplace my-listings shape is a list inside data', () => {
  const body = { success: true, data: [{ id: 55, title: 'fan' }] };
  const rows = asList(payload({ data: body }));
  assert.equal(Array.isArray(rows), true);
  assert.equal(rows.some((row) => row.id === 55), true);
  const errorBody = { success: false, message: 'Unauthorized' };
  assert.equal(asList(payload({ data: errorBody })), null);
});

test('missing devOtp without TEST_OTP is a development probe, not a fake token', () => {
  const chosen = chooseOtp({ send: { status: 200, data: { success: true, devOtp: null } }, fallbackOtp: '', allowDevProbe: true });
  assert.equal(chosen.source, 'dev-probe');
  const blocked = classifyLogin({
    send: { status: 200, data: { success: true } },
    verify: { status: 400, data: { message: 'Invalid or expired OTP' } },
    otpSource: 'dev-probe',
  });
  assert.equal(blocked.login, 'BLOCKED');
  assert.match(blocked.reason, /devOtp available: false/);
});

test('explicit devOtp is preferred and a verify failure stays FAIL', () => {
  const chosen = chooseOtp({ send: { status: 200, data: { devOtp: '654321' } }, fallbackOtp: '123456', allowDevProbe: true });
  assert.equal(chosen.source, 'devOtp');
  const failed = classifyLogin({
    send: { status: 200, data: {} },
    verify: { status: 400, data: { message: 'Invalid or expired OTP' } },
    otpSource: 'devOtp',
  });
  assert.equal(failed.login, 'FAIL');
});

test('logged-out agents block the scenario once instead of calling the API', () => {
  const rows = [];
  const ctx = { record: (_agent, row) => rows.push(row) };
  const blocked = blockIfLoggedOut(ctx, 'FOOD_ORDER', 'place-cod-order', [{ id: 'customer-A', login: 'BLOCKED', authReason: 'no otp' }]);
  assert.equal(blocked, true);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, 'BLOCKED');
  assert.match(rows[0].details, /authenticated scenario was not executed/);
});
