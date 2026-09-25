import { z } from "zod";

export const AMBASSADOR_STAGES = [
  { key: "applied", label: "Applied" },
  { key: "invited", label: "Invited" },
  { key: "approved", label: "Approved" },
  { key: "registered", label: "Registered" },
  { key: "active", label: "Active" },
] as const;

export type AmbassadorStage = (typeof AMBASSADOR_STAGES)[number]["key"] | "archived";

export const STAGE_LABEL: Record<AmbassadorStage, string> = {
  applied: "Applied",
  invited: "Invited",
  approved: "Approved",
  registered: "Registered",
  active: "Active",
  archived: "Archived",
};

const opt = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));

export const ambassadorInputSchema = z.object({
  full_name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().email("Enter a valid email").max(160),
  phone: z.string().trim().min(1, "Phone number is required").max(40),
  business: opt(160),
  city: opt(80),
  state: opt(40),
  instagram: opt(200),
  facebook: opt(200),
  tiktok: opt(200),
  linkedin: opt(200),
});

export type AmbassadorInput = z.input<typeof ambassadorInputSchema>;
