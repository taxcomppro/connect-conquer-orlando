import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { FieldShell, PageTitle, SectionLabel } from "@/components/FieldShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useInbound } from "@/hooks/useInbound";
import { digitsOnly } from "@/lib/inbox.functions";

export const Route = createFileRoute("/_authenticated/inbox")({
  head: () => ({
    meta: [
      { title: "Inbox — Membership Hub" },
      {
        name: "description",
        content:
          "Every text and email reply members send back, newest first, with a link straight to that contact's conversation.",
      },
      { property: "og:title", content: "Inbox — Membership Hub" },
      {
        property: "og:description",
        content: "Inbound texts and email replies from leads and members in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InboxPage,
});

function InboxPage() {
  const { items, loading, refresh, markAllRead } = useInbound();
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!loading) markAllRead();
  }, [loading, markAllRead]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const digits = digitsOnly(query);
    if (!q) return items;
    return items.filter(
      (item) =>
        [item.name, item.contact, item.body, item.subject]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q)) ||
        (digits.length >= 3 && digitsOnly(item.contact).includes(digits)),
    );
  }, [items, query]);

  return (
    <FieldShell eyebrowRight="Replies">
      <PageTitle
        title="Inbox"
        accent="replies"
        lede="Texts and email replies members send back. Newest first — open one to reply in their thread."
      />

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, phone number or message…"
          className="h-11"
        />
        <Button variant="outline" className="h-11 sm:w-40" onClick={() => void refresh()}>
          Refresh
        </Button>
      </div>

      <SectionLabel>{loading ? "Loading…" : `${visible.length} received`}</SectionLabel>
      <div className="space-y-2">
        {visible.map((item) => {
          const body = (
            <>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-medium">{item.name || item.contact}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {item.name ? item.contact : null}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`rounded-full border px-2.5 py-1 text-xs ${
                      item.channel === "sms"
                        ? "border-signal-line bg-signal-soft text-signal"
                        : "border-go-line bg-go-soft text-go"
                    }`}
                  >
                    {item.channel === "sms" ? "Text" : "Email"}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {new Date(item.sentAt).toLocaleString()}
                  </span>
                </div>
              </div>
              {item.subject ? (
                <div className="mt-2 text-sm font-medium">{item.subject}</div>
              ) : null}
              <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{item.body}</p>
            </>
          );

          const className =
            "block rounded-xl border border-border bg-panel p-4 transition-colors hover:bg-panel-hover";

          if (item.email) {
            return (
              <Link
                key={item.id}
                to="/contact/$email"
                params={{ email: encodeURIComponent(item.email) }}
                className={className}
              >
                {body}
              </Link>
            );
          }
          if (item.attendeeId) {
            return (
              <Link
                key={item.id}
                to="/lead/$attendeeId"
                params={{ attendeeId: item.attendeeId }}
                className={className}
              >
                {body}
              </Link>
            );
          }
          return (
            <div key={item.id} className={className}>
              {body}
            </div>
          );
        })}
        {!loading && visible.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-3 py-8 text-center text-xs text-muted-foreground">
            No replies yet. Anything texted back to the members line lands here.
          </div>
        ) : null}
      </div>
    </FieldShell>
  );
}
