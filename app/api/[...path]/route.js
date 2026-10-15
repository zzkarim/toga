import { paymentInformation } from "../../../lib/payment.mjs";
import { authLog } from "../../../lib/auth-log.mjs";
import {
  generateCode,
  codeDigest,
  codeMatches,
  codeEmail,
  OTP_SUBJECT,
  OTP_TTL,
  OTP_COOLDOWN,
  OTP_ATTEMPTS,
} from "../../../lib/otp.mjs";
import {
  hashPassword,
  verifyPassword,
  validPassword,
} from "../../../lib/passwords.mjs";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { db } from "../../../lib/db";
import { sendEmail, deliverEmail } from "../../../lib/email";
import { runJobs, expireRequests } from "../../../lib/jobs";
import {
  ADMIN_EXCEPTION_EMAIL,
  CAMPUS,
  DOMAIN,
  DOMAIN_ERROR,
  isAllowedEmail,
  normalizeEmail,
  safeDestination,
} from "../../../lib/campus.mjs";
import { sizes } from "../../../lib/browse.mjs";
import { hash, fail, limit } from "../../../lib/security";
import { ownPhotos, savePhoto, readPhoto } from "../../../lib/uploads";
import { categories, dateRange, transition } from "../../../lib/rules.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const publicUser = (u) =>
  u && {
    id: u.id,
    name: u.name,
    classYear: u.classYear,
    profilePhotoUrl: u.profilePhotoUrl,
  };
async function createSession(user, canSetPassword = false) {
  const session = randomBytes(32).toString("hex");
  await db.session.create({
    data: {
      id: hash(session),
      userId: user.id,
      canSetPassword,
      passwordSetupUntil: canSetPassword
        ? new Date(Date.now() + 15 * 60000)
        : null,
      expiresAt: new Date(Date.now() + 30 * 86400000),
    },
  });
  (await cookies()).set("toga_session", session, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 30 * 86400,
  });
}
async function currentUser() {
  const token = (await cookies()).get("toga_session")?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { id: hash(token) },
    include: { user: true },
  });
  if (
    !session ||
    session.expiresAt <= new Date() ||
    !isAllowedEmail(session.user.email)
  )
    return null;
  // Renew at most once a day; password-recovery privileges have a separate expiry.
  if (session.expiresAt.getTime() < Date.now() + 29 * 86400000) {
    const renewed = await db.session.updateMany({
      where: { id: session.id, expiresAt: { gt: new Date() } },
      data: { expiresAt: new Date(Date.now() + 30 * 86400000) },
    });
    if (!renewed.count) return null;
    (await cookies()).set("toga_session", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 30 * 86400,
    });
  }
  return session.user;
}
async function requireUser() {
  const u = await currentUser();
  if (!u) fail("Please sign in to continue.", 401);
  return u;
}
async function requireProfile() {
  const u = await requireUser();
  if (!u.name || !u.phone) fail("Complete your profile before continuing.");
  return u;
}
async function ownedRequest(id, u) {
  const r = await db.rentalRequest.findUnique({
    where: { id },
    include: { listing: true },
  });
  if (!r || ![r.renterId, r.lenderId].includes(u.id))
    fail("Rental not found.", 404);
  return r;
}
async function listingData(body, userId) {
  const { title, description, category, size, condition, photos } = body;
  if (
    typeof title !== "string" ||
    title.trim().length < 3 ||
    title.length > 100 ||
    typeof description !== "string" ||
    description.trim().length < 3 ||
    description.length > 3000
  )
    fail("Add a title and a short description.");
  if (
    !categories.includes(category) ||
    !["New", "Like New", "Good"].includes(condition) ||
    !sizes.includes(size)
  )
    fail("Choose a category, condition, and size.");
  const price = Number(body.price),
    retailValue = Number(body.retailValue || 0);
  if (
    !Number.isFinite(price) ||
    price <= 0 ||
    price > 1000 ||
    !Number.isFinite(retailValue) ||
    retailValue < 0 ||
    retailValue > 10000
  )
    fail("Enter valid rental and replacement values.");
  if (!Array.isArray(photos) || photos.length < 1 || photos.length > 4)
    fail("Add between one and four photos.");
  await ownPhotos(photos, userId);
  return {
    title: title.trim(),
    description,
    category,
    size,
    condition,
    price: Math.round(price * 100) / 100,
    retailValue,
    highValue: retailValue > 150,
    photos: JSON.stringify(photos),
    status: "Active",
  };
}
async function handle(req, ctx) {
  const segments = (await ctx.params).path,
    route = segments.join("/"),
    method = req.method;
  if (method !== "GET" && route !== "jobs") {
    const origin = req.headers.get("origin");
    const allowed = new URL(process.env.APP_URL || req.url).origin;
    if (
      !origin ||
      (origin !== allowed &&
        !(
          process.env.NODE_ENV !== "production" &&
          origin === new URL(req.url).origin
        ))
    )
      fail("Please reload Toga and try again.", 403);
  }
  const body =
    method !== "GET" && route !== "upload"
      ? await req.json().catch(() => ({}))
      : {};
  if (route === "config" && method === "GET")
    return { campus: CAMPUS, domain: DOMAIN };
  if (route === "health" && method === "GET") {
    await db.$queryRaw`SELECT 1`;
    return { ok: true };
  }
  if (route === "auth/otp/request" && method === "POST") {
    const email = normalizeEmail(body.email);
    if (!isAllowedEmail(email)) fail(DOMAIN_ERROR);
    authLog("verification_requested");
    const preview =
      process.env.NODE_ENV !== "production" &&
      process.env.DEV_EMAIL_PREVIEW === "true";
    if (!process.env.SENDGRID_API_KEY && !preview)
      fail(
        "Email verification is temporarily unavailable. Please try again shortly.",
        503,
      );
    await limit(`otp-request:${email}`, 5, 15 * 60000);
    await limit("otp-request:global", 100, 60000);
    const code = generateCode(),
      challenge = randomBytes(24).toString("hex"),
      now = new Date();
    const digest = codeDigest(email, challenge, code);
    const issued = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1::int AS locked FROM pg_advisory_xact_lock(hashtext(${email})::bigint)`;
      const existing = await tx.emailOtp.findUnique({ where: { email } });
      if (existing && existing.resendAt > now) return false;
      const data = {
        challenge,
        digest,
        expiresAt: new Date(+now + OTP_TTL),
        resendAt: new Date(+now + OTP_COOLDOWN),
        attempts: 0,
      };
      await tx.emailOtp.upsert({
        where: { email },
        create: { email, ...data },
        update: data,
      });
      return true;
    });
    if (!issued) {
      authLog("rate_limit_triggered", { reason: "resend_cooldown" });
      fail("Please wait 60 seconds before requesting another code.", 429);
    }
    const delivery = await sendEmail(email, OTP_SUBJECT, codeEmail(code));
    if (delivery.error)
      fail(
        "The email service could not confirm sending. Wait a minute, then request a new code.",
        503,
      );
    return {
      ok: true,
      challenge,
      expiresAt: new Date(+now + OTP_TTL).toISOString(),
      resendAt: new Date(+now + OTP_COOLDOWN).toISOString(),
      ...(preview ? { previewCode: code } : {}),
    };
  }
  if (route === "auth/otp/verify" && method === "POST") {
    const email = normalizeEmail(body.email),
      code = String(body.code || ""),
      challenge = String(body.challenge || "");
    if (!isAllowedEmail(email)) fail(DOMAIN_ERROR);
    await limit(`otp-verify:${email}`, 20, 15 * 60000);
    await limit("otp-verify:global", 300, 60000);
    if (!/^\d{6}$/.test(code) || !/^[a-f0-9]{48}$/.test(challenge)) {
      authLog("verification_failed", { reason: "format" });
      fail("Enter all six digits from your email.");
    }
    const result = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1::int AS locked FROM pg_advisory_xact_lock(hashtext(${email})::bigint)`;
      const record = await tx.emailOtp.findUnique({ where: { email } });
      if (!record || record.challenge !== challenge)
        return { reason: "invalid" };
      if (record.expiresAt <= new Date()) return { reason: "expired" };
      if (record.attempts >= OTP_ATTEMPTS) return { reason: "attempts" };
      if (!codeMatches(email, challenge, code, record.digest)) {
        await tx.emailOtp.update({
          where: { email },
          data: { attempts: { increment: 1 } },
        });
        return {
          reason:
            record.attempts + 1 >= OTP_ATTEMPTS ? "attempts" : "incorrect",
        };
      }
      await tx.emailOtp.delete({ where: { email } });
      const role =
        email === normalizeEmail(process.env.ADMIN_EMAIL) ? "admin" : "user";
      const user = await tx.user.upsert({
        where: { email },
        create: { email, role },
        update: { role },
      });
      return { user };
    });
    if (!result.user) {
      authLog(
        result.reason === "expired"
          ? "verification_expired"
          : "verification_failed",
        { reason: result.reason },
      );
      fail(
        result.reason === "expired"
          ? "This code expired. Request a new code."
          : result.reason === "attempts"
            ? "Too many incorrect attempts. Request a new code."
            : "Incorrect or already used code. Use the newest email or request a new code.",
      );
    }
    await createSession(result.user, true);
    authLog("verification_succeeded");
    return {
      ok: true,
      next:
        result.user.name && result.user.phone
          ? safeDestination(body.next)
          : "/?view=profile",
    };
  }
  if (route === "auth/password-login" && method === "POST") {
    const email = normalizeEmail(body.email);
    if (!isAllowedEmail(email)) fail(DOMAIN_ERROR);
    await limit(`password:${email}`, 10, 15 * 60000);
    await limit("password:global", 100, 60000);
    const user = await db.user.findUnique({ where: { email } });
    if (!(await verifyPassword(body.password, user?.passwordHash)))
      fail(
        "Email or password is incorrect. Use the email-code option if you haven’t set a password or forgot it.",
        401,
      );
    await createSession(user);
    return {
      ok: true,
      next:
        user.name && user.phone ? safeDestination(body.next) : "/?view=profile",
    };
  }
  if (route === "auth/password" && method === "POST") {
    const user = await requireUser();
    await limit(`set-password:${user.id}`, 10, 15 * 60000);
    if (!validPassword(body.password))
      fail("Use a password between 12 and 128 characters.");
    const sessionId = hash((await cookies()).get("toga_session").value);
    const session = await db.session.findUnique({ where: { id: sessionId } });
    if (
      !(session?.canSetPassword && session.passwordSetupUntil > new Date()) &&
      !(await verifyPassword(body.currentPassword, user.passwordHash))
    )
      fail(
        "Enter your current password, or sign in with a fresh email code to reset it.",
        401,
      );
    const passwordHash = await hashPassword(body.password);
    await db.$transaction(async (tx) => {
      const changed = await tx.user.updateMany({
        where: { id: user.id, passwordHash: user.passwordHash },
        data: { passwordHash },
      });
      if (!changed.count)
        fail("Your password changed in another session. Sign in again.", 409);
      await tx.session.deleteMany({ where: { userId: user.id } });
      await tx.loginToken.deleteMany({ where: { email: user.email } });
      await tx.emailOtp.deleteMany({ where: { email: user.email } });
    });
    await createSession(user);
    return { ok: true };
  }
  if (route === "auth/login" && method === "POST") {
    const email = normalizeEmail(body.email);
    if (!isAllowedEmail(email)) fail(DOMAIN_ERROR);
    if (
      !process.env.SENDGRID_API_KEY &&
      !(
        process.env.NODE_ENV !== "production" &&
        process.env.DEV_EMAIL_PREVIEW === "true"
      )
    )
      fail(
        "Sign-in email is temporarily unavailable. Please try again later.",
        503,
      );
    await limit(`login:${email}`, 5, 15 * 60000);
    await limit("login:global", 100, 60000);
    const token = randomBytes(32).toString("hex");
    await db.loginToken.create({
      data: {
        id: hash(token),
        email,
        expiresAt: new Date(Date.now() + 15 * 60000),
      },
    });
    const link = `${process.env.APP_URL || new URL(req.url).origin}/?token=${token}&next=${encodeURIComponent(safeDestination(body.next))}`;
    const delivery = await sendEmail(
      email,
      "Your Toga sign-in link",
      `You requested access to your Toga account.\n\nVerify your email and sign in:\n${link}\n\nThis link expires in 15 minutes and can be used once. After signing in, set a password to log in without email next time.\n\nIf you did not request this email, you can ignore it.\n\nToga\nPeer-to-peer clothing rentals for Georgia Tech students.`,
    );
    if (delivery.error)
      fail(
        "The email service could not send your link. Please try again shortly.",
        503,
      );
    return {
      ok: true,
      ...(process.env.NODE_ENV !== "production" &&
      process.env.DEV_EMAIL_PREVIEW === "true"
        ? { preview: link }
        : {}),
    };
  }
  if (route === "auth/verify" && method === "POST") {
    const token = String(body.token || "");
    if (!/^[a-f0-9]{64}$/.test(token))
      fail("This sign-in link is invalid. Request a new link.");
    const user = await db.$transaction(async (tx) => {
      const t = await tx.loginToken.findUnique({ where: { id: hash(token) } });
      if (!t || t.expiresAt < new Date() || !isAllowedEmail(t.email))
        fail("This link has expired or was used. Request a new sign-in link.");
      await tx.loginToken.delete({ where: { id: t.id } });
      return tx.user.upsert({
        where: { email: t.email },
        update: {
          role:
            t.email === normalizeEmail(process.env.ADMIN_EMAIL)
              ? "admin"
              : "user",
        },
        create: {
          email: t.email,
          role:
            t.email === normalizeEmail(process.env.ADMIN_EMAIL)
              ? "admin"
              : "user",
        },
      });
    });
    await createSession(user, true);
    return {
      ok: true,
      next:
        user.phone && user.name ? safeDestination(body.next) : "/?view=profile",
    };
  }
  if (route === "auth/logout" && method === "POST") {
    const token = (await cookies()).get("toga_session")?.value;
    if (token) await db.session.deleteMany({ where: { id: hash(token) } });
    (await cookies()).delete("toga_session");
    return { ok: true };
  }
  if (route === "me" && method === "GET") {
    const user = await currentUser();
    if (!user) return { user: null };
    const stats = await db.rating.aggregate({
      where: { ratedUserId: user.id },
      _avg: { score: true },
      _count: { score: true },
    });
    return {
      user: {
        ...user,
        hasPassword: Boolean(user.passwordHash),
        rating: stats._avg.score,
        ratingCount: stats._count.score,
      },
    };
  }
  if (route === "me" && method === "PATCH") {
    const u = await requireUser();
    const name = String(body.name || "").trim(),
      phone = String(body.phone || "").trim(),
      classYear = body.classYear ? Number(body.classYear) : null;
    if (
      name.length < 2 ||
      name.length > 80 ||
      !/^\+?[\d\s().-]{7,25}$/.test(phone) ||
      phone.replace(/\D/g, "").length < 7 ||
      (classYear !== null &&
        (!Number.isInteger(classYear) || classYear < 2020 || classYear > 2040))
    )
      fail("Enter your name and a valid phone number.");
    if (body.venmoHandle !== undefined && body.paymentInfo === undefined)
      fail("Please refresh Toga before updating your profile.");
    let paymentInfo;
    try {
      paymentInfo =
        body.paymentInfo === undefined
          ? undefined
          : paymentInformation(body.paymentInfo);
    } catch (error) {
      fail(error.message);
    }
    if (body.profilePhotoUrl) await ownPhotos([body.profilePhotoUrl], u.id);
    return {
      user: await db.user.update({
        where: { id: u.id },
        data: {
          name,
          phone,
          classYear,
          paymentInfo,
          profilePhotoUrl: body.profilePhotoUrl || null,
        },
      }),
    };
  }
  if (route === "upload" && method === "POST")
    return savePhoto(req, await requireUser());
  if (segments[0] === "photos" && segments.length === 2 && method === "GET") {
    const bytes = await readPhoto(segments[1], await requireUser());
    return new Response(bytes, {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
  if (route === "listings" && method === "GET") {
    await expireRequests();
    const u = await requireUser(),
      mine = new URL(req.url).searchParams.get("mine") === "true";
    if (mine && !u) fail("Please sign in.", 401);
    const listings = await db.listing.findMany({
      where: mine
        ? { ownerId: u.id, status: { not: "Archived" } }
        : {
            status: "Active",
            isDemo: false,
            owner: {
              OR: [
                { email: { endsWith: "@gatech.edu" } },
                { email: ADMIN_EXCEPTION_EMAIL },
              ],
            },
          },
      include: { owner: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    const ratings = await db.rating.findMany();
    return {
      listings: listings.map((l) => {
        const rs = ratings.filter((r) => r.ratedUserId === l.ownerId);
        return {
          ...l,
          photos: JSON.parse(l.photos),
          owner: publicUser(l.owner),
          rating: rs.length
            ? rs.reduce((a, r) => a + r.score, 0) / rs.length
            : null,
          ratingCount: rs.length,
        };
      }),
    };
  }
  if (route === "listings" && method === "POST") {
    const u = await requireProfile();
    return {
      listing: await db.listing.create({
        data: { ...(await listingData(body, u.id)), ownerId: u.id },
      }),
    };
  }
  if (
    segments[0] === "listings" &&
    segments.length === 2 &&
    ["PATCH", "DELETE"].includes(method)
  ) {
    const u = await requireUser(),
      l = await db.listing.findUnique({ where: { id: segments[1] } });
    if (!l || l.ownerId !== u.id) fail("Listing not found.", 404);
    if (!["Active", "Draft"].includes(l.status))
      fail("Finish the current rental before editing this listing.");
    const changes =
      method === "DELETE"
        ? { status: "Archived" }
        : await listingData(body, u.id);
    const updated = await db.listing.updateMany({
      where: { id: l.id, ownerId: u.id, status: { in: ["Active", "Draft"] } },
      data: changes,
    });
    if (!updated.count)
      fail("This piece was just requested. Finish the rental before editing.");
    return { ok: true };
  }
  if (route === "requests" && method === "POST") {
    const u = await requireProfile();
    let dates;
    try {
      dates = dateRange(body.startDate, body.endDate);
    } catch (error) {
      fail(error.message);
    }
    const notification = await db.$transaction(async (tx) => {
      const l = await tx.listing.findUnique({
        where: { id: body.listingId },
        include: { owner: true },
      });
      if (
        !l ||
        l.status !== "Active" ||
        l.isDemo ||
        !isAllowedEmail(l.owner.email)
      )
        fail("This item is no longer available.");
      if (l.ownerId === u.id) fail("You cannot rent your own listing.");
      const reserved = await tx.listing.updateMany({
        where: { id: l.id, status: "Active" },
        data: { status: "Requested" },
      });
      if (!reserved.count) fail("Someone else just requested this item.");
      const rental = await tx.rentalRequest.create({
        data: {
          listingId: l.id,
          lenderId: l.ownerId,
          renterId: u.id,
          pricePerDay: l.price,
          ...dates,
        },
        include: { listing: { include: { owner: true } } },
      });
      return tx.email.create({
        data: {
          id: `request-${rental.id}-pending`,
          to: l.owner.email,
          subject: "New rental request · Toga",
          text: `${u.name} requested ${l.title}. Accept or decline within 48 hours: ${process.env.APP_URL}/?view=rentals`,
        },
      });
    });
    await deliverEmail(notification);
    return { ok: true };
  }
  if (route === "requests" && method === "GET") {
    const u = await requireUser();
    await expireRequests();
    const requests = await db.rentalRequest.findMany({
      where: { OR: [{ renterId: u.id }, { lenderId: u.id }] },
      include: {
        listing: true,
        ratings: true,
        checks: true,
        reports: { where: { reporterId: u.id } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    const people = await db.user.findMany({
      where: { id: { in: requests.flatMap((r) => [r.renterId, r.lenderId]) } },
    });
    return {
      requests: requests.map((r) => ({
        ...r,
        listing: { ...r.listing, photos: JSON.parse(r.listing.photos) },
        partner: (() => {
          const p = people.find(
            (p) => p.id === (r.renterId === u.id ? r.lenderId : r.renterId),
          );
          return {
            ...publicUser(p),
            ...(["Confirmed", "Active Rental", "Completed"].includes(r.status)
              ? {
                  phone: p.phone,
                  ...(r.renterId === u.id
                    ? { paymentInfo: p.paymentInfo }
                    : {}),
                }
              : {}),
          };
        })(),
      })),
    };
  }
  if (
    segments[0] === "requests" &&
    segments.length === 3 &&
    method === "POST"
  ) {
    const u = await requireUser(),
      r = await ownedRequest(segments[1], u),
      action = segments[2];
    if (action === "rating") {
      if (
        r.status !== "Completed" ||
        !Number.isInteger(body.score) ||
        body.score < 1 ||
        body.score > 5
      )
        fail("Rate a completed rental from 1 to 5 stars.");
      await db.rating.upsert({
        where: { requestId_raterId: { requestId: r.id, raterId: u.id } },
        create: {
          requestId: r.id,
          raterId: u.id,
          ratedUserId: u.id === r.renterId ? r.lenderId : r.renterId,
          score: body.score,
          comment: String(body.comment || "").slice(0, 1000),
        },
        update: {
          score: body.score,
          comment: String(body.comment || "").slice(0, 1000),
        },
      });
      return { ok: true };
    }
    if (action === "report") {
      if (
        r.status !== "Completed" ||
        String(body.description || "").trim().length < 5
      )
        fail("Describe the problem with your completed rental.");
      if (body.photoUrl) await ownPhotos([body.photoUrl], u.id);
      await db.problemReport.create({
        data: {
          requestId: r.id,
          reporterId: u.id,
          description: String(body.description).slice(0, 3000),
          photoUrl: body.photoUrl || null,
        },
      });
      return { ok: true };
    }
    if (action === "condition") {
      if (
        !["Confirmed", "Active Rental", "Completed"].includes(r.status) ||
        !["Pickup", "Return"].includes(body.stage)
      )
        fail("Select a condition photo and stage.");
      await ownPhotos([body.photoUrl], u.id);
      await db.conditionCheck.create({
        data: {
          requestId: r.id,
          userId: u.id,
          stage: body.stage,
          photoUrl: body.photoUrl,
        },
      });
      return { ok: true };
    }
    if (r.status === "Pending" && +r.createdAt < Date.now() - 48 * 3600000) {
      await expireRequests();
      fail("This request has expired.");
    }
    let next;
    try {
      next = transition(
        r.status,
        action,
        u.id === r.lenderId ? "lender" : "renter",
      );
    } catch (error) {
      fail(error.message);
    }
    const notification = await db.$transaction(async (tx) => {
      const changed = await tx.rentalRequest.updateMany({
        where: { id: r.id, status: r.status },
        data: { status: next.requestStatus },
      });
      if (!changed.count) fail("This rental changed. Refresh and try again.");
      await tx.listing.update({
        where: { id: r.listingId },
        data: { status: next.listingStatus },
      });
      if (["accept", "decline", "cancel"].includes(action)) {
        const recipient = await tx.user.findUnique({
          where: { id: action === "cancel" ? r.lenderId : r.renterId },
        });
        return tx.email.create({
          data: {
            id: `request-${r.id}-${action}`,
            to: recipient.email,
            subject: `Rental ${next.requestStatus.toLowerCase()} · Toga`,
            text: `${r.listing.title}: ${next.requestStatus}. See details: ${process.env.APP_URL}/?view=rentals`,
          },
        });
      }
      return null;
    });
    if (notification) await deliverEmail(notification);
    return { ok: true };
  }
  if (route === "admin" && method === "GET") {
    const u = await requireUser();
    if (u.role !== "admin") fail("Admin access required.", 403);
    const [users, listings, requests, reports, emails] = await Promise.all([
      db.user.findMany(),
      db.listing.findMany(),
      db.rentalRequest.findMany(),
      db.problemReport.findMany(),
      db.email.findMany({
        select: {
          id: true,
          to: true,
          subject: true,
          sentAt: true,
          deliveryStatus: true,
          providerMessageId: true,
          error: true,
          createdAt: true,
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 50,
      }),
    ]);
    return { users, listings, requests, reports, emails };
  }
  if (route === "jobs" && method === "POST") {
    if (
      !process.env.CRON_SECRET ||
      req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`
    )
      fail("Unauthorized.", 401);
    return runJobs();
  }
  fail("Not found.", 404);
}
async function dispatch(req, ctx) {
  try {
    const result = await handle(req, ctx);
    return result instanceof Response
      ? result
      : NextResponse.json(
          JSON.parse(
            JSON.stringify(result, (key, value) =>
              key === "passwordHash" ? undefined : value,
            ),
          ),
          {
            headers: { "Cache-Control": "private, no-store" },
          },
        );
  } catch (e) {
    if (!e.status) console.error("Toga API failure", e.code || e.name);
    return NextResponse.json(
      { error: e.status ? e.message : "Something went wrong. Please retry." },
      { status: e.status || 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
export {
  dispatch as GET,
  dispatch as POST,
  dispatch as PATCH,
  dispatch as DELETE,
};
