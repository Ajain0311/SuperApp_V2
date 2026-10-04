# SuperApp V2 Roadmap

> **Canonical Tracker**: This document is the single source of truth for all pending development, pending testing, and blocked external dependencies. Completed work is recorded in [`docs/CHANGELOG.md`](docs/CHANGELOG.md) and [`docs/UAT_RESULTS.md`](docs/UAT_RESULTS.md).

---

## 1. Development Pending

| Item | Status | Area | What remains | Dependencies |
| :--- | :--- | :--- | :--- | :--- |
| **Captain Food Delivery Dispatch** | `NOT_IMPLEMENTED` | Backend API (`FoodOrdersController.cs`, `DriverController.cs`) | Backend endpoints for captain broadcast, order claim, pickup confirmation, and delivery lifecycle. Currently assigned to separate backend developer. | Handled by backend developer |
| **Online Food Payment Live Settlement** | `NOT_IMPLEMENTED` | Backend & Mobile (`EasebuzzPaymentService.cs`, `PaymentController.cs`) | Injecting live merchant keys and handling webhook callbacks for production settlement. Currently active in test/sandbox mode. Assigned to separate backend developer. | Easebuzz live production merchant keys |
| **Production Push Notification Delivery** | `NOT_IMPLEMENTED` | Backend API (`SuperApp.API/Services/`) | Implement production FCM v1 HTTP API service replacing `MockNotificationService.cs`; implement persistent `/api/notifications/device-token` registration endpoint. | Firebase Cloud Messaging (FCM v1) service account key |

---

## 2. Testing Pending

| Item | Status | Area | What remains | Dependencies |
| :--- | :--- | :--- | :--- | :--- |
| **Multi-Device Field Validation** | `TESTING PENDING` | Physical Android Devices (Release APK) | Concurrently validate food ordering and ride booking across 3+ distinct physical devices (Customer, Restaurant Owner, Captain) on cellular data over `https://makemytree.duckdns.org`. | Multiple physical Android devices |
| **Live Urban GPS Telemetry Streaming** | `TESTING PENDING` | Mobile App (`RideTrackingHub`) | Stream real moving driver GPS coordinates over cellular network during actual vehicle transit to verify SignalR reconnection resilience. | Physical road testing with moving vehicle |
| **Let's Encrypt TLS Renewal Dry-Run** | `TESTING PENDING` | Server DevOps (Azure VM) | Execute `sudo certbot renew --dry-run` to verify automated non-interactive renewal of `makemytree.duckdns.org` TLS certificates. | Server SSH access |

---

## 3. Blocked / External Dependencies

| Item | Status | Area | What is blocked | External Prerequisite |
| :--- | :--- | :--- | :--- | :--- |
| **Easebuzz Live Merchant Settlement** | `BLOCKED` | Payment Gateway | Live INR payments and automatic merchant settlements cannot be enabled until production credentials are provided. | Live production `PAYMENT_KEY` and `PAYMENT_SECRET` from Easebuzz |
| **FCM v1 Push Notification Delivery** | `BLOCKED` | Push Notifications | Direct APNs/FCM delivery to locked background devices cannot be activated without Firebase service credentials. | Production `firebase-adminsdk.json` configuration file |
