# Database migrations

MySQL schema for the Twilio Functions. Nothing in the app touches a database —
only `twilio/functions/alert.js`, `alert-status.js` and `notification-manager.js`
do, through `mysql2/promise` with hand-written SQL.

Migrations are run with [dbmate](https://github.com/amacneil/dbmate): a single
binary, plain `.sql` files, and a `schema_migrations` table to track what has
been applied. It is deliberately not a dependency of this project — it is not
in `package.json`, and nothing is bundled into the app or shipped to Twilio.

```bash
brew install dbmate
```

## There are two databases

They hold the same tables and diverge only in what is written to them.

| Database | Used by | Holds |
| --- | --- | --- |
| `readynow_notifications` | the production Functions Service | real alerts, real metrics, real push registrations |
| `readynow-nonprod` | the non-production Functions Service | everything from development and TestFlight builds |

The split exists because alert metrics and NILRA referrals are recorded
actions. Test traffic in `alert_stats_daily`, or a beta alert the sweep retries
alongside real ones, makes the production tables untrustworthy at exactly the
moment they matter. Feedback (MongoDB) and the countries proxy are deliberately
shared — neither records an action worth separating.

The two names are not spelled alike: production uses an underscore and
non-production a hyphen. That is how they exist in DigitalOcean, so it is
what `DO_MYSQL_DATABASE` and `DATABASE_URL` must say. A hyphenated name also
needs backticks anywhere it appears in raw SQL.

The production database is named `readynow_notifications` for historical
reasons: it predates the alert tables and was only ever used for push
registration. Renaming it means finding and repointing every consumer, so it
was left alone rather than risked during a release.

## Running them

`dbmate` takes its target from `DATABASE_URL`. Run the same migrations against
each database in turn.

```bash
export DATABASE_URL="mysql://USER:PASSWORD@HOST:25060/readynow_notifications?tls=custom"
dbmate --migrations-dir db/migrations status
dbmate --migrations-dir db/migrations up
```

```bash
export DATABASE_URL="mysql://USER:PASSWORD@HOST:25060/readynow-nonprod?tls=custom"
dbmate --migrations-dir db/migrations up
```

`status` before `up` is worth the extra command — it prints what would run
without running it.

### TLS

DigitalOcean's managed MySQL requires TLS and the connection needs its CA
certificate — the same PEM the Functions use as `DO_MYSQL_CA_CERT`. Verify a
connection works before relying on it; this is the one step likely to need
fiddling. Do not reach for `tls=skip-verify` to get past it on a database
holding emergency delivery state.

## Rollback

**Never run `dbmate rollback` against production.** The `down` sections are
real `DROP TABLE` statements, because that is what "down" means, and
`20260917000001` drops the live push registration tokens for every install.

Rollback is for a local or throwaway database. In production, a mistake is
corrected by a new forward migration, not by reversing an old one.

## Writing new ones

```bash
dbmate --migrations-dir db/migrations new add_something
```

Two rules that matter here:

**Use `IF NOT EXISTS` only in the two baseline migrations.** They carry it
because `notification_devices` already existed in production when migrations
were introduced, so `20260917000001` had to be a no-op there. For anything
new it is a trap: it silently does nothing when a table exists in a different
shape, so a drifted schema looks migrated. Write plain `ALTER` and let a
mismatch fail loudly.

**One logical change per migration.** MySQL DDL is not transactional. A
migration that does three things and fails on the second leaves the database
in a state no one wrote down.

## History

`20260917000001` and `20260917000002` are the previous `twilio/schema/*.sql`
files, unchanged apart from the dbmate markers. When they were introduced,
production already had `notification_devices` and none of the alert tables, and
`readynow-nonprod` did not exist. Running both against both databases produced
the same schema in each.
