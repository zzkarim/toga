"use client";
import { useState, useRef } from "react";
import { VerifiedAuthForm } from "./auth-form";
import { api, Field } from "./ui";
export default function SecureAccount({ email, verified, hasPassword, reset }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState("");
  const lock = useRef(false);
  return (
    <main className="secure-account">
      <section className="card">
        <h1>
          {!verified
            ? "Secure your Toga account"
            : reset
              ? "Reset your password"
              : "Create your password"}
        </h1>
        {!verified ? (
          <VerifiedAuthForm
            lockedEmail={email}
            onBusy={setBusy}
            onSuccess={(data) => window.location.replace(data.next)}
          />
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (lock.current) return;
              lock.current = true;
              setBusy(true);
              setError("");
              try {
                const data = await api("auth/password", "POST", {
                  password,
                  confirmPassword: confirm,
                });
                setPassword("");
                setConfirm("");
                window.location.replace(data.next || "/");
              } catch (err) {
                setError(err.message);
              } finally {
                setBusy(false);
                lock.current = false;
              }
            }}
          >
            <p>
              {hasPassword
                ? "Choose a new password after verifying your email."
                : "Use this password for future sign-ins."}
            </p>
            <Field label="Password">
              {(id) => (
                <input
                  id={id}
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={128}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={busy}
                />
              )}
            </Field>
            <p className="muted">Use at least 12 characters.</p>
            <Field label="Confirm password">
              {(id) => (
                <input
                  id={id}
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={128}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  disabled={busy}
                />
              )}
            </Field>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <button className="button burgundy full" disabled={busy}>
              {busy ? "Saving…" : "Continue"}
            </button>
          </form>
        )}
        <button
          type="button"
          className="text-button"
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
          Sign out
        </button>
      </section>
    </main>
  );
}
