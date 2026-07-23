# Restaurant Booking Module Placeholder

This directory is reserved for the future restaurant-booking domain.

Do not import this placeholder into `AppModule` until real booking behavior is
implemented and tested.

Future module boundaries may include:

- `restaurant-bookings`
- `booking-availability`
- `restaurant-tables`
- `private-dining-rooms`
- `booking-payments`
- `booking-notifications`

Shared authentication and users must continue to live outside this future
domain so food delivery and restaurant booking use the same Firebase identity
and `users` table.

The existing backend already has restaurant-table and shared payment concepts
for dine-in and delivery. Future booking work must inspect and integrate those
models deliberately; it must not introduce duplicate user, restaurant-table,
order, or payment records merely to match this proposed folder boundary.
