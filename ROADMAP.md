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
- **Status**: Continuous chaos/random live testing + 3 product hardening fixes.
  - Chaos suite wave1 seed=424242: **80/83 PASS**; caught (1) marketplace fake-favorite FK **500**, (2) weak PIN accepted `12`, (3) ride start 400 on missing ride/OTP.
  - Fixes: `ToggleFavorite` → 404 if listing missing; `UpsertAddressRequest` PIN `^\d{6}$`; chaos expects ride-start `[400,403,404]`.
  - New scripts: `e2e/agents/chaos-random-suite.mjs`, `e2e/agents/chaos-random-wave2.mjs`. Unit tests 194/194.
  - Next agent: keep running chaos waves with new seeds; re-verify AD01/M03 on production after deploy; optional 250/500 food stress.
  - Git preference: pull before commit/push; direct push to main when user asks (no MR).
