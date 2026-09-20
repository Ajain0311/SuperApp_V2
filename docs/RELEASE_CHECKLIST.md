# SuperApp V2 — Production Release & Deployment Checklist

This checklist defines the mandatory pre-flight verification gates, security audits, and post-deployment validation steps required prior to promoting **SuperApp V2** to production.

---

## 1. Pre-Flight Verification Gates

### Gate 1: Code Compilation & Static Analysis
- [ ] **Backend Compilation**: Run `dotnet build backend/SuperApp.API/SuperApp.API.csproj -c Release`. Zero compilation errors or blocking warnings.
- [ ] **TypeScript Typecheck**: Run `npx tsc --noEmit`. Zero TypeScript errors across entire project.
- [ ] **Ecosystem Doctor**: Run `npx expo-doctor`. All 18 checks must report `PASS`.

### Gate 2: Automated Test Validation
- [ ] **Backend Unit Tests**: Run `dotnet test backend/SuperApp.API.Tests/SuperApp.API.Tests.csproj`. All 67 tests passing (100%).
- [ ] **Frontend Unit Tests**: Run `npm test -- --watchAll=false`. All 73 tests passing (100%).
- [ ] **Automated Full UAT**: Run `node scripts/execute_full_uat.js`. All 48 scenarios passing (100%).
- [ ] **Live Browser E2E Tests**: Run `node e2e/master_live_test.js`. All 15 form flows passing with 0 browser exceptions.

---

## 2. Database & Schema Gates

- [ ] **Schema Integrity**: Verify all 28 tables exist in the target PostgreSQL instance (see [`docs/DATABASE.md`](file:///D:/FREELANCER/HTTP-EXPNAT-NET/docs/DATABASE.md)).
- [ ] **Migration Check**: Apply all incremental migrations from `database/migrations/`.
- [ ] **Foreign Key & Index Audit**: Ensure all 34 foreign key indexes and status check constraints are present.
- [ ] **Connection Pooling**: Verify PgBouncer connection string on port `6543` with `Maximum Pool Size=50;Connection Lifetime=300;`.
- [ ] **Point-In-Time Recovery (PITR)**: Verify active WAL archiving and automated daily database snapshot.

---

## 3. Security & Environment Configuration Gates

- [ ] **Environment Mode**: Ensure `ASPNETCORE_ENVIRONMENT=Production`.
- [ ] **Master OTP Disabled**: Confirm that developer OTP bypass (`123456`) is strictly disabled in production.
- [ ] **Secret Sanitization**:
  - [ ] No hardcoded passwords, tokens, or connection strings in Git repository.
  - [ ] Production JWT Secret Key is a minimum 256-bit high-entropy secret injected via environment variable `JwtSettings__SecretKey`.
- [ ] **External Gateways Configured**:
  - [ ] **Punjab DLT SMS Gateway**: Production API key and approved DLT template ID (`1407177633307627182`) verified.
  - [ ] **Easebuzz Payment Gateway**: Live merchant key and salt configured; environment set to `prod`.
  - [ ] **Expo Push Notifications**: Production Expo access token configured for push broadcast.
- [ ] **CORS Hardening**: Strict CORS origins configured in `Program.cs` allowing only authorized mobile and web domains.

---

## 4. Mobile Client Deployment Gates (EAS)

- [ ] **Version Bump**: Update `version` in `package.json` and `app.json` following semantic versioning.
- [ ] **Android Build (AAB)**: Execute `npx eas build --platform android --profile production` with upload key signing.
- [ ] **iOS Build (IPA)**: Execute `npx eas build --platform ios --profile production` with Apple Developer provisioning profile.
- [ ] **Store Privacy Disclosures**: Verify Google Play & Apple App Store disclosures for foreground GPS (`expo-location`) and push notifications (`expo-notifications`).

---

## 5. Post-Deployment Smoke Test Protocol

Immediately after deployment to production, perform the following live validation:
1. **Health Check**:
   ```bash
   curl -i https://api.superapp.domain.com/health
   # Expected: HTTP 200 OK {"status":"Healthy"}
   ```
2. **Live SMS Verification**:
   - Send OTP to a physical test mobile number via `POST /api/auth/send-otp`.
   - Confirm receipt of live SMS on physical device within 30 seconds.
   - Verify OTP and receive JWT Bearer token.
3. **Food Directory Smoke**:
   - Fetch restaurants via `GET /api/restaurants`.
   - Verify restaurant catalog and menu items load with images.
4. **Ride Estimation Smoke**:
   - Calculate fare estimate via `POST /api/rides/estimate`.
   - Verify non-zero fare returned for Bike, Auto, and Cab.
5. **Real-Time WebSocket Smoke**:
   - Connect client to `/hubs/order` and `/hubs/ride`.
   - Confirm successful WebSocket handshake and connection upgrade.

---

## 6. Rollback Protocol

If critical defects or unhandled exceptions occur during deployment:
1. **Container Rollback**:
   ```bash
   # Revert to previous stable container image tag
   docker service update --image superapp-api:v2.2.0 superapp_api_service
   ```
2. **Reverse Proxy Drain**:
   - Temporarily point Nginx to secondary standby node if performing zero-downtime blue/green deployment.
3. **Database Rollback**:
   - If a migration caused failures, run the corresponding down-migration script from `database/migrations/rollback/`.
