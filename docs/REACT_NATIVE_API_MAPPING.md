# React Native API Mapping Reference

This document maps all ASP.NET Core API endpoints and SignalR hubs to their corresponding React Native services, methods, and DTOs in `D:\FREELANCER\HTTP-EXPNAT-NET`.

---

## 1. Authentication Endpoints (`/api/v1/Auth`)

| Backend Endpoint | HTTP Method | React Native Service / Store | Request Payload | Response DTO |
|---|---|---|---|---|
| `/api/v1/Auth/send-otp` | `POST` | `authStore.sendOtp` / `apiClient` | `{ mobileNumber: string }` | `SendOtpResponse` |
| `/api/v1/Auth/verify-otp` | `POST` | `authStore.verifyOtp` / `apiClient` | `{ mobileNumber: string, otpCode: string, fullName?: string }` | `AuthResponse` |
| `/api/v1/Auth/admin-login` | `POST` | `authStore.adminLogin` / `apiClient` | `{ mobileNumber: string, password: string, otpCode: string }` | `AuthResponse` |
| `/api/v1/Auth/me` | `GET` | `authStore.getProfile` / `apiClient` | (None, Bearer JWT) | `ApiResponse<User>` |
| `/api/v1/Auth/profile` | `PUT` | `authStore.updateProfile` / `apiClient` | `UpdateProfileRequest` | `ApiResponse<User>` |

---

## 2. Food Delivery Endpoints (`/api/v1/Food`)

| Backend Endpoint | HTTP Method | React Native Service / Hook | Request Payload | Response DTO |
|---|---|---|---|---|
| `/api/v1/Food/restaurants` | `GET` | `FoodHomeScreen` | Query params: `categoryId`, `lat`, `lng`, `search` | `ApiResponse<RestaurantSummary[]>` |
| `/api/v1/Food/restaurants/:id` | `GET` | `RestaurantDetailScreen` | URL param: `id` | `ApiResponse<RestaurantDetail>` |
| `/api/v1/Food/orders` | `POST` | `cartStore.checkout` / `apiClient` | `{ restaurantId, items: CartItem[], deliveryAddress, paymentMethod }` | `ApiResponse<FoodOrderDto>` |
| `/api/v1/Food/orders/:id` | `GET` | `FoodOrderTrackingScreen` | URL param: `id` | `ApiResponse<FoodOrderDto>` |

---

## 3. Ride Hailing Endpoints (`/api/v1/Rides`)

| Backend Endpoint | HTTP Method | React Native Service / Hook | Request Payload | Response DTO |
|---|---|---|---|---|
| `/api/v1/Rides/estimate` | `POST` | `RideBookingScreen` | `{ pickupLat, pickupLng, dropLat, dropLng }` | `ApiResponse<VehicleEstimate[]>` |
| `/api/v1/Rides/book` | `POST` | `RideBookingScreen` | `BookRideRequest` | `ApiResponse<RideDto>` |
| `/api/v1/Rides/:id` | `GET` | `ActiveRideScreen` | URL param: `id` | `ApiResponse<RideDto>` |
| `/api/v1/Rides/:id/cancel` | `POST` | `ActiveRideScreen` | URL param: `id`, `{ reason: string }` | `ApiResponse<boolean>` |

---

## 4. Community Bazaar Endpoints (`/api/v1/Marketplace`)

| Backend Endpoint | HTTP Method | React Native Service / Store | Request Payload | Response DTO |
|---|---|---|---|---|
| `/api/v1/Marketplace/categories` | `GET` | `MarketplaceHomeScreen` | (None) | `ApiResponse<MarketplaceCategory[]>` |
| `/api/v1/Marketplace/listings` | `GET` | `MarketplaceHomeScreen` | Query params: `categoryId`, `search`, `page`, `pageSize` | `ApiResponse<PagedResult<ListingSummary>>` |
| `/api/v1/Marketplace/listings/:id` | `GET` | `ListingDetailScreen` | URL param: `id` | `ApiResponse<ListingDetail>` |
| `/api/v1/Marketplace/listings` | `POST` | `AddListingScreen` | `ListingActionRequest` | `ApiResponse<ListingDetail>` |
| `/api/v1/Marketplace/listings/:id/favorite` | `POST` | `marketplaceStore.toggleFavorite` | URL param: `id` | `ApiResponse<boolean>` |

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
