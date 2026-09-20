# SuperApp V2 — Documentation Hub

Welcome to the canonical documentation for **SuperApp V2** (`HTTP-EXPNAT-NET`), a unified cross-platform mobile ecosystem for small businesses, local communities, and logistics — seamlessly integrating **Food Delivery**, **Ride Hailing**, and **Community Bazaar** under a single user identity.

---

## 📚 Canonical Documentation Index

All architectural, operational, and development documentation has been audited and consolidated into the following canonical references:

| Document | Description | Target Audience |
|---|---|---|
| [**Architecture Guide**](file:///D:/FREELANCER/HTTP-EXPNAT-NET/docs/ARCHITECTURE.md) | End-to-end system design, C4 component diagrams, zero-cost operational model, SignalR WebSocket real-time hubs, offline postal engine, and state management. | Architects, Senior Engineers |
| [**Database Specification**](file:///D:/FREELANCER/HTTP-EXPNAT-NET/docs/DATABASE.md) | Full relational data model across 28 PostgreSQL tables, entity relationships, indexing, foreign keys, and migration history. | Database Admins, Backend Engineers |
| [**API Reference**](file:///D:/FREELANCER/HTTP-EXPNAT-NET/docs/API.md) | Comprehensive REST API catalog covering all 12 controllers, DTO schemas, authentication headers, error formats, and SignalR hub contracts. | Backend & Frontend Developers, QA |
| [**Roles & Permissions Guide**](file:///D:/FREELANCER/HTTP-EXPNAT-NET/docs/ROLES_AND_PERMISSIONS.md) | Single-identity multi-role security model (`CUSTOMER`, `DRIVER`, `RESTAURANT_OWNER`, `MARKETPLACE_SELLER`, `ADMIN`), Zustand mode switching, and route guards. | Fullstack Engineers, Security Auditors |
| [**Development Setup Guide**](file:///D:/FREELANCER/HTTP-EXPNAT-NET/docs/DEVELOPMENT_SETUP.md) | Developer onboarding guide: prerequisites (.NET 10, Node 20+, Expo SDK 57), `.env` configuration, database seeding, and running the stack locally. | New Developers, Contributors |
| [**Production Deployment Guide**](file:///D:/FREELANCER/HTTP-EXPNAT-NET/docs/PRODUCTION_SETUP.md) | Production infrastructure setup: Docker containerization, Kestrel optimization, PostgreSQL pooling, DLT SMS & Easebuzz gateways, and security hardening. | DevOps, SysAdmins, SREs |
| [**Testing Guide**](file:///D:/FREELANCER/HTTP-EXPNAT-NET/docs/TESTING.md) | Complete guide to test automation: backend xUnit suites, frontend Jest suites, typechecking, Expo doctor, automated UAT runner, and Playwright live browser testing. | QA Engineers, Developers |
| [**UAT & Verification Results**](file:///D:/FREELANCER/HTTP-EXPNAT-NET/docs/UAT_RESULTS.md) | Formal results record: 48/48 automated UAT scenarios passing, 15/15 Playwright live browser flows passing, 67/67 xUnit backend tests, and 73/73 Jest frontend tests. | Product Owners, QA Leads, Stakeholders |
| [**Release Checklist**](file:///D:/FREELANCER/HTTP-EXPNAT-NET/docs/RELEASE_CHECKLIST.md) | Pre-flight release verification gates: schema checks, secret sanitization, smoke testing, performance validation, and rollback protocols. | Release Engineers, Tech Leads |
| [**Changelog**](file:///D:/FREELANCER/HTTP-EXPNAT-NET/docs/CHANGELOG.md) | Complete version history following Keep a Changelog and Semantic Versioning specifications. | All Team Members |

---

## 🚀 Quick Start Navigation

- To run the application locally, read [**DEVELOPMENT_SETUP.md**](file:///D:/FREELANCER/HTTP-EXPNAT-NET/docs/DEVELOPMENT_SETUP.md).
- To inspect or modify the database schema, read [**DATABASE.md**](file:///D:/FREELANCER/HTTP-EXPNAT-NET/docs/DATABASE.md).
- To integrate or test an endpoint, read [**API.md**](file:///D:/FREELANCER/HTTP-EXPNAT-NET/docs/API.md).
- To execute the automated test suites, read [**TESTING.md**](file:///D:/FREELANCER/HTTP-EXPNAT-NET/docs/TESTING.md).
