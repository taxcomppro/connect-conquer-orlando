# Site DB read-only connection — setup

This lets Field Hub read (never write) TaxCompPro's main-site database,
so it can catch conversions Stripe's webhook can't see — specifically
100%-off coupon upgrades, which the main site applies directly to its
database without ever creating a Stripe Checkout Session.

## 1. Create a read-only role on the main site's database

Run this against **taxcomppro-1's** Postgres — not Field Hub's own
Supabase database. Get taxcomppro-1's connection details from Vercel:
taxcomppro-1-qlgu project → Settings → Environment Variables →
`DATABASE_URL`. Whatever SQL console your Postgres provider gives you
(a "Query" tab in Vercel's Storage view, Neon's own console, TablePlus,
psql — anything that can run a query against that connection string)
works for this one-time setup step:

```sql
CREATE ROLE fieldhub_reader WITH LOGIN PASSWORD 'REPLACE_WITH_A_STRONG_RANDOM_PASSWORD';

GRANT CONNECT ON DATABASE <your_database_name> TO fieldhub_reader;
GRANT USAGE ON SCHEMA public TO fieldhub_reader;
GRANT SELECT ON public.users, public.subscriptions TO fieldhub_reader;
```

Replace `<your_database_name>` with the database name from the
connection string (the part after the last `/`, before any `?`).
Pick your own strong password for the placeholder — a leaked one only
grants read access to these two tables, nothing else, and it can never
write.

## 2. Build the new role's connection string

Take taxcomppro-1's `DATABASE_URL` and swap in the new role's
credentials — same host, port, and database name, different
username/password:

```
postgres://fieldhub_reader:REPLACE_WITH_A_STRONG_RANDOM_PASSWORD@<same-host>:<same-port>/<same-database>?sslmode=require
```

## 3. Add environment variables to Field Hub (Vercel)

In the **fieldhub** Vercel project (not taxcomppro-1) → Settings →
Environment Variables → Production:

- `SITE_DATABASE_URL` — the connection string from step 2
- `CRON_SECRET` — any strong random value; Vercel automatically sends
  this as `Authorization: Bearer <value>` when it triggers the
  scheduled job, and the new route checks it before running

Redeploy after adding these.

## 4. Add the `pg` package

Field Hub doesn't have a plain Postgres client yet (it only talks to
its own database through Supabase's client). Add one:

```
bun add pg
bun add -d @types/pg
```

## 5. What runs automatically after this

`vercel.json` now includes a cron entry that calls
`/api/internal/sync-site-conversions` every 15 minutes. Each run:

1. Reads taxcomppro-1's `users`/`subscriptions` tables (read-only) for
   anyone who upgraded off the free tier in the last 45 minutes
2. Matches them to a Field Hub lead by email
3. If that lead hasn't already been marked converted (e.g. by the
   Stripe webhook), marks it now

This is the fallback path — the Stripe webhook is still the primary,
faster path for real paid checkouts. This only fires for the cases
Stripe genuinely never saw.
