# Captain food delivery

Food orders stay on the existing `FoodOrder` row. A READY order with `driver_id` null is offered to online captains. The same `Driver` record used for rides accepts it.

## Status

`PENDING → ACCEPTED → PREPARING → READY` is still the restaurant transition (`PUT /api/vendor/orders/{id}/status`).

After READY:

| Step | Who | Endpoint | Result |
| --- | --- | --- | --- |
| See open deliveries | Online captain | `GET /api/driver/available-food-orders` | READY orders with no captain. Offline captains get an empty list. |
| Accept | Online captain | `POST /api/driver/food-orders/{id}/accept` | Sets `driver_id` only when status is READY and `driver_id` is null. Second captain gets 409. |
| Pick up | Assigned captain | `POST /api/driver/food-orders/{id}/pickup` | READY → PICKED_UP |
| Deliver | Assigned captain | `POST /api/driver/food-orders/{id}/deliver` | PICKED_UP → DELIVERED. COD `PENDING` becomes `PAID`. |

Restaurant owners can still move READY → DELIVERED. That existing kitchen path is unchanged.

## Authorization

`DriverController` requires a DRIVER (or existing admin driver) identity. Customers and restaurant owners without that role receive 403. Offline captains receive 409 on accept. Pickup and deliver require `driver_id` to match the caller.

The assigned captain, the customer, the restaurant, and admins can read the order. Other users still receive 403.

## Realtime

Hub: existing `RideTrackingHub` group `drivers-pool` and `OrderStatusHub` group `order-{id}`.

| Event | When | Payload |
| --- | --- | --- |
| `FoodDeliveryAvailable` | Restaurant marks READY | `orderId`, `orderNumber`, `restaurantId`, `restaurantName`, `grandTotal`, `status` |
| `FoodDeliveryAccepted` | Captain accepts | `orderId`, `driverId`, `driverName`, `driverPhone`, `status` |
| `OrderStatusUpdated` | Accept, pickup, deliver | `orderId`, `status`, `driverId`, `driverName` |
| `FoodDeliveryStatusChanged` | Pickup, deliver | same status fields |

Push and in-app notifications use the existing `INotificationService` and `notifications` table with type `FOOD_ORDER`.

## Database

Startup SQL (also safe to run by hand):

```sql
ALTER TABLE food_orders ADD COLUMN IF NOT EXISTS driver_id BIGINT NULL;
ALTER TABLE food_orders ADD COLUMN IF NOT EXISTS driver_assigned_at TIMESTAMPTZ NULL;
CREATE INDEX IF NOT EXISTS idx_food_orders_driver ON food_orders (driver_id);
```

No existing rows are deleted. `driver_id` stays null until a captain accepts.

## Concurrency

`ExecuteUpdate` updates a row only when `status = READY` and `driver_id` is null. A process-local lock serializes accept calls on one server. Two API instances still cannot both win because the database predicate admits one update.
