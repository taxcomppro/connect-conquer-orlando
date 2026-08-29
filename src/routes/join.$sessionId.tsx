import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { getJoinSession, submitIntake } from "@/lib/booth.functions";
import { MEMBERSHIP_URL } from "@/lib/connect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

const SERVICE_OPTIONS = [
  "Individual returns",
  "Business returns",
  "Bookkeeping",
  "Payroll",
  "IRS representation",
  "Tax planning",
  "Entity formation",
  "Audit support",
];

export const Route = createFileRoute("/join/$sessionId")({
  head: () => ({
    meta: [
      { title: "Set up your ProConnect profile — Tax Compliance Pro" },
      {
        name: "description",
        content:
          "Finish your Tax Compliance Pro membership and set up the Connect profile your ProConnect card will open.",
      },
      { property: "og:title", content: "Set up your ProConnect profile" },
      {
        property: "og:description",
        content: "Complete your membership and Connect profile from the Tax Compliance Pro booth.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: JoinPage,
});

function JoinPage() {
  const { sessionId } = Route.useParams();
  const [loading, setLoading] = useState(true);
  const [valid, setValid] = useState(true);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [credential, setCredential] = useState("");
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [bio, setBio] = useState("");
  const [services, setServices] = useState<string[]>([]);
  const [showEmail, setShowEmail] = useState(false);
  const [showPhone, setShowPhone] = useState(false);
  const [showLocation, setShowLocation] = useState(true);
  const [membershipRef, setMembershipRef] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const session = await getJoinSession({ data: { sessionId } });
        if (!active) return;
        if (!session) {
          setValid(false);
        } else {
          setDisplayName(session.full_name ?? "");
          setEmail(session.email ?? "");
          setPhone(session.phone ?? "");
          setCompany(session.company ?? "");
          setTitle(session.title ?? "");
          if (session.slug) setDone(true);
        }
      } catch {
        if (active) setValid(false);
      }
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [sessionId]);

  function toggleService(value: string) {
    setServices((current) =>
      current.includes(value) ? current.filter((s) => s !== value) : [...current, value],
    );
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await submitIntake({
        data: {
          sessionId,
          displayName,
          credential,
          title,
          company,
          city,
          state,
          email,
          phone,
          website,
          bio,
          services,
          showEmail,
          showPhone,
          showLocation,
          membershipRef,
        },
      });
      setDone(true);
    } catch {
      toast.error("Couldn't save that. Check the connection and try again.");
    }
    setSaving(false);
  }

  if (loading) {
    return <Wrapper><p className="mt-10 eyebrow animate-pulse">Loading…</p></Wrapper>;
  }

  if (!valid) {
    return (
      <Wrapper>
        <h1 className="mt-10 font-display text-3xl">Link expired</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ask the Tax Compliance Pro team at Booth 540 to show you a fresh code.
        </p>
      </Wrapper>
    );
  }

  if (done) {
    return (
      <Wrapper>
        <div className="mt-10 rounded-3xl border border-go-line bg-go-soft p-6">
          <div className="eyebrow">You're set</div>
          <h1 className="mt-2 font-display text-3xl">Profile created</h1>
          <p className="mt-3 text-[15px] leading-relaxed">
            Head back to the Tax Compliance Pro booth and hand the team your ProConnect card. They'll
            activate it on the spot — your first tap opens this profile.
          </p>
        </div>
      </Wrapper>
    );
  }

  return (
    <Wrapper>
      <div className="pt-2">
        <h1 className="mt-6 font-display text-3xl leading-tight font-medium tracking-tight">
          Set up your <span className="text-signal">Connect profile</span>
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Two quick steps and the team can activate your ProConnect card before you leave the booth.
        </p>
      </div>

      <div className="mt-6 rounded-2xl border border-gold/40 bg-gold/10 p-5">
        <div className="eyebrow">Step 1 · Membership</div>
        <p className="mt-2 text-sm">
          Choose your plan and complete your Tax Compliance Pro membership.
        </p>
        <a
          href={MEMBERSHIP_URL}
          target="_blank"
          rel="noreferrer"
          className="mt-4 flex h-12 items-center justify-center rounded-xl border border-gold/60 bg-gold/20 text-base text-gold"
        >
          Open membership plans →
        </a>
      </div>

      <form onSubmit={save} className="mt-6 space-y-4">
        <div className="eyebrow">Step 2 · Your profile</div>

        <Field label="Full name" required value={displayName} onChange={setDisplayName} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Credential (EA, CPA…)" value={credential} onChange={setCredential} />
          <Field label="Title" value={title} onChange={setTitle} />
        </div>
        <Field label="Firm" value={company} onChange={setCompany} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="City" value={city} onChange={setCity} />
          <Field label="State" value={state} onChange={setState} />
        </div>
        <Field label="Email" type="email" value={email} onChange={setEmail} />
        <Field label="Phone" value={phone} onChange={setPhone} />
        <Field label="Website" value={website} onChange={setWebsite} />

        <div className="space-y-2">
          <Label htmlFor="bio">Short bio</Label>
          <Textarea
            id="bio"
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="What you do and who you serve."
          />
        </div>

        <div>
          <Label>Services</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {SERVICE_OPTIONS.map((option) => {
              const active = services.includes(option);
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => toggleService(option)}
                  className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                    active
                      ? "border-signal-line bg-signal-soft text-signal"
                      : "border-border bg-panel text-muted-foreground"
                  }`}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-panel p-4">
          <div className="eyebrow">Privacy</div>
          <p className="mt-1 mb-3 text-xs text-muted-foreground">
            Your contact details stay hidden unless you turn them on.
          </p>
          <Toggle label="Show my email on my profile" checked={showEmail} onChange={setShowEmail} />
          <Toggle label="Show my phone on my profile" checked={showPhone} onChange={setShowPhone} />
          <Toggle label="Show my city and state" checked={showLocation} onChange={setShowLocation} />
        </div>

        <Field
          label="Membership confirmation number (optional)"
          value={membershipRef}
          onChange={setMembershipRef}
        />

        <Button type="submit" disabled={saving} className="h-12 w-full text-base">
          {saving ? "Saving…" : "Create my profile"}
        </Button>
      </form>
    </Wrapper>
  );
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-xl px-5 pb-24 sm:px-7">
      <div className="pt-5 eyebrow">Tax Compliance Pro · Connect</div>
      {children}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  const id = label.toLowerCase().replace(/[^a-z]+/g, "-");
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/60 py-2 last:border-0">
      <span className="text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
