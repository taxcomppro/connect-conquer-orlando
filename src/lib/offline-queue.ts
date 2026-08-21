import { get, set } from "idb-keyval";
import { supabase } from "@/integrations/supabase/client";
import type { LeadDraft } from "./leads";

const QUEUE_KEY = "tcpc-lead-queue-v1";

export type QueuedLead = LeadDraft & {
  rating: string;
  interests: string[];
  joined_tcpc: boolean;
  notes: string | null;
  queued_at: string;
};

async function readQueue(): Promise<QueuedLead[]> {
  try {
    return (await get<QueuedLead[]>(QUEUE_KEY)) ?? [];
  } catch {
    return [];
  }
}

async function writeQueue(items: QueuedLead[]): Promise<void> {
  try {
    await set(QUEUE_KEY, items);
  } catch {
    /* storage unavailable — nothing else we can do */
  }
}

export async function enqueueLead(lead: QueuedLead): Promise<void> {
  const queue = await readQueue();
  const next = queue.filter((item) => item.attendee_id !== lead.attendee_id);
  next.push(lead);
  await writeQueue(next);
}

export async function queueSize(): Promise<number> {
  return (await readQueue()).length;
}

/** Flush queued scans to the backend. Returns how many synced. */
export async function flushQueue(userId: string): Promise<number> {
  const queue = await readQueue();
  if (queue.length === 0) return 0;

  const remaining: QueuedLead[] = [];
  let synced = 0;

  for (const item of queue) {
    const { queued_at: _queuedAt, ...row } = item;
    const { error } = await supabase
      .from("leads")
      .upsert({ ...row, scanned_by: userId }, { onConflict: "attendee_id,scanned_by" });

    if (error) {
      remaining.push(item);
    } else {
      synced += 1;
    }
  }

  await writeQueue(remaining);
  return synced;
}
