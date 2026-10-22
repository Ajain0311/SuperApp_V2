-- Allow EXPIRED for unaccepted ride requests that time out after 5 minutes.
-- App code (DriverController, RideExpiryBackgroundService, RidesController) already writes EXPIRED.
-- Without this, GET /api/driver/available-rides fails with chk_rides_status (500).

ALTER TABLE rides DROP CONSTRAINT IF EXISTS chk_rides_status;
ALTER TABLE rides ADD CONSTRAINT chk_rides_status
    CHECK (status IN (
        'REQUESTED',
        'SEARCHING',
        'ASSIGNED',
        'ACCEPTED',
        'ARRIVING',
        'STARTED',
        'COMPLETED',
        'CANCELLED',
        'EXPIRED'
    ));
