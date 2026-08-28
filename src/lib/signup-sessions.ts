import type { Tables } from "@/integrations/supabase/types";

export type SignupSession = Tables<"signup_sessions">;
export type SignupSessionStatus = SignupSession["status"];

export const SIGNUP_STATUSES: SignupSessionStatus[] = [
  "CREATED",
  "QR_SCANNED",
  "CHECKOUT_STARTED",
  "MEMBERSHIP_ACTIVE",
  "CARD_ISSUED",
];

export const STATUS_LABELS: Record<SignupSessionStatus, string> = {
  CREATED: "QR ready",
  QR_SCANNED: "QR scanned",
  CHECKOUT_STARTED: "Checkout started",
  MEMBERSHIP_ACTIVE: "Ready for card",
  CARD_ISSUED: "Card issued",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
};

export const PRODUCT_REVIEW_LINKS = [
  {
    name: "TaxCompPro membership",
    note: "Review the platform, marketplace, communities, and membership tiers.",
    href: "https://www.taxcomppro.com",
  },
  {
    name: "Atlas AI",
    note: "Demonstrate real-time tax guidance before starting checkout.",
    href: "https://www.alwaysaskatlas.com",
  },
  {
    name: "ProConnect Card",
    note: "Show the tap-to-share profile the member can receive after activation.",
    href: "https://connect.taxcomppro.com",
  },
  {
    name: "Toolkits & courses",
    note: "Open the existing TaxCompPro product catalog.",
    href: "https://www.taxcomppro.com/toolkits",
  },
] as const;

export function buildMembershipJoinUrl(publicId: string): string {
  const base = import.meta.env["VITE_TAX_COMP_PRO_JOIN_URL"] || "https://www.taxcomppro.com/join";
  const url = new URL(base);
  url.searchParams.set("signupSession", publicId);
  return url.toString();
}

export function newSignupPublicId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(5));
  return `FH-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
}

export function currentEventId(eventName?: string | null): string {
  return import.meta.env["VITE_FIELD_HUB_EVENT_ID"] || eventName || "IRS-FORUM-ORLANDO-2026";
}

const DEVICE_KEY = "tcpc-field-hub-device-id";
const SESSION_KEY = "tcpc-field-hub-session-id";

function getOrCreate(storage: Storage, key: string): string {
  const existing = storage.getItem(key);
  if (existing) return existing;
  const value = crypto.randomUUID();
  storage.setItem(key, value);
  return value;
}

export function getStaffDeviceId(): string {
  return getOrCreate(localStorage, DEVICE_KEY);
}

export function getStaffSessionId(): string {
  return getOrCreate(sessionStorage, SESSION_KEY);
}

export function isReadyForCard(session: SignupSession): boolean {
  return (
    session.status === "MEMBERSHIP_ACTIVE" &&
    session.membership_status === "ACTIVE" &&
    Boolean(session.tax_comp_pro_user_id)
  );
}
