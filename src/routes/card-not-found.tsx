import { createFileRoute } from "@tanstack/react-router";
import { FieldShell, PageTitle } from "@/components/FieldShell";

export const Route = createFileRoute("/card-not-found")({
  head: () => ({
    meta: [
      { title: "Card not active — ProConnect" },
      {
        name: "description",
        content: "This ProConnect card has not been activated yet. Visit the booth to finish setup.",
      },
      { property: "og:title", content: "Card not active — ProConnect" },
      { property: "og:description", content: "This ProConnect card is not linked to a profile yet." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <FieldShell eyebrowRight="ProConnect">
      <PageTitle
        title="This card isn't"
        accent="active yet"
        lede="Stop by Booth 540 and the team will finish activating it in under a minute."
      />
    </FieldShell>
  ),
});
