import { simpleParser } from "mailparser";
const googleDomain = "(?:googlemail|gmail)\\.com";
// Parse only authenticated Google DSNs. Never return or persist the original message body.
export async function parseGmailDsn(source) {
  if (!source || source.length > 262144) return [];
  const message = await simpleParser(source, {
    keepDeliveryStatus: true,
    skipHtmlToText: true,
    skipTextToHtml: true,
    skipTextLinks: true,
  });
  const auth =
    message.headerLines
      .find((h) => h.key === "authentication-results")
      ?.line.replace(/\r?\n[ \t]+/g, " ") || "";
  const from = message.from?.value?.[0]?.address;
  if (
    !["mailer-daemon@googlemail.com", "mailer-daemon@gmail.com"].includes(
      from,
    ) ||
    !/^Return-Path:\s*<>\s*$/i.test(
      message.headerLines.find((h) => h.key === "return-path")?.line || "",
    ) ||
    !/^Authentication-Results:\s*mx\.google\.com;/i.test(auth) ||
    !new RegExp(
      `\\bdkim=pass\\s+header\\.i=@${googleDomain}(?:\\s|;)`,
      "i",
    ).test(auth) ||
    !new RegExp(
      `\\bdmarc=pass[^;]*header\\.from=${googleDomain}(?:\\s|;|$)`,
      "i",
    ).test(auth)
  )
    return [];
  const contentType = message.headers.get("content-type");
  if (
    contentType?.value !== "multipart/report" ||
    contentType?.params?.["report-type"] !== "delivery-status"
  )
    return [];
  const originals = message.attachments.filter((p) =>
    ["message/rfc822", "text/rfc822-headers"].includes(p.contentType),
  );
  const messageIds = new Set();
  for (const original of originals) {
    const headers = original.content.toString("utf8").split(/\r?\n\r?\n/)[0];
    for (const match of headers.matchAll(
      /^Message-ID:\s*(<toga\.[a-f0-9]{64}@gmail\.com>)\s*$/gim,
    ))
      messageIds.add(match[1]);
  }
  if (messageIds.size !== 1) return [];
  const results = [];
  for (const part of message.attachments.filter(
    (p) => p.contentType === "message/delivery-status",
  )) {
    const blocks = part.content
      .toString("utf8")
      .replace(/\r?\n[ \t]+/g, " ")
      .split(/\r?\n\r?\n/);
    for (const block of blocks) {
      const fields = Object.fromEntries(
        block
          .split(/\r?\n/)
          .map((line) => {
            const i = line.indexOf(":");
            return i < 0
              ? []
              : [line.slice(0, i).toLowerCase(), line.slice(i + 1).trim()];
          })
          .filter((x) => x.length === 2),
      );
      const recipient = fields["final-recipient"]
        ?.match(/^rfc822;\s*([^\s<>]+@[^\s<>]+)$/i)?.[1]
        ?.toLowerCase();
      const status = fields.status;
      if (
        fields.action?.toLowerCase() !== "failed" ||
        !/^5\.\d{1,3}\.\d{1,3}$/.test(status || "") ||
        !recipient
      )
        continue;
      const rejected = /message rejected|message blocked/i.test(
        fields["diagnostic-code"] || "",
      );
      results.push({
        providerMessageId: [...messageIds][0],
        recipient,
        status,
        error: `Gmail delivery failure (${status}). ${rejected ? "Message rejected by mail policy." : "Permanent delivery failure reported."}`,
      });
    }
  }
  return results;
}
