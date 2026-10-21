import { fail } from "./security";
import { recordRentalActivity } from "./rental-activity.mjs";
const liveStates = ["Pending", "Confirmed", "Active Rental"];
export async function moderate(tx, admin, body) {
  const { targetType, targetId, action } = body;
  if (
    body.confirm !== true ||
    typeof targetId !== "string" ||
    !targetId ||
    typeof body.note !== "string" ||
    body.note.trim().length < 3 ||
    body.note.length > 500
  )
    fail("Confirm the action and add a short reason (3–500 characters).");
  const note = body.note.trim();
  if (targetType === "users") {
    const user = await tx.user.findUnique({ where: { id: targetId } });
    if (!user) fail("Account not found.", 404);
    if (user.id === admin.id || user.role === "admin")
      fail("Administrator accounts cannot be disabled here.");
    if (!["suspend", "reactivate", "close"].includes(action))
      fail("Invalid account action.");
    if (action === "close" && body.confirmText !== "CLOSE")
      fail("Type CLOSE to confirm account closure.");
    if (
      action === "close" &&
      (await tx.rentalRequest.count({
        where: {
          status: { in: liveStates },
          OR: [{ renterId: targetId }, { lenderId: targetId }],
        },
      }))
    )
      fail(
        "Resolve active rentals before closing this account. Suspension is available meanwhile.",
      );
    await tx.user.update({
      where: { id: targetId },
      data: {
        accountStatus:
          action === "reactivate"
            ? "Active"
            : action === "close"
              ? "Closed"
              : "Suspended",
      },
    });
    if (action !== "reactivate") {
      await tx.session.deleteMany({ where: { userId: targetId } });
      await tx.emailOtp.deleteMany({ where: { email: user.email } });
      await tx.loginToken.deleteMany({ where: { email: user.email } });
    }
  } else if (targetType === "listings") {
    if (!["hide", "restore", "remove"].includes(action))
      fail("Invalid listing action.");
    if (action === "remove" && body.confirmText !== "REMOVE")
      fail("Type REMOVE to confirm removal.");
    const listing = await tx.listing.findUnique({ where: { id: targetId } });
    if (!listing) fail("Listing not found.", 404);
    // Moderation is separate from rental availability: active partners retain their history.
    await tx.listing.update({
      where: { id: targetId },
      data: {
        moderationStatus:
          action === "restore"
            ? "Visible"
            : action === "hide"
              ? "Hidden"
              : "Removed",
      },
    });
  } else if (targetType === "requests") {
    const rental = await tx.rentalRequest.findUnique({
      where: { id: targetId },
    });
    if (!rental) fail("Rental not found.", 404);
    if (
      action === "cancel"
        ? !["Pending", "Confirmed"].includes(rental.status)
        : action !== "resolve" || rental.status !== "Active Rental"
    )
      fail(
        "This action is not available for this rental. An active rental must be resolved after return.",
      );
    if (action === "resolve" && body.confirmText !== "RETURNED")
      fail("Confirm the item was returned by typing RETURNED.");
    const status = action === "cancel" ? "Cancelled" : "Completed";
    const updated = await tx.rentalRequest.updateMany({
      where: { id: targetId, status: rental.status },
      data: { status },
    });
    if (!updated.count)
      fail("The rental changed. Refresh before trying again.", 409);
    for (const userId of [rental.renterId, rental.lenderId])
      await recordRentalActivity(tx, {
        requestId: targetId,
        userId,
        status,
        message: `Toga moderation: rental ${status.toLowerCase()}. Contact Toga for assistance.`,
      });
  } else if (targetType === "reports") {
    if (!["resolve", "reopen", "note"].includes(action))
      fail("Invalid report action.");
    if (!(await tx.problemReport.findUnique({ where: { id: targetId } })))
      fail("Report not found.", 404);
    await tx.problemReport.update({
      where: { id: targetId },
      data: {
        adminNote: note,
        ...(action === "note"
          ? {}
          : {
              status: action === "resolve" ? "Resolved" : "Open",
              resolvedAt: action === "resolve" ? new Date() : null,
            }),
      },
    });
  } else if (targetType === "wanted") {
    if (!["remove", "restore"].includes(action))
      fail("Invalid wanted request action.");
    const post = await tx.wantedPost.findUnique({ where: { id: targetId } });
    if (!post) fail("Wanted request not found.", 404);
    await tx.wantedPost.update({
      where: { id: targetId },
      data: { moderationStatus: action === "remove" ? "Removed" : "Visible" },
    });
  } else fail("Invalid moderation target.");
  await tx.adminAudit.create({
    data: { adminId: admin.id, targetType, targetId, action, note },
  });
  return { ok: true };
}
