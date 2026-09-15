# Field Hub CRM Layout, Dashboard, and Kanban

## Goal
Give signed-in staff a persistent CRM workspace while preserving every existing screen’s behavior and the current Field Hub visual language.

## What will change

### 1. Persistent authenticated shell
- Wrap the existing authenticated route outlet with the provided shadcn sidebar system.
- Add icon navigation for Dashboard, Leads, Pipeline, Broadcast, Automations, DUB, Briefing, and Admin.
- Highlight the active destination and retain the sidebar’s desktop mini-collapse behavior.
- Use the component’s mobile drawer with an always-visible menu trigger, so navigation remains accessible on phones and tablets.
- Keep the public hub, sign-in page, public join/profile/card pages, and API endpoints outside this shell.
- Change successful sign-in’s default destination from the scanner to Dashboard; explicit return destinations still win.

### 2. Dashboard
- Add a protected `/dashboard` page with its own page metadata.
- Read `leads` and `signup_sessions` through the same signed-in browser data path already used by Leads and Pipeline.
- Show existing-style Panel KPI cards for:
  - total leads scanned,
  - conversion rate (`sale_closed ÷ total leads`),
  - today’s scans using the lead scan timestamp,
  - signup progress by the five active stages.
- Keep loading, empty, and data-error states clear without changing any existing business logic.

### 3. Pipeline Kanban
- Keep the current pipeline data refresh, search, links into signup/card activation, and migration export.
- Replace the flat filtered list with five stage columns: Scanned, Signup sent, Membership confirmed, Ready for card, and Card issued.
- Render each signup session as a compact existing-style card in its current stage, including its name, company, rep, and DUB code where available.
- Preserve search across all columns; empty columns remain visible so the full workflow is always clear.
- Make the board horizontally scrollable on smaller screens rather than compressing cards until text becomes unreadable.

## Technical details
- Add a focused authenticated navigation component and mount it in the existing `_authenticated` layout route.
- Use TanStack `Link` active state and the existing sidebar primitives; do not create a parallel navigation system.
- Reuse `FieldShell`, `PageTitle`, `Panel`, `SectionLabel`, stage labels/tones, and semantic color tokens.
- Add the Dashboard route in the same batch as its navigation link so route typing remains valid.
- Verify desktop collapse, mobile drawer navigation, Dashboard metrics, Kanban rendering, existing page navigation, and authenticated redirects in the running app.
