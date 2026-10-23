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
- **Status**: Broadcast home marquee + admin DisplayHours live on API `v-55bafe5` (PR #30).
  - Home: glass marquee strip (`MarqueeText`); filters by `ReferenceId` `exp:…` (fallback CreatedAt + `broadcast_default_display_hours`).
  - Admin Settings + Dashboard: duration chips 1h/6h/12h/24h/48h/7d → `displayHours` on `POST /admin/notifications/broadcast`.
  - Backend: `SupportSettings.BroadcastDefaultHoursKey`, expiry token on Notification.ReferenceId.
  - Verified: `tsc`, 211 backend, 109 jest, agents self; health OK after deploy.
  - Actors: cust 7014065979 / 9123456780, owner 9900000004, captain 6375002348, TEST_OTP 123456.
  - PEM: `C:\Users\admin\.ssh\Bseries.pem`.
  - Next: Expo reload; admin se short-duration broadcast bhejo aur home marquee + expiry confirm karo.
