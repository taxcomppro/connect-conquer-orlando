import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { FieldShell, PageTitle, SectionLabel } from "@/components/FieldShell";

export const Route = createFileRoute("/_authenticated/briefing")({
  head: () => ({
    meta: [
      { title: "Orlando Trip Briefing — TCPC Field Hub" },
      {
        name: "description",
        content:
          "Private schedule, wardrobe, lodging and evening plans for the TCPC IRS Forum team.",
      },
    ],
  }),
  component: TripBriefing,
});

const SCHEDULE = [
  {
    label: "Set-Up",
    day: "Monday",
    time: "1:00 – 6:00 PM",
    note: "Everyone arrives at different times—head to Booth 540 when you land.",
  },
  { label: "Show Floor — Day 1", day: "Tuesday", time: "11:00 AM – 6:00 PM" },
  { label: "Show Floor — Day 2", day: "Wednesday", time: "10:00 AM – 2:30 PM" },
  { label: "Dismantle", day: "Wednesday", time: "2:30 – 4:30 PM" },
];

const WARDROBE = [
  {
    day: "Monday",
    occasion: "Arrival & Set-Up",
    attire: "Team T-shirt—comfortable for travel and setting up the booth.",
  },
  {
    day: "Tuesday",
    occasion: "Show Floor — Day 1",
    attire: "Polo shirt—your choice of black or white.",
  },
  {
    day: "Wednesday",
    occasion: "Show Floor — Day 2",
    attire: "Atlas AI jersey—to match the baseball-themed demo room.",
  },
];

const EVENINGS = [
  {
    day: "Monday",
    plan: "Q&A Kickback",
    detail: "At the house—a chance to get everyone up to speed before the show.",
  },
  {
    day: "Tuesday",
    plan: "Hotel Mixer",
    detail: "After the forum wraps—mix and mingle with fellow attendees at the hotel.",
  },
  {
    day: "Wednesday",
    plan: "Blue Martini Mixer",
    detail: "Business mixer at Blue Martini in Orlando.",
  },
];

function TripBriefing() {
  return (
    <FieldShell eyebrowRight="Private team briefing" back={{ to: "/", label: "Field Hub" }}>
      <PageTitle
        title="Orlando trip"
        accent="briefing."
        lede="Show hours, where to be and what to wear for the IRS Nationwide Tax Forum, September 1–3."
      />

      <SectionLabel>Exhibitor schedule</SectionLabel>
      <div className="grid gap-3 sm:grid-cols-2">
        {SCHEDULE.map((item) => (
          <InfoCard key={`${item.day}-${item.label}`} title={item.label} eyebrow={item.day}>
            <div className="font-display text-xl">{item.time}</div>
            {item.note ? <p className="mt-2 text-sm text-muted-foreground">{item.note}</p> : null}
          </InfoCard>
        ))}
      </div>

      <SectionLabel>Booth &amp; demo room</SectionLabel>
      <div className="grid gap-3 sm:grid-cols-2">
        <InfoCard title="Booth Assignment" eyebrow="Exhibit floor">
          <div className="font-display text-2xl text-signal">540</div>
        </InfoCard>
        <InfoCard title="Bonaire 6 (Classroom)" eyebrow="Baseball-themed demo room">
          <div className="font-display text-lg">Wednesday, September 2</div>
          <div className="mt-1 text-sm text-muted-foreground">10:00 AM – 12:00 PM</div>
        </InfoCard>
      </div>

      <SectionLabel>Lodging</SectionLabel>
      <div className="rounded-2xl border border-border bg-panel p-5 sm:p-6">
        <div className="eyebrow">Veranda Palms Resort · Kissimmee</div>
        <h2 className="mt-2 font-display text-2xl">Team house</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          12 bedrooms · 15 beds · 11 baths · pool and spa
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <BriefItem
            label="Location"
            value="Kissimmee, Florida · exact address is in the team travel confirmation"
          />
          <BriefItem label="Check-in" value="Sunday, August 30 · 4:00 PM" />
          <BriefItem label="Check-out" value="Thursday, September 3 · 10:00 AM" />
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <InfoCard title="Parking" eyebrow="At the house">
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>2 garage spaces and 3 driveway spaces</li>
            <li>No street, sidewalk or grass parking</li>
            <li>Overflow parking is at the clubhouse, first-come, first-served</li>
          </ul>
        </InfoCard>
        <InfoCard title="House Rules" eyebrow="Please review">
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>No smoking anywhere inside the house</li>
            <li>Grill use is $100 with propane included; notify the host first</li>
            <li>No parties or outside events; keep team activities respectful of the property</li>
          </ul>
        </InfoCard>
      </div>

      <SectionLabel>Daily wardrobe</SectionLabel>
      <div className="grid gap-3 sm:grid-cols-3">
        {WARDROBE.map((item) => (
          <InfoCard key={item.day} title={item.occasion} eyebrow={item.day}>
            <p className="text-sm text-muted-foreground">{item.attire}</p>
          </InfoCard>
        ))}
      </div>

      <SectionLabel>Evening plans</SectionLabel>
      <div className="rounded-xl border border-gold/40 bg-gold/10 p-4">
        <div className="eyebrow text-gold">Dress code</div>
        <p className="mt-2 text-sm">
          Business casual for every outing. For men: no hats, tank tops or open-toed shoes.
        </p>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {EVENINGS.map((item) => (
          <InfoCard key={item.day} title={item.plan} eyebrow={item.day}>
            <p className="text-sm text-muted-foreground">{item.detail}</p>
          </InfoCard>
        ))}
      </div>

      <div className="mt-10 text-center">
        <Link to="/" className="eyebrow hover:text-foreground">
          Back to Field Hub →
        </Link>
      </div>
    </FieldShell>
  );
}

function InfoCard({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-panel p-4">
      <div className="eyebrow">{eyebrow}</div>
      <h2 className="mt-1 font-display text-lg">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function BriefItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/50 p-3">
      <div className="eyebrow">{label}</div>
      <div className="mt-1 text-sm">{value}</div>
    </div>
  );
}
