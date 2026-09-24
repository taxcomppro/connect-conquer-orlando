import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";

import { AmbassadorFields, EMPTY_AMBASSADOR } from "@/components/AmbassadorFields";
import { Button } from "@/components/ui/button";
import { ambassadorInputSchema } from "@/lib/ambassadors";

export const Route = createFileRoute("/ambassador-apply")({
  head: () => ({
    meta: [
      { title: "Become a Brand Ambassador — Tax Compliance Pro" },
      {
        name: "description",
        content: "Apply to represent Tax Compliance Pro as a brand ambassador in your community.",
      },
      { property: "og:title", content: "Become a Brand Ambassador — Tax Compliance Pro" },
      {
        property: "og:description",
        content: "Share your details and our team will reach out about the ambassador program.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ApplyPage,
});

function ApplyPage() {
  const [values, setValues] = useState(EMPTY_AMBASSADOR);
  const [honey, setHoney] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = ambassadorInputSchema.safeParse(values);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the form.");
      return;
    }
    setStatus("sending");
    try {
      const res = await fetch("/api/public/ambassador-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, website_url: honey }),
      });
      const body = (await res.json()) as { ok: boolean; error?: string };
      if (!body.ok) throw new Error(body.error ?? "Something went wrong.");
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("idle");
    }
  }

  return (
    <main className="mx-auto w-full max-w-xl px-5 py-8">
      <div className="eyebrow">Tax Compliance Pro</div>
      <h1 className="mt-2 font-display text-3xl font-medium tracking-tight">
        Become a{" "}
        <span className="bg-gradient-to-r from-signal to-go bg-clip-text text-transparent">
          brand ambassador
        </span>
      </h1>
      {status === "done" ? (
        <div className="mt-6 rounded-xl border border-go/40 bg-panel p-5">
          <p className="font-display text-xl">Thank you!</p>
          <p className="mt-1 text-sm text-muted-foreground">
            We received your details and will be in touch soon.
          </p>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-4 rounded-xl border border-border bg-panel p-5">
          <AmbassadorFields values={values} onChange={setValues} />
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="hidden"
            value={honey}
            onChange={(e) => setHoney(e.target.value)}
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={status === "sending"}>
            {status === "sending" ? "Sending…" : "Apply now"}
          </Button>
        </form>
      )}
    </main>
  );
}
