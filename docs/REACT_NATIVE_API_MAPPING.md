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

## 2. Food Delivery Endpoints (`/api/restaurants` & `/api/foodorders`)

| Backend Endpoint | HTTP Method | React Native Service / Hook | Request Payload | Response DTO | Verified Live |
|---|---|---|---|---|---|
| `/api/restaurants` | `GET` | `FoodHomeScreen` | Query params: `search`, `isVeg`, `page` | `ApiResponse<RestaurantSummary[]>` | **YES (200 OK)** |
| `/api/restaurants/{id}` | `GET` | `RestaurantDetailScreen` | URL param: `id` | `ApiResponse<RestaurantDetail>` | **YES (200 OK)** |
| `/api/foodorders` | `POST` | `RestaurantDetailScreen` / `apiClient` | `{ restaurantId, items: [...], addressId, paymentMethod }` | `ApiResponse<FoodOrderDto>` | **YES (200 OK)** |
| `/api/foodorders` | `GET` | `ActivityScreen` | (None, Bearer JWT) | `ApiResponse<List<FoodOrderDto>>` | **YES (200 OK)** |
| `/api/foodorders/{id}` | `GET` | `FoodOrderTrackingScreen` | URL param: `id` | `ApiResponse<FoodOrderDto>` | **YES (200 OK)** |
| `/api/foodorders/{id}/cancel` | `POST` | `FoodOrderTrackingScreen` | URL param: `id` | `ApiResponse` | **YES (200 OK)** |

---

## 3. Ride Hailing Endpoints (`/api/rides`)

| Backend Endpoint | HTTP Method | React Native Service / Hook | Request Payload | Response DTO | Verified Live |
|---|---|---|---|---|---|
| `/api/rides/estimate` | `POST` | `RideBookingScreen` | `{ pickupLat, pickupLng, pickupAddress, destinationLat, destinationLng, destinationAddress }` | `ApiResponse<RideEstimateResponse>` | **YES (200 OK)** |
| `/api/rides/book` | `POST` | `RideBookingScreen` | `BookRideRequest` | `ApiResponse<RideDto>` | **YES (200 OK)** |
| `/api/rides/{id}` | `GET` | `ActiveRideScreen` | URL param: `id` | `ApiResponse<RideDto>` | **YES (200 OK)** |
| `/api/rides/{id}/cancel` | `POST` | `ActiveRideScreen` | URL param: `id` | `ApiResponse` | **YES (200 OK)** |

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

## 5. SignalR Real-Time Hubs

| Hub Endpoint | Client Hub Class | Server Event Listeners | Client Broadcast Methods |
|---|---|---|---|
| `/hubs/ride` | `RideTrackingHub` | `RideLocationUpdated`, `RideStatusChanged` | `JoinRideGroup(rideId)`, `LeaveRideGroup(rideId)` |
| `/hubs/order` | `OrderStatusHub` | `OrderStatusUpdated` | `JoinOrderGroup(orderId)`, `LeaveOrderGroup(orderId)` |
| `/hubs/chat` | `ChatHub` | `ReceiveMessage` | `SendMessage(recipientId, message)` |

---

## 6. Offline Data Resilience

All screen components implement a **fall-through strategy**:
1. If the ASP.NET Core backend is active and reachable, the application fetches live data.
2. If network fails or the server is offline, the screens automatically use the built-in seed datasets matching the Flutter client's offline mocks, guaranteeing seamless development, UI review, and demo workflows.
