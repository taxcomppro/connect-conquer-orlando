# Fix fieldhub.taxcomppro.com (secure connection error)

## What's wrong

The address `fieldhub` already points at Lovable in your GoDaddy DNS (the A record `185.158.133.1` is live and visible publicly). But the address was never actually added to this project, so no security certificate was ever issued for it. That's why the browser says "the connection for this site is not secure / unsupported protocol" instead of loading Field Hub.

Adding the DNS record alone isn't enough — the address also has to be registered on the project so the certificate can be issued.

## What to do

1. Open the connect card for `fieldhub.taxcomppro.com` in this chat.
2. The card will show the exact records needed, including the `_lovable` verification record that is currently missing from GoDaddy.
3. Add that verification record in GoDaddy (the A record is already correct and can stay).
4. Ownership check passes, then the certificate is issued automatically — usually minutes, up to 72 hours in the worst case.
5. Once it reads Active, `fieldhub.taxcomppro.com` serves the same Field Hub the team is using at `tax-pro-connect-hub.lovable.app`.

## Meanwhile

Keep the team on `https://tax-pro-connect-hub.lovable.app` — it is live and current. This also clears up the earlier confusion where the two addresses showed different lead counts: the old separate deployment behind that subdomain will stop being served once the address is properly connected here.
