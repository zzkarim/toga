"use client";
import { useState } from "react";
import { api } from "./ui";
import { ACCEPTANCE, TERMS_VERSION, PRIVACY_VERSION } from "../lib/legal.mjs";
export default function AcceptTerms({ draft = true }) {
  const [accepted, setAccepted] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <main className="legal-document acceptance">
      <h1>Before you use Toga</h1>
      <p>
        Please review the current terms, privacy policy, and age requirement.
      </p>
      {draft && (
        <p className="draft-banner">
          DRAFT: non-final pilot documents. Operator identification,
          jurisdiction, and legal review remain pending; no attorney approval is
          claimed.
        </p>
      )}
      <p>
        <a href="/terms">Terms of Service</a> ·{" "}
        <a href="/privacy">Privacy Policy</a> · <a href="/safety">Safety</a>
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await api("legal/accept", "POST", {
              accepted,
              termsVersion: TERMS_VERSION,
              privacyVersion: PRIVACY_VERSION,
            });
            window.location.replace("/");
          } catch (e) {
            setError(e.message);
            setBusy(false);
          }
        }}
      >
        <label className="legal-check">
          <input
            type="checkbox"
            required
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
          />
          <span>{ACCEPTANCE}</span>
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="button burgundy" disabled={!accepted || busy}>
          {busy ? "Saving…" : "Agree and continue"}
        </button>
        <button
          className="text-button"
          type="button"
          disabled={busy}
          onClick={async () => {
            try {
              await api("auth/logout", "POST", {});
              window.location.replace("/");
            } catch (e) {
              setError(e.message);
            }
          }}
        >
          Log out
        </button>
      </form>
      <p className="fine-print">
        Terms {TERMS_VERSION} · Privacy {PRIVACY_VERSION}
      </p>
    </main>
  );
}
