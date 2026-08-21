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

type AuthSearch = { next?: string };

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): AuthSearch => ({
    next: typeof search["next"] === "string" ? search["next"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Booth Staff Sign In — TCPC Lead Scanner" },
      {
        name: "description",
        content:
          "Sign in to the Tax Compliance Pro booth scanner to capture and qualify leads at the IRS Nationwide Tax Forum.",
      },
      { property: "og:title", content: "Booth Staff Sign In — TCPC Lead Scanner" },
      {
        property: "og:description",
        content: "Sign in to the Tax Compliance Pro booth scanner for the IRS Forum in Orlando.",
      },
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

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && session) {
      navigate({ to: safeNext(next), replace: true });
    }
  }, [loading, session, navigate, next]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}${safeNext(next)}`,
            data: { display_name: displayName || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("Account created. You're on the booth roster.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sign in failed.");
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
      toast.error("Google sign-in failed. Try email instead.");
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
          lede="Every scan is attributed to the person who captured it. Sign in once at the start of your shift."
        />

        <form
          onSubmit={handleSubmit}
          className="mt-7 space-y-4 rounded-xl border border-border bg-panel p-5"
        >
          {mode === "signup" ? (
            <div className="space-y-2">
              <Label htmlFor="name">Your name</Label>
              <Input
                id="name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Jordan Ellis"
                autoComplete="name"
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
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

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />
          </div>

          <Button type="submit" disabled={busy} className="h-11 w-full">
            {mode === "signup" ? "Create booth account" : "Sign in"}
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

          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="w-full pt-1 text-center text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            {mode === "signin"
              ? "New on the team? Create an account"
              : "Already have an account? Sign in"}
          </button>
        </form>
      </div>
    </FieldShell>
  );
}
