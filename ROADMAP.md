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
- **Status**: Chaos W8 invented + bugfixes shipping; continuous loop now W1–W8.
  - New suite: `e2e/agents/chaos-random-wave8.mjs` (profile junk, OTP flood, coupon/device-token, default-addr race, qty fuzz, ride extremes, offer-on-own, admin authz, vendor menu junk).
  - W8 live findings→fixes: device-token >500 / long platform → 400 (was 500); concurrent `SetDefault` atomic single-default; vendor `food-items` without restaurant → 403 (was 404).
  - Unit 196. Deploy after push: `sudo bash /opt/SuperApp_V2/scripts/manage.sh deploy v-<sha>`.
  - Run: `node e2e/agents/chaos-random-wave8.mjs [seed]` or `node e2e/agents/chaos-continuous-loop.mjs [rounds]`.
  - Git preference: pull before commit/push; direct push to main when user asks (no MR).
