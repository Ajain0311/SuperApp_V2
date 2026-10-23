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
- **Status**: Fixed overnight multi-agent auth (`verify-otp` 400) against live DuckDNS API.
  - **Root cause**: B-series `.env` had empty `TEST_OTP=` and no `OTP_TEST_MODE`; overnight sent `123456` while BIGB stored a random SMS OTP. Enabling `OTP_TEST_MODE` alone also broke auth by selecting `MockOtpService` while `OTP_PROVIDER=BIGB`.
  - **Fix**: Server `OTP_TEST_MODE=true` + `TEST_OTP=123456`; `Program.cs` keeps BIGB when provider is explicit; BIGB test-mode stores TEST_OTP and skips SMS; overnight workflow SSH-tunnels VM Postgres via `OVERNIGHT_DB_URL` + `VM_*` secrets.
  - **Next**: Confirm scheduled overnight run goes green after merge/deploy; watch DB verifier rows against azuredb tunnel.
  - **Verification**:
    - Live probe 2/1/1/1: all citizen + admin logins PASS
    - `dotnet test` 178/178; Jest 109/109; agents self 14/14; Metro 8081 up; `/health` Healthy
