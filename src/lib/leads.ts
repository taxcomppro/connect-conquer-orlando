import type { BadgeRecord } from "./edc.server";
import type { Tables } from "@/integrations/supabase/types";

export type Lead = Tables<"leads">;

export const RATINGS = ["hot", "warm", "cold"] as const;
export type Rating = (typeof RATINGS)[number];

export const INTEREST_OPTIONS = [
  "Atlas AI",
  "TaxCompPro Membership",
  "ProConnect Card",
  "Atlas Academy",
  "30 Day Launch",
  "Schedule C Recon",
  "IRS Fine Defense",
  "Audit Playbook",
] as const;

export type LeadDraft = {
  attendee_id: string;
  prefix: string | null;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  suffix: string | null;
  nickname: string | null;
  title: string | null;
  company: string | null;
  department: string | null;
  address1: string | null;
  address2: string | null;
  address3: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  country_code: string | null;
  phone: string | null;
  fax: string | null;
  email: string | null;
  website: string | null;
  event_name: string | null;
  demographics: string | null;
  qualifiers: string | null;
  association: string | null;
  credential: string | null;
  lookup_status: string;
};

function nullify(value: string): string | null {
  const trimmed = value.trim();
  return trimmed && trimmed !== "*" ? trimmed : null;
}

export function badgeToDraft(record: BadgeRecord): LeadDraft {
  return {
    attendee_id: record.attendeeId,
    prefix: nullify(record.prefix),
    first_name: nullify(record.firstName),
    middle_name: nullify(record.middleName),
    last_name: nullify(record.lastName),
    suffix: nullify(record.suffix),
    nickname: nullify(record.nickname),
    title: nullify(record.title),
    company: nullify(record.company),
    department: nullify(record.department),
    address1: nullify(record.address1),
    address2: nullify(record.address2),
    address3: nullify(record.address3),
    city: nullify(record.city),
    state: nullify(record.state),
    postal_code: nullify(record.postalCode),
    country: nullify(record.country),
    country_code: nullify(record.countryCode),
    phone: nullify(record.phone),
    fax: nullify(record.fax),
    email: nullify(record.email),
    website: nullify(record.website),
    event_name: nullify(record.eventName),
    demographics: nullify(record.demographics),
    qualifiers: nullify(record.qualifiers),
    association: nullify(record.association),
    credential: nullify(record.credential),
    lookup_status: "found",
  };
}

export function pendingDraft(attendeeId: string): LeadDraft {
  return {
    attendee_id: attendeeId,
    prefix: null,
    first_name: null,
    middle_name: null,
    last_name: null,
    suffix: null,
    nickname: null,
    title: null,
    company: null,
    department: null,
    address1: null,
    address2: null,
    address3: null,
    city: null,
    state: null,
    postal_code: null,
    country: null,
    country_code: null,
    phone: null,
    fax: null,
    email: null,
    website: null,
    event_name: null,
    demographics: null,
    qualifiers: null,
    association: null,
    credential: null,
    lookup_status: "pending",
  };
}

export function leadName(lead: Pick<Lead, "first_name" | "last_name" | "attendee_id">): string {
  const name = [lead.first_name, lead.last_name].filter(Boolean).join(" ").trim();
  return name || `Badge ${lead.attendee_id}`;
}

export function toCsv(leads: Lead[]): string {
  const columns: (keyof Lead)[] = [
    "attendee_id",
    "prefix",
    "first_name",
    "last_name",
    "suffix",
    "credential",
    "title",
    "company",
    "department",
    "email",
    "phone",
    "website",
    "address1",
    "address2",
    "city",
    "state",
    "postal_code",
    "country",
    "rating",
    "joined_tcpc",
    "interests",
    "notes",
    "lookup_status",
    "scanned_at",
  ];

  const escape = (value: unknown): string => {
    if (value == null) return "";
    const text = Array.isArray(value) ? value.join("; ") : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  const header = columns.join(",");
  const rows = leads.map((lead) => columns.map((c) => escape(lead[c])).join(","));
  return [header, ...rows].join("\n");
}
