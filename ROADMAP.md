# SuperApp V2 — Roadmap & AI Task Tracker

> 🤖 **MANDATORY PROTOCOL FOR ALL AI AGENTS & DEVELOPERS**
>
> **BEFORE WRITING OR MODIFYING ANY CODE:**
> 1. **Read this file (`ROADMAP.md`) first**: Check current project state, active priorities, and the immediate next task.
> 2. **Check canonical docs in `docs/`**: Adhere strictly to [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/DATABASE.md`](docs/DATABASE.md), [`docs/API.md`](docs/API.md), and [`docs/ROLES_AND_PERMISSIONS.md`](docs/ROLES_AND_PERMISSIONS.md).
> 3. **Zero-Cost Constraint**: Do NOT introduce paid third-party APIs (no Google Maps API, no Redis/RabbitMQ/Kafka clusters).
>
> **AFTER COMPLETING ANY CODE CHANGE:**
> 1. **Run full verification pipeline**:
>    - `dotnet test backend/SuperApp.API.Tests/SuperApp.API.Tests.csproj`
>    - `npx tsc --noEmit`
>    - `npm test -- --watchAll=false`
>    - `npx expo-doctor`
>    - `npm run test:agents:self` (live `test:agents` is opt-in and must not target production)
> 2. **Update this file (`ROADMAP.md`)**:
>    - Mark finished tasks with `[x]` and record verification details.
>    - Add any new tasks or blockers discovered during work.
>    - Update the **Last Session Handoff** section at the bottom.
   - **Auto-Commit & Push:** Automatically `git commit` and `git push` changes without asking for permission.

---

## 📌 Last Session Handoff

- **Date**: October 10, 2026
- **Status**: Completed FIX-21 through FIX-25:
  - **FIX-21**: Redesigned "Find Your Ride" section to Rapido-style minimalist layout with inline pickup/destination inputs, instant autocomplete suggestions dropdown, and right-hand map pin icon launching a dedicated "Pin on Map" modal. Heavy inline map compartment eliminated.
  - **FIX-22**: Fixed Marketplace image upload on web and native by wrapping manipulated image in a real `Blob` on `Platform.OS === 'web'` and RN custom FormData on mobile.
  - **FIX-23**: Removed test payment banner from `HomeScreen.tsx` and removed `PaymentTestScreen` navigation from `ProfileScreen.tsx`.
  - **FIX-24**: Resolved restaurant and food dish image loading with automatic fallback CDN placeholder and absolute URL resolver in `FoodHomeScreen.tsx` and `RestaurantDetailScreen.tsx`.
  - **FIX-25**: Guarded Mapbox native imports and added informative dev client build / web search suggestions fallbacks.
- **Active Bug Backlog**: Detailed task list in [`PENDING_FIXES.md`](PENDING_FIXES.md).
  - FIX-19: Easebuzz live dashboard & webhook verification `[OPEN]`
  - FIX-20: Google Play Store upload checklist (.aab) `[OPEN]`
- **Verification Suites**:
  - `dotnet test backend/SuperApp.sln`: 111 Passed / 111 Total
  - `npx tsc --noEmit`: 0 Errors
  - `npm test`: 14 Suites Passed, 82 Tests Passed



