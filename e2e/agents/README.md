# SuperApp multi-agent live tests

One HTTP framework for concurrent CUSTOMER, RESTAURANT_OWNER, DRIVER, MARKETPLACE_SELLER, and ADMIN agents against the running SuperApp API. It does not replace Jest unit tests.

## Architecture

`runner.js` loads `config.example.json` plus optional `config.local.json`, creates independent agents, logs them in, asks the admin to attach DRIVER and MARKETPLACE_SELLER roles, then runs the flows named by the scenario. Each agent has its own token and API client. Results go through `lib/reporter.js`.

Routes match the ASP.NET controllers: `/api/FoodOrders`, `/api/vendor/orders`, `/api/driver/rides/{id}/accept`, `/api/marketplace/listings`, `/api/admin/*`, `/api/auth/*`.

## Installation

From the repository root, after `npm install`:

```bash
npm run test:agents:self
```

Live runs need the API already listening, usually `http://localhost:80`.

## Configuration

Copy `e2e/agents/config.example.json` to `e2e/agents/config.local.json` if you need a non-default base URL. Do not commit that file.

Environment variables override the file:

- `API_BASE_URL` or `--base-url`
- `ADMIN_MOBILE` (default `9999999999`)
- `ADMIN_PASSWORD` (required for admin and role provisioning; not stored in git)
- `TEST_OTP` only when `send-otp` does not return `devOtp`

When `OTP_PROVIDER=PunjabGov`, the API hides `devOtp`. Citizen login then needs a real OTP or a temporary switch to the mock OTP provider. The framework records that as a failed or blocked login. It does not invent a pass.

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
