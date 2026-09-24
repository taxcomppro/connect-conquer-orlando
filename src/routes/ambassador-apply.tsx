import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { ArrowRight, Radio, Sparkles, Users } from "lucide-react";

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
    <main className="relative isolate min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 opacity-70 [background-image:linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] [background-size:64px_64px] [mask-image:linear-gradient(to_bottom,black,transparent_75%)]" />

      <header className="relative mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-6 sm:px-8">
        <div>
          <p className="font-display text-lg font-semibold">Tax Compliance Pro</p>
          <p className="eyebrow text-[9px] text-gold">Connect · Comply · Grow</p>
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase text-go">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-go opacity-50 motion-reduce:animate-none" />
            <span className="relative inline-flex size-2 rounded-full bg-go" />
          </span>
          Applications open
        </div>
      </header>

      <div className="relative mx-auto grid w-full max-w-6xl gap-10 px-5 pb-16 pt-8 sm:px-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(440px,1.1fr)] lg:gap-16 lg:pt-16">
        <section className="lg:sticky lg:top-10 lg:self-start">
          <div className="inline-flex items-center gap-2 rounded-full border border-go-line bg-go-soft px-3 py-1.5 font-mono text-[10px] uppercase text-go">
            <Radio className="size-3.5" /> The Ambassador Experience · Pro Talks
          </div>
          <h1 className="mt-6 max-w-xl font-display text-5xl leading-[1.02] font-medium sm:text-6xl">
            Your voice can move the{" "}
            <span className="text-go">tax profession forward.</span>
          </h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-muted-foreground sm:text-lg">
            Join a trusted circle of professionals helping Tax Compliance Pro connect, educate,
            and strengthen the tax community.
          </p>

          <div className="mt-8 grid max-w-lg gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <div className="flex items-start gap-3 border-l-2 border-signal-line bg-signal-soft p-4">
              <Users className="mt-0.5 size-5 shrink-0 text-signal" />
              <div>
                <p className="text-sm font-semibold">Build community</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Connect tax professionals with people and resources that help them grow.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 border-l-2 border-go-line bg-go-soft p-4">
              <Sparkles className="mt-0.5 size-5 shrink-0 text-go" />
              <div>
                <p className="text-sm font-semibold">Create real impact</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Share your influence and help shape a stronger professional network.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="application-title" className="relative">
          <div className="absolute -inset-px bg-gradient-to-br from-signal-line via-border to-go-line blur-sm" />
          <div className="relative border border-border bg-panel p-5 shadow-2xl sm:p-8">
            <div className="mb-7 flex items-start justify-between gap-4 border-b border-border pb-5">
              <div>
                <p className="eyebrow text-gold">Join the experience</p>
                <h2 id="application-title" className="mt-2 font-display text-3xl font-medium">
                  Ambassador application
                </h2>
              </div>
              <span className="font-mono text-xs text-muted-foreground">01 / 01</span>
            </div>

            {status === "done" ? (
              <div className="border border-go-line bg-go-soft p-6 sm:p-8">
                <div className="mb-5 flex size-11 items-center justify-center rounded-full bg-go text-go-foreground">
                  <Sparkles className="size-5" />
                </div>
                <p className="font-display text-3xl">You’re on the list.</p>
                <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
                  We received your details. Our team will review your application and be in touch
                  soon.
                </p>
              </div>
            ) : (
              <form
                onSubmit={submit}
                className="space-y-6 [&_input]:h-11 [&_input]:border-border [&_input]:bg-background/60 [&_input]:px-3 [&_input]:focus-visible:border-signal-line [&_label]:font-mono [&_label]:text-[10px] [&_label]:uppercase [&_label]:text-muted-foreground"
              >
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
                {error ? (
                  <p className="border-l-2 border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                  </p>
                ) : null}
                <Button
                  type="submit"
                  size="lg"
                  className="h-12 w-full bg-gradient-to-r from-signal to-go text-signal-foreground shadow-lg hover:opacity-90"
                  disabled={status === "sending"}
                >
                  {status === "sending" ? "Sending…" : "Apply to become an ambassador"}
                  {status !== "sending" ? <ArrowRight className="size-4" /> : null}
                </Button>
                <p className="text-center text-xs leading-5 text-muted-foreground">
                  By applying, you agree to be contacted about the Tax Compliance Pro ambassador
                  program.
                </p>
              </form>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
