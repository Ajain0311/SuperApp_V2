# Admin operations

An existing customer account is the only login. Admin searches that person by mobile number, name, or user id at `GET /api/admin/users?search=`, then `POST /api/admin/users/assign` adds roles on the same `users` and `user_roles` rows.

Customer access is always kept. Restaurant owner assignment creates one restaurant and a `restaurant_users` link. Captain assignment creates a `drivers` row and a vehicle. Bazaar seller assignment adds `MARKETPLACE_SELLER`. The seller then creates listings owned by that user id. Admin assignment is allowed because `ADMIN` is already a role.

## Coupons

`POST /api/admin/coupons` creates a unique code. Duplicate codes return 409. `POST /api/coupons/validate` and food checkout both use `CouponEngine`. The server computes the discount. Percentage discounts stop at `max_discount`. A coupon must be active, inside its dates, meet the minimum amount, match FOOD, RIDE, MARKETPLACE (Bazaar uses this module), or ALL, and stay inside the global and per-user counts. `CouponEngine.ConsumeAsync` serializes the increment and writes `coupon_usages`.

## Banners

`POST /api/admin/banners` accepts JSON or multipart. An image file is compressed with the existing PostgreSQL document pipeline and stored as `/api/documents/{documentNo}/image`. A failed image is rejected and the banner is not saved. The previous admin page called this route without a bearer token, so the API returned 401 and `response.json()` threw. The admin page now attaches the token passed from the signed-in app.

`GET /api/banners` returns only active rows whose start and end dates, when set, include the current time. The home screen still loads if that call fails.

## Safe area

Screens should use `SafeAreaView` from `react-native-safe-area-context` under the existing `SafeAreaProvider`. The bottom tab bar height includes `useSafeAreaInsets().bottom` so confirm and cart actions stay above the gesture or three-button bar.
