# Ride fare and location

The booked amount is calculated on the server from pickup and destination coordinates. The app does not send a fare, a distance, or an option price.

## Formula

For the active `ride_fare_rules` row of the chosen vehicle and city `DEFAULT`:

```
distanceFare = max(0, distanceKm - includedDistanceKm) * perKmRate
timeFare = durationMinutes * perMinuteRate
core = baseFare + distanceFare + timeFare + bookingFee + platformFee
core = max(core, minimumFare)
core = core * peakMultiplier
core = core * (1 + nightSurchargePercent/100) between 22:00 and 05:00 India time
subtotal = core + selected option amounts
tax = subtotal * taxPercentage / 100
estimated total = round(subtotal + tax)
```

The ride row stores `estimated_fare` and `fare_breakdown` at booking time. Later edits to the rate tables do not rewrite old rides.

## Default rates

These are our own configurable rates, not a copy of another company's live fare.

| Category | Minimum | Base | Included km | Per km | Per minute | Booking | Platform |
| --- | --- | --- | --- | --- | --- | --- | --- |
| BIKE | 35 | 25 | 1.5 | 8 | 1 | 5 | 4 |
| AUTO | 50 | 35 | 1.5 | 12 | 1.5 | 8 | 5 |
| CAB | 90 | 55 | 2 | 16 | 2 | 15 | 8 |

Night surcharge default is 10%. Tax default is 0. Change rows in `ride_fare_rules` without an app release.

## Options

`ride_fare_options`: Priority pickup +₹10 (`PRIORITY`), Extra convenience +₹20 (`CONVENIENCE`), Extra waiting +₹30 (`WAITING`). Unknown or disabled codes are rejected.

## Location

Ride booking uses the existing Mapbox search and reverse geocode, the existing map pin, and device GPS through `locationService`. Search, current location, and a moved pin all call the same place handler, and that coordinate pair is what estimate and book send. Pickup and destination closer than 0.15 km are rejected.

## APIs

`POST /api/rides/estimate` accepts coordinates and `optionCodes`. It returns distance, minutes, per-vehicle breakdown, and enabled options.

`POST /api/rides/book` accepts coordinates, vehicle type, and option codes. It recalculates and stores the result.

Migration: `database/migrations/20261005_ride_fare_rules.sql`.
