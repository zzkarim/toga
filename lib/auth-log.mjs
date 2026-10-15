// Allowlisted metadata only: never pass addresses, codes, tokens, or message bodies.
export function authLog(
  event,
  { messageId, providerMessageId, status, reason, durationMs } = {},
) {
  console.info(
    JSON.stringify({
      service: "toga-auth",
      event,
      messageId,
      providerMessageId,
      status,
      reason,
      durationMs,
    }),
  );
}
