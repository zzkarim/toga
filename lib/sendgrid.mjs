import { authLog } from "./auth-log.mjs";
export function sendGridPayload(record, sender) {
  return {
    personalizations: [{ to: [{ email: record.to }] }],
    from: { email: sender, name: "Toga" },
    subject: record.subject,
    content: [{ type: "text/plain", value: record.text }],
    custom_args: { toga_email_id: record.id },
    tracking_settings: {
      click_tracking: { enable: false, enable_text: false },
      open_tracking: { enable: false },
    },
  };
}
export async function sendThroughSendGrid(
  record,
  { key, sender, fetcher = fetch },
) {
  const started = Date.now();
  authLog("provider_request_initiated", { messageId: record.id });
  try {
    const response = await fetcher("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      signal: AbortSignal.timeout(10000),
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(sendGridPayload(record, sender)),
    });
    authLog(
      response.status === 202 ? "provider_accepted" : "provider_rejected",
      {
        messageId: record.id,
        providerMessageId: response.headers.get("x-message-id"),
        status: response.status,
        durationMs: Date.now() - started,
      },
    );
    if (response.status === 202)
      return {
        deliveryStatus: "Accepted",
        sentAt: new Date(),
        providerMessageId: response.headers.get("x-message-id"),
        error: null,
      };
    if (response.status === 429)
      return {
        deliveryStatus: "Retry",
        error: "SendGrid rate limit. Queued for retry.",
      };
    if (response.status >= 500)
      return {
        deliveryStatus: "Unknown",
        error: `SendGrid returned ${response.status}. Check Email Activity before resending.`,
      };
    return {
      deliveryStatus: "Failed",
      error: `SendGrid rejected the email (${response.status}). Check the API key and verified sender.`,
    };
  } catch {
    authLog("provider_outcome_unknown", {
      messageId: record.id,
      reason: "connection_or_timeout",
      durationMs: Date.now() - started,
    });
    return {
      deliveryStatus: "Unknown",
      error:
        "Delivery outcome unknown after a connection error. Check SendGrid Email Activity before resending.",
    };
  }
}
