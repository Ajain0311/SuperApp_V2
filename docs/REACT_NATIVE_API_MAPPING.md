# React Native API Mapping Reference

This document maps all ASP.NET Core API endpoints and SignalR hubs to their corresponding React Native services, methods, and DTOs in `D:\FREELANCER\HTTP-EXPNAT-NET`.

---

## 1. Authentication Endpoints (`/api/auth`)

| Backend Endpoint | HTTP Method | React Native Service / Store | Request Payload | Response DTO | Verified Live |
|---|---|---|---|---|---|
| `/api/auth/send-otp` | `POST` | `authStore.sendOtp` / `apiClient` | `{ mobileNumber: string }` | `SendOtpResponse` | **YES (200 OK)** |
| `/api/auth/verify-otp` | `POST` | `authStore.verifyOtp` / `apiClient` | `{ mobileNumber: string, otpCode: string, fullName?: string }` | `AuthResponse` | **YES (200 OK)** |
| `/api/auth/admin-login` | `POST` | `authStore.adminLogin` / `apiClient` | `{ mobileNumber: string, password: string, otpCode: string }` | `AuthResponse` | **YES (200 OK)** |
| `/api/auth/profile` | `GET` | `authStore.getProfile` / `apiClient` | (None, Bearer JWT) | `ApiResponse<User>` | **YES (200 OK)** |

---

## 2. Food Delivery & Coupons Endpoints (`/api/restaurants`, `/api/foodorders`, `/api/coupons`)

| Backend Endpoint | HTTP Method | React Native Service / Hook | Request Payload | Response DTO | Verified Live |
|---|---|---|---|---|---|
| `/api/restaurants` | `GET` | `FoodHomeScreen` | Query params: `search`, `isVeg`, `page` | `ApiResponse<RestaurantSummary[]>` | **YES (200 OK)** |
| `/api/restaurants/{id}` | `GET` | `RestaurantDetailScreen` | URL param: `id` | `ApiResponse<RestaurantDetail>` | **YES (200 OK)** |
| `/api/coupons/validate` | `POST` | `CartSummarySheet` | `{ code: string, orderAmount: number, module: string }` | `ApiResponse<CouponDto>` | **YES (200 OK)** |
| `/api/foodorders` | `POST` | `RestaurantDetailScreen` / `apiClient` | `{ restaurantId, items: [...], couponCode, deliveryAddressId, paymentMethod }` | `ApiResponse<FoodOrderDto>` | **YES (200 OK)** |
| `/api/foodorders` | `GET` | `ActivityScreen` | (None, Bearer JWT) | `ApiResponse<List<FoodOrderDto>>` | **YES (200 OK)** |
| `/api/foodorders/{id}` | `GET` | `FoodOrderTrackingScreen` | URL param: `id` | `ApiResponse<FoodOrderDto>` | **YES (200 OK)** |
| `/api/foodorders/{id}/cancel` | `POST` | `FoodOrderTrackingScreen` | URL param: `id` | `ApiResponse` | **YES (200 OK)** |

---

## 3. Ride Hailing Endpoints (`/api/rides`)

| Backend Endpoint | HTTP Method | React Native Service / Hook | Request Payload | Response DTO | Verified Live |
|---|---|---|---|---|---|
| `/api/rides/estimate` | `POST` | `RideBookingScreen` | `{ pickupLat, pickupLng, pickupAddress, destinationLat, destinationLng, destinationAddress }` | `ApiResponse<RideEstimateResponse>` | **YES (200 OK)** |
| `/api/rides/book` | `POST` | `RideBookingScreen` | `BookRideRequest` | `ApiResponse<RideDto>` | **YES (200 OK)** |
| `/api/rides` | `GET` | `ActivityScreen` | (None, Bearer JWT) | `ApiResponse<List<RideDto>>` | **YES (200 OK)** |
| `/api/rides/{id}` | `GET` | `ActiveRideScreen` | URL param: `id` | `ApiResponse<RideDto>` | **YES (200 OK)** |
| `/api/rides/{id}/cancel` | `POST` | `ActiveRideScreen` | URL param: `id` | `ApiResponse` | **YES (200 OK)** |
| `/api/rides/{id}/complete` | `POST` | Driver / Admin dispatch | URL param: `id` | `ApiResponse` | **YES (200 OK)** |

---

## 4. Community Bazaar Endpoints (`/api/marketplace`)

| Backend Endpoint | HTTP Method | React Native Service / Store | Request Payload | Response DTO | Verified Live |
|---|---|---|---|---|---|
| `/api/marketplace/categories` | `GET` | `MarketplaceHomeScreen` | (None) | `ApiResponse<MarketplaceCategory[]>` | **YES (200 OK)** |
| `/api/marketplace` | `GET` | `MarketplaceHomeScreen` | Query params: `categoryId`, `search`, `page`, `pageSize` | `ApiResponse<PagedResult<ListingSummary>>` | **YES (200 OK)** |
| `/api/marketplace/{id}` | `GET` | `ListingDetailScreen` | URL param: `id` | `ApiResponse<ListingDetail>` | **YES (200 OK)** |
| `/api/marketplace/listings` | `POST` | `AddListingScreen` | `{ action: 'ADD', title, price, description, condition, categoryId, location, imageUrls }` | `ApiResponse<ListingSummaryDto>` | **YES (200 OK)** |
| `/api/marketplace/favorites/{id}` | `POST` | `MarketplaceHomeScreen` | URL param: `id` | `ApiResponse` | **YES (200 OK)** |
| `/api/marketplace/my-listings` | `GET` | `ActivityScreen` | (None, Bearer JWT) | `ApiResponse<List<ListingSummaryDto>>` | **YES (200 OK)** |

---

## 5. Promotional Banners & Notifications (`/api/banners`, `/api/notifications`)

| Backend Endpoint | HTTP Method | React Native Service / Screen | Request Payload | Response DTO | Verified Live |
|---|---|---|---|---|---|
| `/api/banners` | `GET` | `HomeScreen` | (None) | `ApiResponse<List<BannerDto>>` | **YES (200 OK)** |
| `/api/notifications` | `GET` | `NotificationsScreen` | (None, Bearer JWT) | `ApiResponse<List<NotificationDto>>` | **YES (200 OK)** |
| `/api/notifications/{id}/read` | `POST` | `NotificationsScreen` | URL param: `id` | `ApiResponse` | **YES (200 OK)** |
| `/api/notifications/device-token`| `POST` | `NotificationService` | `{ token, platform, deviceType }` | `ApiResponse` | **YES (200 OK)** |

---

## 6. Addresses & Payments (`/api/addresses`, `/api/payments`)

| Backend Endpoint | HTTP Method | Component / Service | Request Payload | Response DTO | Verified Live |
|---|---|---|---|---|---|
| `/api/addresses` | `GET` | User Address Manager | (None, Bearer JWT) | `ApiResponse<List<AddressDto>>` | **YES (200 OK)** |
| `/api/addresses` | `POST` | Add Address Form | `UpsertAddressRequest` | `ApiResponse<AddressDto>` | **YES (200 OK)** |
| `/api/addresses/{id}` | `PUT` | Edit Address Form | `UpsertAddressRequest` | `ApiResponse<AddressDto>` | **YES (200 OK)** |
| `/api/addresses/{id}` | `DELETE` | Address Delete Action | URL param: `id` | `ApiResponse` | **YES (200 OK)** |
| `/api/payments/create-order` | `POST` | Checkout / Payment Sheet | `CreatePaymentRequest` | `ApiResponse<PaymentOrderResult>` | **YES (200 OK)** |
| `/api/payments/verify` | `POST` | Payment Callback / Polling | `VerifyPaymentRequest` | `ApiResponse<PaymentVerificationResult>` | **YES (200 OK)** |

---

## 7. SignalR Real-Time Hubs

| Hub Endpoint | Client Hub Class | Server Event Listeners | Client Broadcast Methods |
|---|---|---|---|
| `/hubs/ride` | `RideTrackingHub` | `RideLocationUpdated`, `RideStatusChanged` | `JoinRideGroup(rideId)`, `LeaveRideGroup(rideId)` |
| `/hubs/order` | `OrderStatusHub` | `OrderStatusUpdated` | `JoinOrderGroup(orderId)`, `LeaveOrderGroup(orderId)` |
| `/hubs/chat` | `ChatHub` | `ReceiveMessage` | `SendMessage(recipientId, message)` |
