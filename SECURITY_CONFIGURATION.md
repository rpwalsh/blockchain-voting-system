# Local credentials and seeding

Keep real credentials in an untracked local environment file or your deployment's secret store.

Docker Compose requires `POSTGRES_PASSWORD`, `JWT_SECRET`, and `COOKIE_SECRET` in the environment. Generate unique values for your installation. The database password must be URL-safe because Compose also inserts it into the database connection URL.

Before running either administrator seed script, set `ADMIN_PASSWORD` to a unique password of at least 12 characters. The seed scripts validate it before changing database records and do not print it.

If an existing installation used the former checked-in authentication values or seed password, replace those credentials and invalidate existing sessions before exposing that installation.
