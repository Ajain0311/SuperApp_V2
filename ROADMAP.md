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
- **Status**: Continuous chaos W4/W5 added; new bugs fixed (pending deploy if not yet on VM).
  - New suites: `chaos-random-wave4.mjs`, `chaos-random-wave5.mjs`, `chaos-continuous-loop.mjs` (all waves × N seeds).
  - W4/W5 findings → fixes:
    - Marketplace `page`/`pageSize` negative → clamp (was HTTP 500 on Skip/Take).
    - Food order notes with U+0000 → `SanitizeNotes` strip (Postgres text 500).
    - Concurrent fav toggle unique race → catch `DbUpdateException` → 200 already-favorited.
    - Vendor `toggle-status` `{}` defaulted `IsOpen=false` and closed restaurant → `bool? IsOpen` required (same pattern as driver).
  - Live: restaurant 2 re-opened via API after W5 accidental close. Unit **195/195**.
  - Run: `node e2e/agents/chaos-continuous-loop.mjs [rounds]` or per-wave with seed.
  - Git preference: pull before commit/push; direct push to main when user asks (no MR).
