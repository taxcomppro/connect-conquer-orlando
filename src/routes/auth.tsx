import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/useAuth";
import { FieldShell, PageTitle } from "@/components/FieldShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AuthSearch = { next?: string | undefined };

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): AuthSearch => ({
    next: typeof search["next"] === "string" ? search["next"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Booth Staff Sign In — TCPC Field Hub" },
      {
        name: "description",
        content:
          "Approved booth staff sign in with a one-time email link to capture and qualify leads at the IRS Nationwide Tax Forum.",
      },
      { property: "og:title", content: "Booth Staff Sign In — TCPC Field Hub" },
      {
        property: "og:description",
        content: "Passwordless sign in for Tax Compliance Pro booth staff at the IRS Forum in Orlando.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function safeNext(next: string | undefined): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/scan";
}

function AuthPage() {
  const { next } = Route.useSearch();
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && session) {
      navigate({ to: safeNext(next), replace: true });
    }
  }, [loading, session, navigate, next]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const address = email.trim().toLowerCase();
    if (!address) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: address,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}${safeNext(next)}`,
        },
      });
      if (error) throw error;
      setSentTo(address);
      toast.success("Sign-in link sent. Check your email on this device.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not send the sign-in link.";
      toast.error(
        /approved booth staff|Database error saving new user|not allowed|signups not allowed/i.test(
          message,
        )
          ? "That email isn't on the approved booth staff list. Ask an admin to add it."
          : message,
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setBusy(false);
      toast.error("Google sign-in failed. Use the email link instead.");
      return;
    }
    if (result.redirected) return;
    navigate({ to: safeNext(next), replace: true });
  }

  return (
    <FieldShell eyebrowRight="Booth 540 · Orlando">
      <div className="mx-auto max-w-md">
        <PageTitle
          title="Booth staff"
          accent="sign in"
          lede="No passwords. Enter your approved booth email and we'll send a one-time sign-in link. Every scan is attributed to the person who captured it."
        />

        {sentTo ? (
          <div className="mt-7 space-y-4 rounded-xl border border-border bg-panel p-5">
            <p className="eyebrow">Link sent</p>
            <p className="text-sm text-muted-foreground">
              We emailed a sign-in link to <span className="text-foreground">{sentTo}</span>. Open it
              on this device to land straight in the Field Hub.
            </p>
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full"
              onClick={() => setSentTo(null)}
            >
              Use a different email
            </Button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="mt-7 space-y-4 rounded-xl border border-border bg-panel p-5"
          >
            <div className="space-y-2">
              <Label htmlFor="email">Approved booth email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@taxcompliancepro.com"
                autoComplete="email"
              />
            </div>

            <Button type="submit" disabled={busy} className="h-11 w-full">
              {busy ? "Sending link…" : "Email me a sign-in link"}
            </Button>

            <div className="flex items-center gap-3 py-1">
              <span className="h-px flex-1 bg-border" />
              <span className="eyebrow">or</span>
              <span className="h-px flex-1 bg-border" />
            </div>

            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={handleGoogle}
              className="h-11 w-full"
            >
              Continue with Google
            </Button>

            <p className="pt-1 text-center text-xs text-muted-foreground">
              Only emails on the approved booth staff list can get in.
            </p>
          </form>
        )}
      </div>
    </FieldShell>
  );
}
