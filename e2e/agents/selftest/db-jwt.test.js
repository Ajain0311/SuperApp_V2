import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePgConnection, poolOptionsFromParsed } from '../lib/db-verifier.js';
import { signExpiredToken } from '../lib/jwt-test.js';

test('connection parser does not require a URL and ignores incomplete strings', () => {
  const parsed = parsePgConnection('Host=db.example;Port=5432;Database=postgres;Username=app;Password=secret;SSL Mode=Require');
  assert.equal(parsed.host, 'db.example');
  assert.equal(parsed.user, 'app');
  assert.equal(parsed.ssl.rejectUnauthorized, false);
  assert.equal(parsePgConnection('Host=only-host'), null);
});

test('pool options keep postgresql URL as connectionString (do not spread the string)', () => {
  const url = 'postgresql://azuredbuser:secret@127.0.0.1:5433/azuredb';
  assert.equal(parsePgConnection(url), url);
  const opts = poolOptionsFromParsed(url);
  assert.equal(opts.connectionString, url);
  assert.equal(opts.max, 4);
  assert.equal(opts[0], undefined);
});

test('pool options spread ADO-style object fields', () => {
  const parsed = parsePgConnection('Host=db.example;Port=5432;Database=postgres;Username=app;Password=secret');
  const opts = poolOptionsFromParsed(parsed);
  assert.equal(opts.host, 'db.example');
  assert.equal(opts.user, 'app');
  assert.equal(opts.max, 4);
});

test('expired token carries a past exp and does not echo the secret', () => {
  const token = signExpiredToken('test-secret-not-production');
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
  assert.ok(payload.exp < Math.floor(Date.now() / 1000));
  assert.equal(token.includes('test-secret-not-production'), false);
});
