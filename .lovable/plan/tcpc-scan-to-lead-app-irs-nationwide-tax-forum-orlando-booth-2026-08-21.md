# TCPC Scan-to-Lead App — IRS Nationwide Tax Forum, Orlando (Booth 540)

Build a badge-scanning lead capture app for the booth, with a TCPC join flow, styled and linked as part of the existing Tax Compliance Pro Field Hub.

## What the team gets

1. **Scan** — a staff member opens the app on a booth tablet or phone, points the camera at the attendee's badge QR (badges encode an ID like `A1234567`), and the attendee's full record appears in about a second: name, title, company, address, email, phone, credentials.
2. **Qualify** — staff tag the lead (Hot / Warm / Cold), check off interests (Atlas AI, ProConnect Card, Academy, toolkits), note whether they joined TCPC, and dictate or type a quick note. Scanner's name is attached automatically.
3. **Join TCPC** — one tap opens a join screen pre-filled with the scanned badge data. The attendee confirms their info and submits; they land in the lead list flagged as a member sign-up and get sent to taxcomppro.com to finish.
4. **Track** — a live booth dashboard shows scans today, sign-ups, leads per staffer, and a running feed. Any lead can be exported to CSV for follow-up after the show.
5. **Field Hub tile** — a new card on the Field Hub home grid ("Lead Scanner — Booth 540") so it sits alongside the product demos the team already taps into.

## How the badge lookup works

The purchased kit is the **EDC RetrieveMyLeads Metadata API v1.1**:

- Endpoint: `POST https://retrievemyleads.com/api/meta/1.1/read/` with form fields `sid` (show ID), `key` (application GUID), `aid` (attendee badge ID).
- Returns JSON with `good=1` plus fields `pre, first, mid, last, suf, titl, com, dept, add1-3, city, st, zip, coun, cc, pho, fax, email, url, evnt, demo, qual, asso, cred, nick`.
- `good=0` with a message means the record is in a pending batch update — the app keeps the scan and lets staff fill in details manually, then retry the lookup later.
- Errors: `400` missing parameter, `410` bad credentials. Each maps to a clear on-screen message rather than a silent failure.
- Badge QR payload is the attendee ID with a letter prefix (`A1234567`); the app strips non-digits before calling the API.
- There is also a `write` endpoint (same auth, full field list) if you ever need to push corrected records back. Not used in v1.

The show key is a credential and never ships to the browser. All API calls go through a server function; the `sid` and `key` are stored as project secrets.

## Sandbox first, live key at swap time

Until the production Show ID and Application Key for the Orlando forum are in hand, the app runs against the documented sandbox (`sid=sandbox`, attendee IDs 65610972–65610992, matching the CSV in the kit). Swapping to live is a secrets change only — no code edits. If EDC's sandbox key has rotated since the kit was issued, the app still runs end to end using the kit's CSV as a local fixture so the flow can be rehearsed before the show.

## Design

Matches the Field Hub exactly: black background with blue/green radial washes, `#37A6FF` blue and `#86D93C` green accents, gold `#E8BE55` detail, Fraunces headlines, Inter body, IBM Plex Mono eyebrows. Big touch targets, one-handed layout, works in booth lighting. Add-to-home-screen ready like the hub.

## Offline resilience

Booth Wi-Fi at convention centers is unreliable. Every scan is written locally first and syncs when the connection returns, so no lead is ever lost. A visible indicator shows pending-sync count. Manual ID entry is always available as a fallback if the camera struggles with a laminated badge.

---

## Technical section

**Backend:** Lovable Cloud (Postgres + auth + storage).

Tables:
- `leads` — attendee id, all EDC metadata fields, rating, interests (array), joined_tcpc flag, notes, scanned_by (user id), scanned_at, sync/lookup status.
- `staff_profiles` — display name per authenticated staff user, for attribution and leaderboard.
- `join_submissions` — TCPC join confirmations linked to a lead.

RLS: staff-only. Authenticated users read all booth leads (team visibility) and insert/update their own scans; a `user_roles` table with a `has_role` security-definer function gates admin actions (export, delete). Explicit `GRANT`s to `authenticated` and `service_role` on every table.

**Auth:** email/password sign-in for the 12 staff. Simple, no email confirmation friction — team accounts created ahead of the show.

**API integration:** `src/lib/edc.functions.ts` exposes `lookupBadge` via `createServerFn` with `requireSupabaseAuth` middleware; the handler reads `EDC_SHOW_ID` and `EDC_APP_KEY` from `process.env` inside the handler, POSTs form-encoded to the v1.1 read endpoint, normalizes the response into a typed lead record, and maps `good=0` / 400 / 410 into distinct results. HTTP work lives in `edc.server.ts`; the functions file stays a thin wrapper.

**Scanning:** `html5-qrcode` (or `@zxing/browser`) for camera decode in the browser, plus a keyboard-wedge input path so a handheld scanner works, plus manual entry.

**Offline:** IndexedDB queue (idb-keyval) holding unsynced scans; a sync effect flushes to Cloud on reconnect, with dedupe on `(attendee_id, scanned_by)`.

**Routes:**
```text
/                      Field Hub styled launcher + tile grid (mirrors existing hub)
/scan                  camera scan + manual entry
/lead/$attendeeId      lead detail, qualify, notes
/join/$attendeeId      TCPC join flow, pre-filled
/leads                 list, filter, search, CSV export
/dashboard             live booth stats
/auth                  staff sign-in
```
Every content route gets its own `head()` with unique title/description/og tags.

**Field Hub integration:** the uploaded `fieldhub-site` is a static two-page site (index + itinerary, images inlined as data URIs). Rather than rewrite it, the scanner is a standalone app that carries the hub's design language; you add one tile to the hub's `products` array pointing at the deployed scanner URL. If you'd prefer the hub itself rebuilt inside this project (hub home, itinerary, and scanner all one app with shared nav), say so and it becomes part of the build.

**Secrets:** `EDC_SHOW_ID`, `EDC_APP_KEY`.

## What I need from you

- Production Show ID (`sid`) and Application Key (GUID) for the Orlando forum when available.
- The TCPC join destination URL (e.g. `https://www.taxcomppro.com/join`) so the join flow hands off correctly.
- The list of staff emails to pre-create accounts for.
