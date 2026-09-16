# Fix Pipeline Width and Rename to Membership Hub

## Goal
Make the membership board fully usable at every screen width and rename the current CRM identity to “Membership Hub” everywhere users see it.

## Changes
- Remove the width constraint that clips the five-column Pipeline board inside the sidebar layout.
- Keep the rest of each page fixed to the available screen while giving the board its own smooth horizontal scroll area.
- Ensure the scroll area works on desktop, tablet, and mobile without shifting the entire page sideways.
- Replace current product-name references such as “Field Hub,” “TCPC Field Hub,” and “Field Hub · Member CRM” with “Membership Hub” in navigation, headings, sign-in copy, page metadata, and current CRM messaging.
- Preserve historical Orlando and Booth 540 wording where it describes the archived event rather than the current product name.
- Verify the Pipeline visually at desktop and mobile widths, including the final Marketplace+ column and sidebar open/collapsed states.

## Technical details
- Let the authenticated page outlet resolve to the sidebar inset’s actual available width with `w-0 min-w-0 flex-1` containment.
- Move the Pipeline board’s wide track into a bounded `max-w-full overflow-x-auto` viewport rather than relying on negative page margins.
- Update visible branding and route metadata without renaming internal code, database fields, or historical records.
