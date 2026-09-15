import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Field Hub now opens on the membership pipeline. The old event-briefing hub
 * still lives at /hub, and Scan / Leads stay reachable from the sidebar.
 */
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/pipeline" });
  },
  head: () => ({
    meta: [
      { title: "Field Hub — Member CRM" },
      {
        name: "description",
        content:
          "The Tax Compliance Pro member CRM: membership tiers, leads, follow-up texting and email, and conversion tracking.",
      },
      { property: "og:title", content: "Field Hub — Member CRM" },
      {
        property: "og:description",
        content: "Track TCPC leads and members from first scan to paid membership.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => null,
});
