import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePgConnection } from '../lib/db-verifier.js';
import { signExpiredToken } from '../lib/jwt-test.js';

test('connection parser does not require a URL and ignores incomplete strings', () => {
  const parsed = parsePgConnection('Host=db.example;Port=5432;Database=postgres;Username=app;Password=secret;SSL Mode=Require');
  assert.equal(parsed.host, 'db.example');
  assert.equal(parsed.user, 'app');
  assert.equal(parsed.ssl.rejectUnauthorized, false);
  assert.equal(parsePgConnection('Host=only-host'), null);
});

test('expired token carries a past exp and does not echo the secret', () => {
  const token = signExpiredToken('test-secret-not-production');
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
  assert.ok(payload.exp < Math.floor(Date.now() / 1000));
  assert.equal(token.includes('test-secret-not-production'), false);
});
