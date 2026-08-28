# Tax Comp Pro ↔ Field Hub signup contract

Field Hub remains an independent event application. Tax Comp Pro remains the source of truth for
users, checkout, subscriptions, payments, plans, and membership state.

## 1. Join URL

Field Hub displays a QR containing:

```text
https://www.taxcomppro.com/join?signupSession=FH-A1B2C3D4E5
```

The main site must preserve `signupSession` through sign-in, account creation, checkout, payment
redirects, and membership activation. Store it as checkout/subscription metadata so the completed
member can always be correlated back to Field Hub.

## 2. Progress and completion webhook

Send `POST /api/signup-sessions/{signupSessionId}/membership` when the QR landing page opens, when
checkout starts, and when membership becomes active.

Sign the exact UTF-8 request body with HMAC-SHA256 using
`FIELD_HUB_MEMBERSHIP_WEBHOOK_SECRET`. Send the lowercase hexadecimal digest as:

```text
x-field-hub-signature: sha256=<digest>
content-type: application/json
```

Example completion body:

```json
{
  "signupSessionId": "FH-A1B2C3D4E5",
  "status": "MEMBERSHIP_ACTIVE",
  "taxCompProUserId": "usr_92817",
  "membershipId": "mem_34082",
  "plan": "Pro",
  "membershipStatus": "ACTIVE",
  "integrationReference": "checkout_session_or_event_id"
}
```

Allowed statuses are `QR_SCANNED`, `CHECKOUT_STARTED`, and `MEMBERSHIP_ACTIVE`. An active event is
rejected unless `taxCompProUserId` is present and `membershipStatus` is exactly `ACTIVE`. Status
regressions are rejected. Repeated events are idempotent.

## 3. Polling fallback

Field Hub's **Check membership status** button calls the server-only URL in
`TAX_COMP_PRO_MEMBERSHIP_STATUS_URL` with:

```text
GET <status-url>?signupSessionId=FH-A1B2C3D4E5
Authorization: Bearer <TAX_COMP_PRO_INTEGRATION_SECRET>
Accept: application/json
```

Return the same JSON shape as the webhook. This endpoint is a fallback for missed/delayed webhook
delivery and should derive status from the main site's authoritative membership records.

## 4. Card issuance rule

Field Hub enables card issuance only when all of these are true:

- signup status is `MEMBERSHIP_ACTIVE`;
- membership status is `ACTIVE`;
- a permanent Tax Comp Pro user ID is present.

The database function rechecks those conditions atomically. It records `cardIssuedByStaffId` and
`cardIssuedAt` without changing `scannedByStaffId`, `attributedToStaffId`, `dubPartnerId`, or
`dubLinkId`.

## Vercel configuration

Configure these on the Field Hub Vercel project (Preview and Production as appropriate):

- `VITE_FIELD_HUB_EVENT_ID`
- `VITE_TAX_COMP_PRO_JOIN_URL`
- `DATABASE_URL` (pooled PostgreSQL URL)
- `DIRECT_DATABASE_URL` (direct PostgreSQL URL for Prisma)
- `FIELD_HUB_MEMBERSHIP_WEBHOOK_SECRET`
- `TAX_COMP_PRO_MEMBERSHIP_STATUS_URL`
- `TAX_COMP_PRO_INTEGRATION_SECRET`

Do not expose any secret with a `VITE_` prefix.
