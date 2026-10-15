// Stored in the same transaction as the rental change, independently of email delivery.
export async function recordRentalActivity(
  tx,
  { requestId, userId, status, message },
) {
  const id = `${requestId}:${status}:${userId}`;
  return tx.rentalActivity.upsert({
    where: { id },
    create: { id, requestId, userId, message },
    update: {},
  });
}
