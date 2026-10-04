# Multi-agent live test — fix report

## High-volume database run (2026-09-29)

Scaled mutations live in `e2e/agents/lib/volume.js`. Postgres checks live in `e2e/agents/lib/db-verifier.js` and read the connection string from the environment or `.env`. The verifier does not print the password. `--cleanup` deletes only rows whose notes, title, address, or pickup contain the run id.

| Run | Agents | Result |
| --- | --- | --- |
| `run-mumxomyw` | 20 customers, 5 owners, 10 captains, 10 sellers | PASS 332, FAIL 0, cleanup PASS |
| `run-mumxrcvq` | 50 customers, 10 owners, 20 captains, 20 sellers | PASS 703, FAIL 0, NOT_IMPLEMENTED 0 |

`run-mumxrcvq` database: 197 row checks, 0 mismatches, 0 orphans. Concurrent inserts matched the database: 50 food orders, 20 rides, 20 listings. Cleanup left 0 of those rows. Expired JWT returned 401. Average latency 393 ms, median 408 ms. Duration 225 s. This is a concurrent integration test, not a formal load test.

One earlier 20-customer run (`run-mumxj6z7`) had a single HTTP 500. Cause: `FO-{1000-9999}` collided on the unique order-number index under parallel inserts. Food and ride numbers are now a 19-character guid prefix. That was rerun green.

Owners are mapped only to restaurants that already have a menu. The 50-customer run used the seeded menus (owners A–G were active in the log). Owners beyond that count are now recorded as BLOCKED instead of being skipped silently. That marker was added after `run-mumxrcvq`, so that run did not include the BLOCKED rows.

Date: 2026-09-29. Framework was not rewritten. Backend business rules were not changed.

## 1. Root cause of the login failures

`OTP_PROVIDER=PunjabGov` makes `POST /api/auth/send-otp` return `devOtp: null`. The runner treated a missing `devOtp` as a failed login **before** calling `verify-otp`, and recorded HTTP status `0`. Every later call then used no JWT and returned 401.

The API already accepts a development OTP outside Production:

- `OTP_TEST_MODE=true` selects `MockOtpService` and returns `devOtp`.
- `PunjabGovOtpService.VerifyOtpAsync` accepts `TEST_OTP` or `123456` when `ASPNETCORE_ENVIRONMENT` is not Production.

The runner now uses `devOtp`, then `TEST_OTP`, then one development probe of `123456`. If that probe is rejected, login is **BLOCKED** with send status, `devOtp available: false`, and the verify message. No JWT is invented. The password hash supplied for admin is not a login password. Admin login still needs `ADMIN_PASSWORD` (the app self-heals `Admin@123`).

## 2. Marketplace `.some` crash

`GET /api/marketplace/my-listings` returns `ApiResponse<List<ListingSummaryDto>>`. After a 401 the body is `{ success, message }`, which is not an array. `(dataOf(...) || []).some` threw because an object is truthy.

`payload()` unwraps `data` / `Data`. `asList()` accepts a raw array, `items` / `Items`, or a nested list, and returns `null` for a non-list. Call sites no longer call `.some` on a non-array.

## 3. Cascade handling

If an agent is not `PASS`, food, ride, marketplace, and role-boundary checks record one **BLOCKED** row: "Agent authentication failed; authenticated scenario was not executed." They do not keep calling the API and recording 401 as functional failures. Token-less security checks still run.

## 4. Framework changes

- `lib/auth.js` — OTP choice and PASS / FAIL / BLOCKED classification. OTP values are not logged.
- `lib/assertions.js` — `payload` and `asList`.
- `lib/flows.js` — `blockIfLoggedOut`, list-safe reads.
- `runner.js` — stores `authReason` and provisions drivers from `asList`.
- `selftest/response-shape.test.js` — unwrap, marketplace shape, blocked login, no cascade.
- `README.md`, `package.json` self-test file list.

## 5. Backend changes

None.

## 6. Commands and results

| Command | Result |
| --- | --- |
| `npm run test:agents:self` | 12/12 pass |
| `npm test -- --watchAll=false` | 13 suites, 73/73 pass |
| `npm run test:agents` | run-mumx6fw9: PASS 88, FAIL 0, BLOCKED 0, NOT_IMPLEMENTED 1 |
| `npm run test:agents:full -- --customers 5 --restaurant-owners 2 --captains 3 --sellers 2` | run-mumx7gos: PASS 97, FAIL 0, BLOCKED 0, NOT_IMPLEMENTED 1 |

Live API was `http://localhost:80` with `OTP_PROVIDER=Mock` for that process and `ADMIN_PASSWORD` set in the shell only. Frontend was not started. `--cleanup` was not passed.

### Larger run (`run-mumx7gos`)

| Area | Total | PASS | FAIL | BLOCKED | NOT_IMPLEMENTED |
| --- | ---: | ---: | ---: | ---: | ---: |
| Full regression | 98 | 97 | 0 | 0 | 1 |

Pass percentage is 100 of decided PASS+FAIL. The only non-pass is expired-JWT, marked NOT_IMPLEMENTED because the signing key is not on the client. It is not a failure. Extra checks now cover both seller edit directions, cross-delete, own delete, and captain offline.

## 7. Remaining

- **NOT_IMPLEMENTED:** expired JWT. The signing key is not available to the client.
- **BLOCKED** when the API is Production or rejects the test OTP, and when `ADMIN_PASSWORD` is unset.
- Customers C–E log in during the larger run but the food scenario still isolates A and B only.
- Captain C goes online; the ride pair uses captains A and B.

## 8. Security cleanup

No new secrets were committed. `config.example.json` still has an empty password. Reports redact token, password, and OTP fields.

`appsettings.Production.json` no longer contains a database password or JWT secret. Those values are placeholders. Set them with environment variables at deploy time. Root `.env` stays gitignored. The bcrypt hash pasted in chat is not stored in the framework. If the old production secret was ever pushed, rotate it in the host environment. The value is not repeated here.
