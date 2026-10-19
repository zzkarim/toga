"use client";
import { emailStatusLabel, emailType } from "../lib/email-status.mjs";
import { displayCategories } from "../lib/rules.mjs";
import { adminUserName } from "../lib/profile.mjs";
import { useState } from "react";
import { api, Modal, Field, money } from "./ui";
const labels = {
  suspend: "Suspend account",
  reactivate: "Reactivate account",
  close: "Close account",
  hide: "Hide listing",
  restore: "Restore listing",
  remove: "Remove listing",
  cancel: "Cancel rental",
  resolve: "Resolve",
  reopen: "Reopen report",
  note: "Save internal note",
};
export default function AdminDashboard({ data, onRefresh, userId }) {
  const [tab, setTab] = useState("users"),
    [focus, setFocus] = useState(null),
    [pending, setPending] = useState(null),
    [note, setNote] = useState(""),
    [typed, setTyped] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const users = Object.fromEntries(data.users.map((u) => [u.id, u]));
  const listings = Object.fromEntries(data.listings.map((l) => [l.id, l]));
  const requests = Object.fromEntries(data.requests.map((r) => [r.id, r]));
  const who = (id) => users[id]?.name || users[id]?.email || id;
  function inspect(type, id) {
    setTab(type);
    setFocus({ type, id });
  }
  function action(row, action) {
    setPending({ targetType: tab, targetId: row.id, action });
    setNote(row.adminNote || "");
    setTyped("");
    setError("");
  }
  const rows = (data[tab] || []).filter(
    (row) =>
      !focus ||
      (tab === focus.type && row.id === focus.id) ||
      (focus.type === "users" &&
        (row.ownerId === focus.id ||
          row.renterId === focus.id ||
          row.lenderId === focus.id ||
          row.reporterId === focus.id ||
          [
            requests[row.requestId]?.renterId,
            requests[row.requestId]?.lenderId,
          ].includes(focus.id))) ||
      (focus.type === "listings" &&
        (row.listingId === focus.id ||
          requests[row.requestId]?.listingId === focus.id)),
  );
  const required =
    pending?.action === "close"
      ? "CLOSE"
      : pending?.action === "remove"
        ? "REMOVE"
        : pending?.action === "resolve" && pending.targetType === "requests"
          ? "RETURNED"
          : "";
  return (
    <section className="moderation">
      {tab === "emails" && (
        <div>
          <p>
            Provider acceptance does not confirm receipt. Delivery checks
            inspect recent Gmail failure notices.
          </p>
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                const result = await api("admin/email-sync", "POST", {});
                setMessage(
                  result.status === "checked"
                    ? `Delivery check completed: ${result.matched} newly matched failures.`
                    : result.status === "recently-checked"
                      ? "A delivery check ran recently. Try again in a minute."
                      : "Delivery check unavailable. Try again later or inspect the sender mailbox.",
                );
                await onRefresh();
              } catch {
                setError("Couldn't check delivery failures. Please try again.");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Checking…" : "Check delivery failures"}
          </button>
        </div>
      )}
      <div className="admin-tabs" aria-label="Admin sections">
        {["users", "listings", "requests", "reports", "emails", "audit"].map(
          (t) => (
            <button
              key={t}
              aria-pressed={tab === t}
              className={tab === t ? "selected" : ""}
              onClick={() => {
                setTab(t);
                if (["emails", "audit"].includes(t)) setFocus(null);
              }}
            >
              {t}
            </button>
          ),
        )}
      </div>
      {focus && (
        <p>
          Inspecting{" "}
          {focus.type === "users"
            ? who(focus.id)
            : listings[focus.id]?.title || focus.id}
          .{" "}
          <button className="text-button" onClick={() => setFocus(null)}>
            Show all records
          </button>
        </p>
      )}
      {message && <p role="status">{message}</p>}
      <div
        role="region"
        aria-label="Admin records"
        className="moderation-records"
      >
        {!rows.length && <p>No records.</p>}
        {rows.map((row) => (
          <article className="panel moderation-record" key={row.id}>
            <h2>
              {(tab === "users" ? adminUserName(row) : row.name) ||
                row.title ||
                row.subject ||
                (tab === "requests" ? listings[row.listingId]?.title : null) ||
                row.action ||
                "Report"}
            </h2>
            {!["emails", "audit"].includes(tab) && (
              <p className="fine-print">
                <time dateTime={row.createdAt}>
                  {
                    {
                      users: "Joined",
                      listings: "Listed",
                      requests: "Requested",
                      reports: "Reported",
                    }[tab]
                  }{" "}
                  {new Date(row.createdAt).toLocaleString()}
                </time>
              </p>
            )}
            {tab === "users" && (
              <>
                <p>
                  {row.email} · {row.role} · {row.accountStatus}
                </p>
                <p>
                  Terms: {row.termsVersion || "Not accepted"} ·{" "}
                  {row.termsAcceptedAt
                    ? new Date(row.termsAcceptedAt).toLocaleString()
                    : "—"}
                </p>
                <div className="moderation-actions">
                  <button onClick={() => inspect("users", row.id)}>
                    Inspect account history
                  </button>
                  {["listings", "requests", "reports"].map((t) => (
                    <button
                      key={t}
                      onClick={() => {
                        setFocus({ type: "users", id: row.id });
                        setTab(t);
                      }}
                    >
                      View {t}
                    </button>
                  ))}
                  {row.role !== "admin" && row.id !== userId && (
                    <>
                      {row.accountStatus === "Active" ? (
                        <button onClick={() => action(row, "suspend")}>
                          Suspend account
                        </button>
                      ) : (
                        <button onClick={() => action(row, "reactivate")}>
                          Reactivate account
                        </button>
                      )}
                      {row.accountStatus !== "Closed" && (
                        <button onClick={() => action(row, "close")}>
                          Close account
                        </button>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
            {tab === "listings" && (
              <>
                <p>
                  {row.status} · {row.moderationStatus} ·{" "}
                  {displayCategories(row).join(", ") || "No tags"}
                </p>
                <p>
                  Replacement value:{" "}
                  {row.retailValue == null
                    ? "Not specified"
                    : money(row.retailValue)}
                </p>
                <button
                  className="text-button"
                  onClick={() => inspect("users", row.ownerId)}
                >
                  Owner: {who(row.ownerId)}
                </button>
                <div className="moderation-actions">
                  <button
                    onClick={() => {
                      setFocus({ type: "listings", id: row.id });
                      setTab("requests");
                    }}
                  >
                    View rentals
                  </button>
                  <button
                    onClick={() => {
                      setFocus({ type: "listings", id: row.id });
                      setTab("reports");
                    }}
                  >
                    View reports
                  </button>
                  {row.moderationStatus === "Visible" ? (
                    <button onClick={() => action(row, "hide")}>
                      Hide listing
                    </button>
                  ) : (
                    <button onClick={() => action(row, "restore")}>
                      Restore listing
                    </button>
                  )}
                  {row.moderationStatus !== "Removed" && (
                    <button onClick={() => action(row, "remove")}>
                      Remove listing
                    </button>
                  )}
                </div>
              </>
            )}
            {tab === "requests" && (
              <>
                <p>
                  {row.status} · {new Date(row.startDate).toLocaleDateString()}{" "}
                  – {new Date(row.endDate).toLocaleDateString()}
                </p>
                <p>
                  Renter:{" "}
                  <button
                    className="text-button"
                    onClick={() => inspect("users", row.renterId)}
                  >
                    {who(row.renterId)}
                  </button>{" "}
                  · Lender:{" "}
                  <button
                    className="text-button"
                    onClick={() => inspect("users", row.lenderId)}
                  >
                    {who(row.lenderId)}
                  </button>
                </p>
                <button
                  className="text-button"
                  onClick={() => inspect("listings", row.listingId)}
                >
                  Inspect listing
                </button>
                <div className="moderation-actions">
                  {["Pending", "Confirmed"].includes(row.status) && (
                    <button onClick={() => action(row, "cancel")}>
                      Cancel rental
                    </button>
                  )}
                  {row.status === "Active Rental" && (
                    <button onClick={() => action(row, "resolve")}>
                      Resolve returned rental
                    </button>
                  )}
                </div>
              </>
            )}
            {tab === "reports" && (
              <>
                <p>
                  {row.status} · {who(row.reporterId)}
                </p>
                <p>{row.description}</p>
                {row.photoUrl && (
                  <a href={row.photoUrl} target="_blank" rel="noreferrer">
                    View report photo
                  </a>
                )}
                <p>Internal note: {row.adminNote || "None"}</p>
                <div className="moderation-actions">
                  <button onClick={() => inspect("requests", row.requestId)}>
                    Inspect rental
                  </button>
                  <button
                    onClick={() =>
                      inspect("listings", requests[row.requestId]?.listingId)
                    }
                  >
                    Inspect listing
                  </button>
                  <button onClick={() => inspect("users", row.reporterId)}>
                    Inspect reporter
                  </button>
                  <button
                    onClick={() =>
                      action(
                        row,
                        row.status === "Resolved" ? "reopen" : "resolve",
                      )
                    }
                  >
                    {row.status === "Resolved"
                      ? "Reopen report"
                      : "Resolve report"}
                  </button>
                  <button onClick={() => action(row, "note")}>
                    Edit internal note
                  </button>
                </div>
              </>
            )}
            {tab === "emails" && (
              <>
                <p>
                  {row.to} · {emailStatusLabel(row.deliveryStatus)}
                </p>
                <p>
                  {emailType(row.subject)} · Attempts: {row.attempts}
                </p>
                <p>{row.error || ""}</p>
                {row.sentAt && (
                  <p>
                    Provider accepted:{" "}
                    <time dateTime={row.sentAt}>
                      {new Date(row.sentAt).toLocaleString()}
                    </time>
                  </p>
                )}
                {row.providerMessageId && (
                  <details>
                    <summary>Provider message ID</summary>
                    <p style={{ overflowWrap: "anywhere" }}>
                      {row.providerMessageId}
                    </p>
                  </details>
                )}
                <p>
                  <time dateTime={row.createdAt}>
                    {new Date(row.createdAt).toLocaleString()}
                  </time>
                </p>
              </>
            )}
            {tab === "audit" && (
              <>
                <p>
                  {row.targetType} · {row.targetId}
                </p>
                <p>{row.note}</p>
                <p>
                  {who(row.adminId)} ·{" "}
                  <time dateTime={row.createdAt}>
                    {new Date(row.createdAt).toLocaleString()}
                  </time>
                </p>
              </>
            )}
          </article>
        ))}
      </div>
      {pending && (
        <Modal
          title={`Confirm: ${labels[pending.action]}`}
          busy={busy}
          onClose={() => setPending(null)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy) return;
              setBusy(true);
              setError("");
              try {
                await api("admin/moderate", "POST", {
                  ...pending,
                  note,
                  confirm: true,
                  confirmText: typed,
                });
                setPending(null);
                setMessage("Moderation action saved.");
                await onRefresh();
              } catch (e) {
                setError(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <p>
              {pending.targetType === "users"
                ? "Disabled accounts cannot sign in and their listings are excluded from Browse. Account history and legal records are retained. Reactivation restores access; existing sessions must sign in again."
                : pending.targetType === "listings"
                  ? "This changes marketplace visibility. It preserves the listing, reports, and existing rental access. Removal can be reversed by an administrator."
                  : pending.targetType === "requests"
                    ? "This changes the rental state and notifies both participants in Toga. Resolve an active rental only after confirming that the item was returned. No payment or refund is processed."
                    : "This updates the internal report record. Notes are visible only to administrators."}
            </p>
            <Field label="Reason / internal note">
              {(id) => (
                <textarea
                  id={id}
                  required
                  minLength={3}
                  maxLength={500}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              )}
            </Field>
            {required && (
              <Field label={`Type ${required} to confirm`}>
                {(id) => (
                  <input
                    id={id}
                    autoComplete="off"
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    required
                  />
                )}
              </Field>
            )}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <div className="form-actions">
              <button
                type="button"
                className="text-button"
                disabled={busy}
                onClick={() => setPending(null)}
              >
                Cancel
              </button>
              <button
                className="button burgundy"
                disabled={busy || (!!required && typed !== required)}
              >
                {busy ? "Saving…" : "Confirm action"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
