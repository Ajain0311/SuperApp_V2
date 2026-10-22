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

- **Date**: October 22, 2026
- **Status**: Fixed captain `/driver/available-rides` 500 that aborted Driver Home (food APIs were already 200).
  - **Root cause**: `chk_rides_status` omitted `EXPIRED` while stale-ride sweep wrote `EXPIRED` → Postgres 23514 → API 500 → `Promise.all` killed food UI.
  - **Fix**: Applied `database/migrations/20261022_rides_status_expired.sql` on B-series; RideExpiryBackgroundService expired 53 stale rides; hardened `GetAvailableRides` SaveChanges; Driver Home isolates ride fetch failures. Merged PR #18 (`b937269`) and redeployed.
  - **Next**: Captain hard-refresh / Online ON → confirm available-rides 200 and **Food Ready for Pickup** list; continue captain food pickup E2E if still needed.
  - **Verification**:
    - DriverTests 21/21; expiry-related 6/6; `npx tsc --noEmit` clean; driverService Jest 10/10
    - Prod health after deploy: check `/health` on makemytree.duckdns.org
