import type { Tables } from "@/integrations/supabase/types";

export type SignupSession = Tables<"signup_sessions">;
export type ConnectProfile = Tables<"connect_profiles">;
export type CardToken = Tables<"card_tokens">;

export const STAGES = [
  "scanned",
  "signup_sent",
  "membership_confirmed",
  "ready_for_card",
  "card_issued",
  "void",
] as const;

export type Stage = (typeof STAGES)[number];

export const STAGE_LABEL: Record<Stage, string> = {
  scanned: "Scanned",
  signup_sent: "Signup link shown",
  membership_confirmed: "Membership confirmed",
  ready_for_card: "Ready for card",
  card_issued: "Card issued",
  void: "Void",
};

export const STAGE_TONE: Record<Stage, string> = {
  scanned: "border-border bg-panel text-muted-foreground",
  signup_sent: "border-signal-line bg-signal-soft text-signal",
  membership_confirmed: "border-gold/50 bg-gold/10 text-gold",
  ready_for_card: "border-go-line bg-go-soft text-go",
  card_issued: "border-go-line bg-go-soft text-go",
  void: "border-border bg-muted text-muted-foreground",
};

/** Where the salesperson sends the customer to buy a membership. */
export const MEMBERSHIP_URL = "https://www.taxcomppro.com/connect";

/** Public origin for the Field Hub — used in welcome texts and card URLs. */
export const FIELD_HUB_URL = "https://fieldhub.taxcomppro.com";

/**
 * Canonical origin used when writing NFC cards. Cards must carry the published
 * domain, never a preview URL, so the activation station lets staff pin it and
 * remembers the choice.
 */
export const CARD_BASE_STORAGE_KEY = "tcpc.cardBaseUrl";

export function cardUrl(base: string, token: string): string {
  return `${base.replace(/\/+$/, "")}/c/${token}`;
}

export function profileUrl(base: string, slug: string): string {
  return `${base.replace(/\/+$/, "")}/p/${slug}`;
}

export function joinUrl(base: string, sessionId: string): string {
  return `${base.replace(/\/+$/, "")}/join/${sessionId}`;
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function sessionName(session: SignupSession): string {
  return session.full_name?.trim() || session.email || "Unnamed attendee";
}
