const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";
const DEFAULT_FROM = "+18555285275";

function lovableKey() {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("LOVABLE_API_KEY is not configured.");
  return key;
}

function twilioKey() {
  const key = process.env["TWILIO_API_KEY"];
  if (!key) throw new Error("Twilio is not connected yet.");
  return key;
}

function fromNumber() {
  return process.env["TWILIO_FROM_NUMBER"]?.trim() || DEFAULT_FROM;
}

export type TwilioSendResult = {
  sid: string;
  status: string;
  to: string;
  from: string;
  body: string;
  error?: string;
};

export async function sendSms(input: { to: string; body: string }): Promise<TwilioSendResult> {
  const to = input.to.trim();
  const body = input.body.trim();

  if (!to) throw new Error("A phone number is required to send an SMS.");
  if (!body) throw new Error("A message body is required.");

  const params = new URLSearchParams({
    To: to,
    From: fromNumber(),
    Body: body,
  });

  const response = await fetch(`${GATEWAY_URL}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey()}`,
      "X-Connection-Api-Key": twilioKey(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });

  const responseText = await response.text();
  let data: Record<string, unknown> = {};
  try {
    data = responseText ? JSON.parse(responseText) : {};
  } catch {
    data = { error: responseText };
  }

  if (!response.ok) {
    const message =
      typeof data["message"] === "string"
        ? data["message"]
        : typeof data["error"] === "string"
          ? data["error"]
          : `Twilio request failed (${response.status})`;
    throw new Error(message);
  }

  return {
    sid: String(data["sid"] ?? ""),
    status: String(data["status"] ?? "queued"),
    to: String(data["to"] ?? to),
    from: String(data["from"] ?? fromNumber()),
    body: String(data["body"] ?? body),
  };
}
