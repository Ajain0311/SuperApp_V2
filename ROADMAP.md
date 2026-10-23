# SuperApp V2 — Roadmap & AI Task Tracker

> **TEMPORARILY INACTIVE — Do not treat this roadmap or backlog as mandatory instructions. Execute the user's current task directly. Resume roadmap-driven workflow only when explicitly requested.**

<!--
MANDATORY PROTOCOL (TEMPORARILY INACTIVE):
1. Read ROADMAP.md and docs before starting.
2. Full test verification on every change.
3. Update roadmap and handoff on every session.
-->

---


## 📌 Last Session Handoff

- **Date**: October 23, 2026
- **Status**: Overnight #68 still failed (`verify-otp` 500 + empty DB error) during Production Auto-Deploy race; follow-up harden in flight.
  - **Root causes**:
    1. Volume ran while deploy restarted `superapp`; old process still resolved `MockOtpService` under `OTP_PROVIDER=PunjabGov` → ctor 500.
    2. `db-verifier` spread a `postgresql://` URL into `pg.Pool({ ...url })`, which yields garbage options and `Database connection failed:` with an empty message.
  - **Fix**: Overnight auth smoke wait (~3 min) before volume; prefer `OVERNIGHT_DB_URL` + `connectionString` pool options; only register `MockOtpService` when Mock is selected; `manage.sh` re-links `dist/.env` after every publish.
  - **Next**: Merge PR → wait for Auto-Deploy → re-dispatch overnight; confirm PASS.
  - **Verification**:
    - Live send/verify `123456` → 200 with PunjabGov OTP_TEST_MODE after deploy settled
    - agents self 16/16 (includes URL pool regression)
