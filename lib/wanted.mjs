import { campusToday, dateRange } from "./rules.mjs";
import { ADMIN_EXCEPTION_EMAIL, DOMAIN } from "./campus.mjs";

// Wanted = "I want someone on Toga to list this." It never reserves dates or creates rentals.
export const WANTED_FEED_LIMIT = 50;
const CONTROL = /[\u0000-\u0008\u000b-\u001f\u007f]/;
const URL_PATTERN =
  /https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|ly|co|me|xyz)\b/i;

function text(value, { label, min = 0, max, single = true }) {
  if (value == null) value = "";
  if (typeof value !== "string" || CONTROL.test(value))
    throw new Error(`Enter a valid ${label}.`);
  const clean = (single ? value.replace(/\s+/g, " ") : value).trim();
  if (clean.length < min || clean.length > max)
    throw new Error(
      min
        ? `${label[0].toUpperCase() + label.slice(1)} must be ${min}–${max} characters.`
        : `${label[0].toUpperCase() + label.slice(1)} must be ${max} characters or fewer.`,
    );
  // Wanted text is emailed to other students; links invite phishing and spam.
  if (URL_PATTERN.test(clean))
    throw new Error("Links aren't allowed in Wanted posts.");
  return clean;
}

export function wantedData(body, now = new Date()) {
  const title = text(body.title, { label: "item name", min: 3, max: 80 });
  const details = text(body.details, {
    label: "details",
    max: 300,
    single: false,
  });
  const size = text(body.size, { label: "size", max: 30 }) || null;
  const { startDate, endDate } = dateRange(
    body.startDate,
    body.endDate || body.startDate,
    now,
  );
  return { title, details, size, startDate, endDate };
}

// Open, visible, not yet past its final needed day, from an active account.
export function activeWantedWhere(now = new Date()) {
  return {
    status: "Open",
    moderationStatus: "Visible",
    endDate: { gte: new Date(campusToday(now) + "T00:00:00.000Z") },
    user: { accountStatus: "Active" },
  };
}

// Only marketplace fields; requester identity, contact and payment data never leave the server.
export function publicWanted(post, viewerId) {
  return {
    id: post.id,
    title: post.title,
    details: post.details,
    size: post.size,
    startDate: post.startDate,
    endDate: post.endDate,
    createdAt: post.createdAt,
    responseCount: post._count?.listings ?? 0,
    isMine: post.userId === viewerId,
  };
}

// Recipients of the "someone is looking for…" email. Testers only reach other testers,
// so live verification never emails real students. Swap this for opt-in/matching later.
export function wantedAudienceWhere(requester) {
  return {
    id: { not: requester.id },
    accountStatus: "Active",
    role: requester.role === "tester" ? "tester" : "user",
    emailVerifiedAt: { not: null },
    email: { endsWith: `@${DOMAIN}`, not: ADMIN_EXCEPTION_EMAIL },
  };
}

const mailText = (value, max = 80) =>
  String(value || "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
const day = (value) =>
  new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
export function wantedDates(post) {
  const start = day(post.startDate),
    end = day(post.endDate);
  return start === end ? start : `${start} – ${end}`;
}
const appUrl = () => process.env.APP_URL || "https://jointoga.com";

export function wantedBroadcastMail(post) {
  const item = mailText(post.title);
  return {
    subject: `Someone on Toga is looking for ${item} 👀`,
    text: `Toga\n\nSomeone at Georgia Tech is looking to rent ${item} (needed ${wantedDates(post)}).\n\nHave something like this? Put it on Toga and make some extra cash if they rent it.\n\nList something: ${appUrl()}/?view=wanted&have=${post.id}`,
  };
}

export function wantedResponseMail(post, listing) {
  const item = mailText(listing.title);
  return {
    subject: `Someone listed ${item} on Toga`,
    text: `Toga\n\nA Toga user just listed ${item} after seeing your Wanted post for ${mailText(post.title)}. Open it to check availability and request a rental.\n\nView listing: ${appUrl()}/?view=browse&listing=${listing.id}`,
  };
}

// Outbox rows with deterministic ids: re-running never creates a second logical email.
export async function queueWantedEmails(store, post, requester, provider) {
  const recipients = await store.user.findMany({
    where: wantedAudienceWhere(requester),
    select: { id: true, email: true },
    orderBy: { createdAt: "asc" },
  });
  const broadcast = wantedBroadcastMail(post);
  const rows = recipients.map((r) => ({
    id: `wanted-${post.id}-${r.id}`,
    to: r.email,
    provider,
    ...broadcast,
  }));
  if (rows.length)
    await store.email.createMany({ data: rows, skipDuplicates: true });
  return rows.map((r) => r.id);
}
