# Signed-in identity and navigation cleanup

## Changes
- Show the signed-in staff member’s display name at the top-right of every signed-in page, with their email as a fallback.
- Keep Dashboard and Pipeline prominent, remove DUB from the main sidebar, and place Scan at the very bottom.
- Keep DUB accessible through the admin-only Referral Attribution card.
- Confirm Jennifer Lewis, Tonique Clay, and Tracina Morris have administrator access without granting it to other staff.

## Technical details
- Read the current user’s existing staff profile in the authenticated layout.
- Split the sidebar into primary and deferred navigation groups so Scan remains last.
- Preserve the existing admin authorization checks and DUB route protection.
