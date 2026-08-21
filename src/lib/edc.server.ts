/**
 * EDC RetrieveMyLeads Metadata API v1.1 — server-only HTTP client.
 * Docs: POST https://retrievemyleads.com/api/meta/1.1/read/ with sid, key, aid.
 */

const DEFAULT_READ_ENDPOINT = "https://retrievemyleads.com/api/meta/1.1/read/";

export type BadgeRecord = {
  attendeeId: string;
  prefix: string;
  firstName: string;
  middleName: string;
  lastName: string;
  suffix: string;
  nickname: string;
  title: string;
  company: string;
  department: string;
  address1: string;
  address2: string;
  address3: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  countryCode: string;
  phone: string;
  fax: string;
  email: string;
  website: string;
  eventName: string;
  demographics: string;
  qualifiers: string;
  association: string;
  credential: string;
};

export type BadgeLookupResult =
  | { status: "found"; record: BadgeRecord }
  | { status: "pending"; attendeeId: string; message: string }
  | { status: "not_configured"; message: string }
  | { status: "bad_request"; message: string }
  | { status: "unauthorized"; message: string }
  | { status: "error"; message: string };

/** Preserve the exact badge identifier EDC encoded, e.g. `A1234567`. */
export function normalizeAttendeeId(raw: string): string {
  return raw.trim();
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value);
}

function toRecord(payload: Record<string, unknown>, attendeeId: string): BadgeRecord {
  return {
    attendeeId: str(payload["aid"]) || attendeeId,
    prefix: str(payload["pre"]),
    firstName: str(payload["first"]),
    middleName: str(payload["mid"]),
    lastName: str(payload["last"]),
    suffix: str(payload["suf"]),
    nickname: str(payload["nick"]),
    title: str(payload["titl"]),
    company: str(payload["com"]),
    department: str(payload["dept"]),
    address1: str(payload["add1"]),
    address2: str(payload["add2"]),
    address3: str(payload["add3"]),
    city: str(payload["city"]),
    state: str(payload["st"]),
    postalCode: str(payload["zip"]),
    country: str(payload["coun"]),
    countryCode: str(payload["cc"]),
    phone: str(payload["pho"]),
    fax: str(payload["fax"]),
    email: str(payload["email"]),
    website: str(payload["url"]),
    eventName: str(payload["evnt"]),
    demographics: str(payload["demo"]),
    qualifiers: str(payload["qual"]),
    association: str(payload["asso"]),
    credential: str(payload["cred"]),
  };
}

export async function readBadge(
  showId: string | undefined,
  apiKey: string | undefined,
  rawAttendeeId: string,
  apiUrl: string | undefined = DEFAULT_READ_ENDPOINT,
): Promise<BadgeLookupResult> {
  const attendeeId = normalizeAttendeeId(rawAttendeeId);

  if (!attendeeId) {
    return { status: "bad_request", message: "No badge ID was provided." };
  }
  if (!showId || !apiKey) {
    return {
      status: "not_configured",
      message: "Show ID and application key are not configured yet.",
    };
  }

  let response: Response;
  try {
    response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ sid: showId, key: apiKey, aid: attendeeId }).toString(),
    });
  } catch {
    return {
      status: "error",
      message: "Could not reach the badge service. Saved locally — retry when back online.",
    };
  }

  if (response.status === 410) {
    return {
      status: "unauthorized",
      message: "The show credentials were rejected. Check the show ID and application key.",
    };
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await response.json()) as Record<string, unknown>;
  } catch {
    return { status: "error", message: "The badge service returned an unreadable response." };
  }

  const good = payload["good"];
  const isGood = good === 1 || good === "1" || good === true;

  if (isGood) {
    return { status: "found", record: toRecord(payload, attendeeId) };
  }

  const message = str(payload["message"]) || "No data available for this badge.";

  if (response.status === 400) {
    return { status: "bad_request", message };
  }
  if (response.status === 200) {
    return { status: "pending", attendeeId, message };
  }
  return { status: "error", message };
}
