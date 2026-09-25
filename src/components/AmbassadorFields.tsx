import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AmbassadorInput } from "@/lib/ambassadors";

type Values = Record<keyof AmbassadorInput, string>;

export const EMPTY_AMBASSADOR: Values = {
  full_name: "",
  email: "",
  phone: "",
  business: "",
  city: "",
  state: "",
  instagram: "",
  facebook: "",
  tiktok: "",
  linkedin: "",
  referred_by: "",
};

const FIELDS: { key: keyof Values; label: string; type?: string; half?: boolean; required?: boolean }[] = [
  { key: "full_name", label: "Full name", required: true },
  { key: "email", label: "Email", type: "email", half: true, required: true },
  { key: "phone", label: "Phone", type: "tel", half: true, required: true },
  { key: "business", label: "Business name" },
  { key: "city", label: "City", half: true },
  { key: "state", label: "State", half: true },
  { key: "instagram", label: "Instagram", half: true },
  { key: "facebook", label: "Facebook", half: true },
  { key: "tiktok", label: "TikTok", half: true },
  { key: "linkedin", label: "LinkedIn", half: true },
  { key: "referred_by", label: "Referred by (who invited you?)" },
];

export function AmbassadorFields({
  values,
  onChange,
}: {
  values: Values;
  onChange: (next: Values) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {FIELDS.map((f) => (
        <div key={f.key} className={f.half ? "col-span-2 sm:col-span-1" : "col-span-2"}>
          <Label htmlFor={`amb-${f.key}`} className="mb-1 block text-xs">
            {f.label}
            {f.required ? " *" : ""}
          </Label>
          <Input
            id={`amb-${f.key}`}
            type={f.type ?? "text"}
            required={f.required}
            maxLength={200}
            value={values[f.key]}
            onChange={(e) => onChange({ ...values, [f.key]: e.target.value })}
          />
        </div>
      ))}
    </div>
  );
}
