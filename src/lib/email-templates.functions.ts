import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Tables } from "@/integrations/supabase/types";

export type EmailTemplate = Tables<"email_templates">;

export const listEmailTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("email_templates")
      .select("*")
      .order("is_default", { ascending: false })
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return { templates: data ?? [] };
  });

export const saveEmailTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { name: string; subject: string; htmlBody: string; isDefault?: boolean | undefined }) => {
      const name = input.name.trim();
      const subject = input.subject.trim();
      const htmlBody = input.htmlBody.trim();
      if (!name) throw new Error("Template name is required.");
      if (!subject) throw new Error("Subject line is required.");
      if (!htmlBody) throw new Error("Template body is required.");
      return { name, subject, htmlBody, isDefault: Boolean(input.isDefault) };
    },
  )
  .handler(async ({ data, context }) => {
    const { data: inserted, error } = await context.supabase
      .from("email_templates")
      .insert({
        name: data.name,
        subject: data.subject,
        html_body: data.htmlBody,
        is_default: data.isDefault,
        created_by: context.userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { template: inserted as EmailTemplate };
  });
