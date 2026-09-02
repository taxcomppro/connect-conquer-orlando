const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";
const DEFAULT_FROM = "+18555285275";

export type TwilioSendResult = {
  sid: string;
  status: string;
  to: string;
  from: string;
  body: string;
  error?: string;
};

export async function sendSms(input: {
  to: string;
  body: string;
  lovableApiKey?: string | undefined;
  twilioApiKey?: string | undefined;
  from?: string | undefined;
}): Promise<TwilioSendResult> {
  const to = input.to.trim();
  const body = input.body.trim();

  const { readEnv } = await import("./env.server");
  const lovableApiKey = input.lovableApiKey || (await readEnv("LOVABLE_API_KEY"));
  const twilioApiKey = input.twilioApiKey || (await readEnv("TWILIO_API_KEY"));
  const from = input.from?.trim() || (await readEnv("TWILIO_FROM_NUMBER")) || DEFAULT_FROM;

  if (!to) throw new Error("A phone number is required to send an SMS.");
  if (!body) throw new Error("A message body is required.");
  if (!lovableApiKey) throw new Error("Text messaging is temporarily unavailable.");
  if (!twilioApiKey) throw new Error("Twilio is not connected yet.");

  const params = new URLSearchParams({
    To: to,
    From: from,
    Body: body,
  });

  const response = await fetch(`${GATEWAY_URL}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.lovableApiKey}`,
      "X-Connection-Api-Key": input.twilioApiKey,
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
    from: String(data["from"] ?? from),
    body: String(data["body"] ?? body),
  };
}
