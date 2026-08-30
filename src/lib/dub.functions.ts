import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!data) throw new Error("Admins only.");
}

export const dubStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => ({ connected: Boolean(process.env["DUB_API_KEY"]) }));

/** Creates the pooled booth link if it doesn't exist, otherwise returns it. */
export const ensureBoothLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { key: string; url: string; workspaceId?: string | undefined; groupId?: string | undefined }) => {
    const key = input.key.trim().toLowerCase();
    if (!/^[a-z0-9-_/]{2,60}$/.test(key)) throw new Error("Use letters, numbers and dashes only.");
    if (!/^https?:\/\//.test(input.url.trim())) throw new Error("Destination must be a full URL.");
    return {
      key,
      url: input.url.trim(),
      workspaceId: input.workspaceId?.trim() || undefined,
      groupId: input.groupId?.trim() || undefined,
    };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { ensureLink } = await import("./dub.server");
    const { link, created } = await ensureLink({
      key: data.key,
      url: data.url,
      workspaceId: data.workspaceId,
      groupId: data.groupId,
      comments: "TCPC booth pooled link — IRS Forum Orlando",
    });
    return { created, shortLink: link.shortLink, key: link.key, id: link.id };
  });

/** Creates a personal link for one commission-eligible seller. */
export const ensureSellerLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { staffId: string; key: string; url: string; workspaceId?: string | undefined; groupId?: string | undefined }) => {
    const key = input.key.trim().toLowerCase();
    if (!/^[a-z0-9-_/]{2,60}$/.test(key)) throw new Error("Use letters, numbers and dashes only.");
    if (!/^https?:\/\//.test(input.url.trim())) throw new Error("Destination must be a full URL.");
    return {
      staffId: input.staffId,
      key,
      url: input.url.trim(),
      workspaceId: input.workspaceId?.trim() || undefined,
      groupId: input.groupId?.trim() || undefined,
    };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { ensureLink } = await import("./dub.server");
    const { link, created } = await ensureLink({
      key: data.key,
      url: data.url,
      workspaceId: data.workspaceId,
      groupId: data.groupId,
      comments: "TCPC seller link",
    });


    const { error } = await (context as any).supabase
      .from("staff_profiles")
      .update({ dub_partner_key: link.key })
      .eq("id", data.staffId);
    if (error) throw new Error(error.message);

    return { created, shortLink: link.shortLink, key: link.key };
  });

/** Click / lead / sale counts for the keys Field Hub cares about. */
export const dubLinkStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { keys: string[]; workspaceId?: string | undefined; groupId?: string | undefined }) => ({
    keys: input.keys.filter(Boolean).slice(0, 30),
    workspaceId: input.workspaceId?.trim() || undefined,
    groupId: input.groupId?.trim() || undefined,
  }))
  .handler(async ({ data }) => {
    if (!process.env["DUB_API_KEY"] || data.keys.length === 0) return { links: [] };
    const { listLinks } = await import("./dub.server");
    try {
      const all = await listLinks(data.workspaceId, undefined, data.groupId);
      const wanted = new Set(data.keys.map((k) => k.toLowerCase()));
      return {
        links: all
          .filter((l) => wanted.has(l.key.toLowerCase()))
          .map((l) => ({
            key: l.key,
            shortLink: l.shortLink,
            clicks: l.clicks ?? 0,
            leads: l.leads ?? 0,
            sales: l.sales ?? 0,
            saleAmount: l.saleAmount ?? 0,
          })),
      };
    } catch {
      return { links: [] };
    }
  });

