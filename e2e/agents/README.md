# SuperApp multi-agent live tests

One HTTP framework for concurrent CUSTOMER, RESTAURANT_OWNER, DRIVER, MARKETPLACE_SELLER, and ADMIN agents against the running SuperApp API. It does not replace Jest unit tests.

## Architecture

`runner.js` loads `config.example.json` plus optional `config.local.json`, creates independent agents, logs them in, asks the admin to attach DRIVER and MARKETPLACE_SELLER roles, then runs the flows named by the scenario. Each agent has its own token and API client. Results go through `lib/reporter.js`.

Routes match the ASP.NET controllers: `/api/FoodOrders`, `/api/vendor/orders`, `/api/driver/rides/{id}/accept`, `/api/marketplace/listings`, `/api/admin/*`, `/api/auth/*`.

## Volume

`npm run test:agents:volume` is a concurrent integration test, not a formal load test. Counts are flags, not hard-coded:

```bash
npm run test:agents:volume -- --customers 200 --restaurant-owners 20 --captains 40 --sellers 40 --concurrency 20
npm run test:agents:volume -- --customers 500 --restaurant-owners 50 --captains 100 --sellers 100 --concurrency 50 --cleanup
```

Also: `--run-id`, `--no-db`, `--cleanup`. Environment overrides when the flag is omitted: `AGENT_CUSTOMERS`, `AGENT_OWNERS`, `AGENT_CAPTAINS`, `AGENT_SELLERS`, `AGENT_CONCURRENCY`, `RUN_ID`, `AGENT_NO_DB=true`.

OTP provider is not changed by the runner. PunjabGov stays PunjabGov. A development API still accepts the documented test code when it is not Production. Do not point this at production.

## Overnight GitHub workflow

`.github/workflows/overnight-testing.yml` runs hourly from 22:00 to 09:00 IST (`30 16-23,0-3 * * *` UTC) and can be started with `workflow_dispatch`. The command is:

```bash
npm run test:agents:volume -- --customers 100 --restaurant-owners 10 --captains 20 --sellers 20 --concurrency 25 --cleanup
```

That is 100 customers plus 10 owners, 20 captains, 20 sellers, and the admin account. Concurrency is 25. Overlapping runs queue; a running test is not cancelled.

Required Actions secrets: `API_BASE_URL` (for example `https://makemytree.duckdns.org/api`; host allow-list removed so the scheduled job can hit the configured API), `ADMIN_PASSWORD`, `TEST_OTP`, and `SUPABASE_DB_URL` or `SUPABASE_CONNECTION`. Optional `ADMIN_MOBILE` overrides the example admin mobile. `ADMIN_EMAIL` is passed through but the runner logs the admin in with the mobile number, not email. The 100-user volume run mutates whatever database that API uses — keep `--cleanup` on and watch live data.

Each run uploads `e2e/agents/reports/` as `overnight-test-report-<run id>` for 14 days and writes a job summary. A single file that totals every hour of the night is not produced; those totals are not in the next job's workspace.

## When to run what

The Expo frontend is never required. These commands talk to the API, or to nothing.

| Mode | Backend | Frontend | Command |
| --- | --- | --- | --- |
| Self-test | off | off | `npm run test:agents:self` |
| Live test | on (`http://localhost:80`) | off | `npm run test:agents` |

Self-test only checks the framework (config, agents, assertions, reports, concurrency). It does not open a port.

Live test logs real agents into the API. Set `ADMIN_PASSWORD`. Do not change `OTP_PROVIDER` or set `OTP_TEST_MODE`. On Development, PunjabGov still accepts the probe code `123456` when `devOtp` is hidden. Do not start Expo.

## Configuration

Copy `e2e/agents/config.example.json` to `e2e/agents/config.local.json` if you need a non-default base URL. Do not commit that file.

Environment variables override the file:

- `API_BASE_URL` or `--base-url`
- `ADMIN_MOBILE` (default `9999999999`)
- `ADMIN_PASSWORD` (required for admin and role provisioning; not stored in git)
- `TEST_OTP` (for example `123456`) when `send-otp` hides `devOtp`
- `OTP_TEST_MODE=true` on the API process selects `MockOtpService` even if `OTP_PROVIDER=PunjabGov`

If `devOtp` is missing, the runner tries `TEST_OTP` or one development probe of `123456`. PunjabGov accepts that code when the API is not Production. A rejected probe is `BLOCKED` (real SMS or production). Downstream orders, rides, and listings are not called for that agent, so a missing JWT does not become a pile of 401 failures.

When `OTP_PROVIDER=PunjabGov`, the API hides `devOtp`. The runner does not switch the OTP provider. A rejected probe is a failed or blocked login. It does not invent a pass.

## How to run

```bash
node e2e/agents/runner.js
node e2e/agents/runner.js --scenario food-order
node e2e/agents/runner.js --scenario isolation
node e2e/agents/runner.js --scenario full-regression --customers 5 --restaurant-owners 2 --captains 3 --sellers 2
```

npm scripts: `test:agents`, `test:agents:food`, `test:agents:isolation`, `test:agents:full`.

Flags: `--base-url`, `--scenario`, `--customers`, `--restaurant-owners`, `--captains`, `--sellers`, `--concurrency`, `--timeout`, `--retries`, `--think-time`, `--ramp-up`, `--cleanup`, `--report`.

Cleanup is off unless `--cleanup` is passed. Cleanup only cancels this run's food orders and deletes this run's marketplace listings.

## Agent roles

| Role | Count flag | Login |
| --- | --- | --- |
| CUSTOMER | `--customers` | `POST /api/auth/send-otp` then `verify-otp` |
| RESTAURANT_OWNER | `--restaurant-owners` | same, then admin maps `RESTAURANT_OWNER` to a restaurant |
| DRIVER | `--captains` | same, then admin assigns `DRIVER` and verifies the driver |
| MARKETPLACE_SELLER | `--sellers` | same, then admin assigns `MARKETPLACE_SELLER` |
| ADMIN | one | `admin-login` with password and OTP |

Mobiles are 10-digit numbers derived from the run timestamp, so runs do not share accounts.

## Scenarios

JSON files in `scenarios/` name the flows. The runner map is:

- `auth`
- `food-order`
- `restaurant-isolation`
- `ride`
- `marketplace`
- `authorization`
- `admin`
- `isolation` (food, restaurant, ride, authorization)
- `full-regression` (all of the above)

## Concurrency

`--concurrency` limits the pool. `--ramp-up` delays each slot in milliseconds. `--think-time` pauses after a pooled call. This is a bounded functional run, not a load test.

## Isolation

Observed expectations from the current controllers:

- Another customer's `GET /api/FoodOrders/{id}` is **403**.
- A vendor status change for another restaurant is **403**.
- `POST /api/driver/rides/{id}/complete` for a ride owned by another driver is **404**.
- `POST /api/driver/rides/{id}/start` for that ride is **403**.
- Marketplace `EDIT` of another seller's listing is **403**.
- Admin routes without the ADMIN role are **403**.
- Missing or bad bearer tokens on `[Authorize]` routes are **401**.

`GET /api/FoodOrders/my-orders` is also checked so a foreign id is absent from the list.

## Reports

Each run writes `e2e/agents/reports/latest.md`, `latest.json`, and `reports/<run-id>/report.md`, `report.json`, `failures.json`. Tokens and passwords are redacted. `NOT_IMPLEMENTED` is not a failure. Expired-JWT minting is `NOT_IMPLEMENTED` because the signing key is not available to the client.

## Adding an agent

Add a file under `agents/` that exports HTTP helpers, create the role in `runner.js` `add(...)`, and call it from a flow in `lib/flows.js`.

## Adding a scenario

Add `scenarios/<name>.json`, register the name in `SCENARIOS` inside `runner.js`, and export the function from `FLOW_NAMES`.

## Troubleshooting

- Login fails with no `devOtp`: the API is on the Punjab SMS provider.
- Admin steps are `BLOCKED`: `ADMIN_PASSWORD` is empty.
- Food steps are `BLOCKED`: fewer than two active restaurants have an available menu item.
- Port 80 on Windows may require an elevated process for the API.

## Security

Do not point `--base-url` at production. CI runs self-tests only. Live calls create real orders, rides, and listings in whatever database the API uses.
