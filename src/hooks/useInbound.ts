import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { listInbound, type InboundItem } from "@/lib/inbox.functions";

const SEEN_KEY = "fieldhub:inbox-seen-at";

function readSeenAt(): number {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(SEEN_KEY);
  const value = raw ? Number(raw) : 0;
  return Number.isFinite(value) ? value : 0;
}

/**
 * Polls for inbound texts and email replies every 30s. Anything newer than the
 * last time this device opened the Inbox counts as unread, and a toast pops the
 * moment a new reply lands while someone is working in the CRM.
 */
export function useInbound(options: { notify?: boolean } = {}) {
  const fetchInbound = useServerFn(listInbound);
  const [items, setItems] = useState<InboundItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [seenAt, setSeenAt] = useState(() => readSeenAt());
  const knownIds = useRef<Set<string> | null>(null);

  const refresh = useCallback(async () => {
    try {
      // Don't poll while signed out (e.g. on /auth) — the call would 401.
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setItems([]);
        return;
      }
      const result = await fetchInbound();
      setItems(result.items);

      if (options.notify) {
        const previous = knownIds.current;
        const ids = new Set(result.items.map((item) => item.id));
        if (previous) {
          const fresh = result.items.filter((item) => !previous.has(item.id));
          for (const item of fresh.slice(0, 3)) {
            toast.message(
              item.channel === "sms" ? "New text received" : "New email reply",
              { description: `${item.name || item.contact}: ${item.body.slice(0, 90)}` },
            );
          }
        }
        knownIds.current = ids;
      }
    } catch {
      // Silent — a failed poll shouldn't interrupt the page.
    } finally {
      setLoading(false);
    }
  }, [fetchInbound, options.notify]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const unread = items.filter((item) => new Date(item.sentAt).getTime() > seenAt).length;

  const markAllRead = useCallback(() => {
    const now = Date.now();
    window.localStorage.setItem(SEEN_KEY, String(now));
    setSeenAt(now);
  }, []);

  return { items, loading, unread, refresh, markAllRead };
}
