# Easebuzz online food payment

COD is unchanged: the order is created with `payment_status = PENDING` and becomes `PAID` when it is delivered.

ONLINE creates the food order with `payment_status = PENDING_PAYMENT`. Nothing in the mobile client can mark it paid.

## Flow

1. `POST /api/FoodOrders` with `paymentMethod: ONLINE`.
2. `POST /api/FoodOrders/{id}/pay` by the order owner. The server calls the configured gateway with `module = FOOD` and `receiptId = {foodOrderId}`.
3. Easebuzz checkout uses the returned `accessKey`, `payUrl`, and public `keyId`. The salt never leaves the server.
4. The browser returns to `PAYMENT_RETURN_URL` (`/api/payments/easebuzz-return`). The server webhook is `POST /api/payments/webhook`.
5. `PAID` is stored only when the callback hash matches, or when `POST /api/payments/verify` reads a successful transaction from Easebuzz.
6. `FoodPaymentSync` copies that verified payment onto the food order. A second callback does not create another order and does not change a paid order.

Unknown or unsigned success responses stay unpaid. `failure` / `dropped` become `FAILED`. `usercancelled` becomes `CANCELLED`.

## Environment

| Variable | Use |
| --- | --- |
| `PAYMENT_PROVIDER` | `Easebuzz` or `Mock` |
| `PAYMENT_KEY` | Easebuzz merchant key |
| `PAYMENT_SECRET` | Easebuzz salt. Server only. |
| `PAYMENT_ENV` | `test` for sandbox, `prod` for live |
| `PAYMENT_RETURN_URL` | Public `https://<host>/api/payments/easebuzz-return` |

Sandbox base: `https://testpay.easebuzz.in/`. Live base: `https://pay.easebuzz.in/`. Test UPI shown by `GET /api/payments/kit` is `success@easebuzz`.

When `PAYMENT_KEY` and `PAYMENT_SECRET` are empty, the API uses the existing mock gateway. `POST /api/payments/mock-complete` is rejected while Easebuzz is the active provider.

## Live credentials

Production merchant key and salt are not in git. Until they are set on the server, live charges stay blocked. Sandbox or mock verification is the working path.

## Deploy

Restart the API after setting the variables. The food-order columns are added on startup. Confirm `GET /swagger/index.html` and `POST /api/FoodOrders/{id}/pay` on an ONLINE order owned by the caller.
