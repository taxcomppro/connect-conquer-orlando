const DUB_BASE = "https://api.dub.co";

function apiKey() {
  const key = process.env["DUB_API_KEY"];
  if (!key) throw new Error("Dub is not connected yet.");
  return key;
}

async function dubFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${DUB_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!res.ok) {
    const message =
      (body as { error?: { message?: string } })?.error?.message ??
      (typeof body === "string" ? body : `Dub request failed (${res.status})`);
    throw new Error(message);
  }

  return body;
}

export type DubLink = {
  id: string;
  domain: string;
  key: string;
  url: string;
  shortLink: string;
  clicks?: number;
  leads?: number;
  sales?: number;
  saleAmount?: number;
};

function qs(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) search.set(k, v);
  const s = search.toString();
  return s ? `?${s}` : "";
}

export async function listLinks(workspaceId?: string, search?: string) {
  const body = (await dubFetch(
    `/links${qs({ workspaceId, search, pageSize: "100" })}`,
  )) as DubLink[];
  return Array.isArray(body) ? body : [];
}

export async function findLinkByKey(key: string, workspaceId?: string) {
  const links = await listLinks(workspaceId, key);
  return links.find((l) => l.key.toLowerCase() === key.toLowerCase()) ?? null;
}

export async function createLink(input: {
  key: string;
  url: string;
  workspaceId?: string;
  comments?: string;
  tenantId?: string;
}) {
  return (await dubFetch(`/links${qs({ workspaceId: input.workspaceId })}`, {
    method: "POST",
    body: JSON.stringify({
      key: input.key,
      url: input.url,
      comments: input.comments,
      tenantId: input.tenantId,
    }),
  })) as DubLink;
}

export async function ensureLink(input: {
  key: string;
  url: string;
  workspaceId?: string;
  comments?: string;
}) {
  const existing = await findLinkByKey(input.key, input.workspaceId);
  if (existing) return { link: existing, created: false };
  const link = await createLink(input);
  return { link, created: true };
}
