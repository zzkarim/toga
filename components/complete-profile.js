"use client";
import { useState } from "react";
import { api, Field } from "./ui";
import { displayPhone } from "../lib/profile.mjs";
export default function CompleteProfile({
  name: initialName,
  phone: initialPhone,
}) {
  const [name, setName] = useState(initialName),
    [phone, setPhone] = useState(displayPhone(initialPhone));
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <main className="complete-profile panel">
      <p className="eyebrow">Toga</p>
      <h1>Complete your profile</h1>
      <p>
        Tell us how other students can identify and contact you during a rental.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await api("me", "PATCH", { name, phone });
            window.location.replace("/?view=browse");
          } catch (e) {
            setError(e.message);
            setBusy(false);
          }
        }}
      >
        <Field label="Name">
          {(id) => (
            <input
              id={id}
              autoComplete="name"
              required
              minLength={2}
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}
        </Field>
        <Field label="Phone number">
          {(id) => (
            <input
              id={id}
              type="tel"
              autoComplete="tel"
              required
              maxLength={30}
              placeholder="(404) 555-1234"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onBlur={() => setPhone(displayPhone(phone))}
              aria-describedby="phone-privacy"
            />
          )}
        </Field>
        <p className="fine-print" id="phone-privacy">
          Your number is shared only with confirmed rental partners.
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="button burgundy full" disabled={busy}>
          {busy ? "Saving…" : "Continue to Toga"}
        </button>
        <button
          className="text-button"
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await api("auth/logout", "POST", {});
              window.location.replace("/");
            } catch (e) {
              setError(e.message);
              setBusy(false);
            }
          }}
        >
          Log out
        </button>
      </form>
    </main>
  );
}
