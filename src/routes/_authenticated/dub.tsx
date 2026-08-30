import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { FieldShell, PageTitle, SectionLabel, Panel } from "@/components/FieldShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { dubStatus, ensureBoothLink, ensureSellerLink, dubLinkStats } from "@/lib/dub.functions";

export const Route = createFileRoute("/_authenticated/dub")({
  head: () => ({
    meta: [
      { title: "Dub attribution — TCPC Field Hub" },
      {
        name: "description",
        content:
          "Configure the pooled Orlando booth link, per-seller Dub links, and which booth accounts earn commission.",
      },
      { property: "og:title", content: "Dub attribution — TCPC Field Hub" },
      {
        property: "og:description",
        content: "Pooled booth link, seller links, and owner exclusions for TCPC commissions.",
      },
    ],
  }),
  component: DubPage,
});

type Staff = {
  id: string;
  display_name: string;
  commission_eligible: boolean;
  dub_partner_key: string | null;
};

type Stat = { key: string; shortLink: string; clicks: number; leads: number; sales: number };

function DubPage() {
  const { user } = useAuth();
  const status = useServerFn(dubStatus);
  const saveBoothLink = useServerFn(ensureBoothLink);
  const saveSellerLink = useServerFn(ensureSellerLink);
  const loadStats = useServerFn(dubLinkStats);

  const [connected, setConnected] = useState<boolean | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [pooledKey, setPooledKey] = useState("");
  const [pooledUrl, setPooledUrl] = useState("https://www.taxcomppro.com/connect");
  const [workspaceId, setWorkspaceId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState<Stat[]>([]);

  useEffect(() => {
    let active = true;
    async function load() {
      const [{ data: settings }, { data: people }, conn] = await Promise.all([
        supabase.from("booth_settings").select("*").maybeSingle(),
        supabase
          .from("staff_profiles")
          .select("id, display_name, commission_eligible, dub_partner_key")
          .order("display_name"),
        status().catch(() => ({ connected: false })),
      ]);
      if (!active) return;
      setConnected(conn.connected);
      setStaff((people ?? []) as Staff[]);
      if (settings) {
        setPooledKey(settings.pooled_dub_key ?? "");
        setPooledUrl(settings.pooled_dub_url ?? "https://www.taxcomppro.com/connect");
        setWorkspaceId(settings.dub_workspace_id ?? "");
        setGroupId(settings.dub_group_id ?? "");
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [status]);


  async function savePooled() {
    setBusy(true);
    try {
      const result = await saveBoothLink({
        data: {
          key: pooledKey,
          url: pooledUrl,
          workspaceId: workspaceId || undefined,
          groupId: groupId || undefined,
        },
      });
      await supabase.from("booth_settings").update({
        pooled_dub_key: result.key,
        pooled_dub_url: pooledUrl,
        dub_workspace_id: workspaceId || null,
      }).eq("id", true);
      setPooledKey(result.key);
      toast.success(
        result.created ? `Created ${result.shortLink} in Dub` : `Verified ${result.shortLink}`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't reach Dub.");
    }
    setBusy(false);
  }


  async function createSeller(person: Staff) {
    const suggested =
      person.dub_partner_key ??
      person.display_name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    setBusy(true);
    try {
      const result = await saveSellerLink({
        data: {
          staffId: person.id,
          key: suggested,
          url: pooledUrl,
          workspaceId: workspaceId || undefined,
          groupId: groupId || undefined,
        },
      });
      setStaff((prev) =>
        prev.map((p) => (p.id === person.id ? { ...p, dub_partner_key: result.key } : p)),
      );
      toast.success(
        result.created ? `Created ${result.shortLink}` : `Linked existing ${result.shortLink}`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't reach Dub.");
    }
    setBusy(false);
  }


  async function refreshStats() {
    const keys = [pooledKey, ...staff.map((s) => s.dub_partner_key ?? "")].filter(Boolean);
    const result = await loadStats({
      data: { keys, workspaceId: workspaceId || undefined, groupId: groupId || undefined },
    });
    setStats(result.links);
    if (result.links.length === 0) toast.message("No matching links returned by Dub yet.");
  }


  const owners = staff.filter((s) => !s.commission_eligible);
  const sellers = staff.filter((s) => s.commission_eligible);

  return (
    <FieldShell back={{ to: "/", label: "Back to hub" }} eyebrowRight={user?.email ?? undefined}>
      <PageTitle
        title="Dub"
        accent="attribution"
        lede="Attribution is decided by who is signed in. Owners tag nothing; sellers tag the pooled Orlando link now and switch to their own link after the show."
      />

      <Panel className="mt-6">
        <div className="eyebrow">Connection</div>
        <p className="mt-2 text-sm">
          {connected === null
            ? "Checking…"
            : connected
              ? "Dub API key is connected."
              : "Dub API key is missing — add it in backend secrets."}
        </p>
      </Panel>

      <SectionLabel>Pooled booth link</SectionLabel>
      <Panel className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="pooledKey">Link key</Label>
          <Input
            id="pooledKey"
            value={pooledKey}
            onChange={(e) => setPooledKey(e.target.value)}
            placeholder="tcpc-orlando"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pooledUrl">Destination URL</Label>
          <Input
            id="pooledUrl"
            value={pooledUrl}
            onChange={(e) => setPooledUrl(e.target.value)}
            placeholder="https://www.taxcomppro.com/connect"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="workspace">Dub workspace ID (optional)</Label>
          <Input
            id="workspace"
            value={workspaceId}
            onChange={(e) => setWorkspaceId(e.target.value)}
            placeholder="ws_..."
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="group">Dub group ID</Label>
          <Input
            id="group"
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            placeholder="grp_..."
          />
          <p className="text-xs text-muted-foreground">
            New links are tagged with this group so they show up in your Dub group reporting.
          </p>
        </div>

        <Button onClick={savePooled} disabled={busy || !pooledKey} className="h-12 w-full">
          {busy ? "Working…" : "Create / verify in Dub and save"}
        </Button>
      </Panel>

      <SectionLabel>Sellers — pooled commission ({sellers.length})</SectionLabel>
      <div className="space-y-2">
        {sellers.map((person) => (
          <Panel key={person.id} className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-medium">{person.display_name}</div>
              <div className="text-sm text-muted-foreground">
                {person.dub_partner_key
                  ? `Personal link: ${person.dub_partner_key} (used after the show)`
                  : "Pooled booth link only"}
              </div>
            </div>
            <Button variant="outline" disabled={busy} onClick={() => createSeller(person)}>
              {person.dub_partner_key ? "Re-verify link" : "Create personal link"}
            </Button>
          </Panel>
        ))}
      </div>

      <SectionLabel>Owners — no affiliate link ({owners.length})</SectionLabel>
      <div className="space-y-2">
        {owners.map((person) => (
          <Panel key={person.id}>
            <div className="font-medium">{person.display_name}</div>
            <div className="text-sm text-muted-foreground">
              Signups carry no Dub code — nothing to unscramble later.
            </div>
          </Panel>
        ))}
      </div>

      <SectionLabel>Live Dub counts</SectionLabel>
      <Panel className="space-y-3">
        <Button variant="outline" onClick={refreshStats} disabled={!connected}>
          Refresh from Dub
        </Button>
        {stats.map((s) => (
          <div key={s.key} className="flex items-center justify-between text-sm">
            <span className="font-mono">{s.key}</span>
            <span className="text-muted-foreground">
              {s.clicks} clicks · {s.leads} leads · {s.sales} sales
            </span>
          </div>
        ))}
      </Panel>
    </FieldShell>
  );
}
