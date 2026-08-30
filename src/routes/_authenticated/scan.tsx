import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Html5Qrcode } from "html5-qrcode";

import { lookupBadge } from "@/lib/edc.functions";
import { runSmsTriggers } from "@/lib/sms-triggers.functions";
import { badgeToDraft, pendingDraft } from "@/lib/leads";
import { enqueueLead, flushQueue, queueSize } from "@/lib/offline-queue";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { FieldShell, PageTitle, SectionLabel } from "@/components/FieldShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/scan")({
  head: () => ({
    meta: [
      { title: "Scan a Badge — TCPC Lead Scanner" },
      {
        name: "description",
        content:
          "Scan attendee badge QR codes at Booth 540 to capture full contact records and qualify TCPC leads on the spot.",
      },
      { property: "og:title", content: "Scan a Badge — TCPC Lead Scanner" },
      {
        property: "og:description",
        content: "Capture and qualify booth leads in seconds at the IRS Nationwide Tax Forum.",
      },
    ],
  }),
  component: ScanPage,
});

const READER_ID = "tcpc-badge-reader";

function ScanPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const lookup = useServerFn(lookupBadge);

  const [cameraOn, setCameraOn] = useState(false);
  const [manualId, setManualId] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(0);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const handlingRef = useRef(false);

  useEffect(() => {
    void queueSize().then(setPending);
  }, []);

  useEffect(() => {
    if (!user) return;
    const sync = async () => {
      if (!navigator.onLine) return;
      const synced = await flushQueue(user.id);
      if (synced > 0) toast.success(`Synced ${synced} offline scan${synced === 1 ? "" : "s"}.`);
      setPending(await queueSize());
    };
    void sync();
    window.addEventListener("online", sync);
    return () => window.removeEventListener("online", sync);
  }, [user]);

  useEffect(() => {
    return () => {
      const scanner = scannerRef.current;
      if (scanner) {
        scanner.stop().catch(() => undefined);
        scannerRef.current = null;
      }
    };
  }, []);

  async function stopCamera() {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    setCameraOn(false);
    if (scanner) {
      try {
        await scanner.stop();
        scanner.clear();
      } catch {
        /* already stopped */
      }
    }
  }

  async function startCamera() {
    if (scannerRef.current) return;
    try {
      const scanner = new Html5Qrcode(READER_ID, { verbose: false });
      scannerRef.current = scanner;
      setCameraOn(true);
      await scanner.start(
        { facingMode: "environment" },
        { fps: 12, qrbox: { width: 250, height: 250 } },
        (decoded) => {
          void handleBadge(decoded);
        },
        () => undefined,
      );
    } catch {
      scannerRef.current = null;
      setCameraOn(false);
      toast.error("Camera unavailable. Allow camera access or type the badge ID instead.");
    }
  }

  async function handleBadge(rawId: string) {
    if (handlingRef.current || !user) return;
    handlingRef.current = true;
    setBusy(true);

    try {
      if (navigator.vibrate) navigator.vibrate(40);

      const result = await lookup({ data: { attendeeId: rawId } });

      if (result.status === "unauthorized" || result.status === "not_configured") {
        toast.error(result.message);
        return;
      }
      if (result.status === "bad_request") {
        toast.error(result.message);
        return;
      }

      const draft =
        result.status === "found" ? badgeToDraft(result.record) : pendingDraft(rawId.trim());

      if (result.status === "pending" || result.status === "error") {
        toast.warning(result.message);
      }

      const { data: savedLead, error } = await supabase
        .from("leads")
        .upsert({ ...draft, scanned_by: user.id }, { onConflict: "attendee_id,scanned_by" })
        .select("id")
        .maybeSingle();

      if (!error && savedLead) {
        void fireTriggers({ data: { leadId: savedLead.id, event: "lead_captured" } }).catch(
          () => undefined,
        );
      }

      if (error) {
        await enqueueLead({
          ...draft,
          rating: "warm",
          interests: [],
          joined_tcpc: false,
          notes: null,
          queued_at: new Date().toISOString(),
        });
        setPending(await queueSize());
        toast.warning("Saved offline. It will sync when the Wi-Fi comes back.");
      }

      await stopCamera();
      navigate({ to: "/lead/$attendeeId", params: { attendeeId: draft.attendee_id } });
    } finally {
      setBusy(false);
      setTimeout(() => {
        handlingRef.current = false;
      }, 1200);
    }
  }

  return (
    <FieldShell
      eyebrowRight={
        <Link to="/leads" className="transition-colors hover:text-foreground">
          My leads →
        </Link>
      }
      back={{ to: "/", label: "Field Hub" }}
    >
      <PageTitle
        title="Scan a"
        accent="badge"
        lede="Point the camera at the attendee's badge QR code. The full contact record comes back in about a second — no typing, no business cards."
      />

      {pending > 0 ? (
        <div className="mt-5 rounded-lg border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-gold">
          {pending} scan{pending === 1 ? "" : "s"} waiting to sync.
        </div>
      ) : null}

      <div className="mt-6 overflow-hidden rounded-2xl border border-signal-line bg-panel">
        <div
          id={READER_ID}
          className={`aspect-square w-full ${cameraOn ? "" : "hidden"} [&_video]:h-full [&_video]:w-full [&_video]:object-cover`}
        />
        {!cameraOn ? (
          <div className="flex aspect-square w-full flex-col items-center justify-center gap-4 px-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-signal-line bg-signal-soft text-2xl">
              ▣
            </div>
            <p className="text-sm text-muted-foreground">
              Camera is off. Start it when an attendee steps up to the booth.
            </p>
            <Button onClick={startCamera} className="h-12 px-8 text-base">
              Start camera
            </Button>
          </div>
        ) : null}
      </div>

      {cameraOn ? (
        <Button variant="outline" onClick={stopCamera} className="mt-3 h-11 w-full">
          Stop camera
        </Button>
      ) : null}

      <SectionLabel>Badge won't scan?</SectionLabel>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (manualId.trim()) void handleBadge(manualId);
        }}
        className="flex gap-2"
      >
        <Input
          value={manualId}
          onChange={(e) => setManualId(e.target.value)}
          placeholder="Badge ID, e.g. A1234567"
          inputMode="text"
          autoCapitalize="characters"
          className="h-12"
        />
        <Button type="submit" variant="secondary" disabled={busy} className="h-12 px-6">
          Look up
        </Button>
      </form>
      <p className="mt-2 text-xs text-muted-foreground">
        Type the ID printed under the QR code. Everything else works the same.
      </p>
    </FieldShell>
  );
}
