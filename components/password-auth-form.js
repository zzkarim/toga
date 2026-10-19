"use client";
import { useRef, useState } from "react";
import { api, Field } from "./ui";
import { DOMAIN_ERROR, isAllowedEmail } from "../lib/campus.mjs";
import { CONTACT_EMAIL } from "../lib/contact.mjs";
import SeasonalDecor from "./seasonal-decor";
export default function PasswordAuthForm({ onSuccess, onBusy, onRecovery }) {
  const [mode, setMode] = useState("signup"),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [confirmPassword, setConfirmPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const lock = useRef(false);
  const signup = mode === "signup";
  return (
    <form
      className="seasonal-auth"
      onSubmit={async (e) => {
        e.preventDefault();
        if (lock.current) return;
        lock.current = true;
        setBusy(true);
        onBusy(true);
        setError("");
        try {
          if (!isAllowedEmail(email)) throw Error(DOMAIN_ERROR);
          if (signup && password !== confirmPassword)
            throw Error("Passwords do not match.");
          const data = await api(
            signup ? "auth/signup" : "auth/password-login",
            "POST",
            { email, password, ...(signup ? { confirmPassword } : {}) },
          );
          setPassword("");
          setConfirmPassword("");
          await onSuccess(data);
        } catch (e) {
          setError(e.message);
        } finally {
          lock.current = false;
          setBusy(false);
          onBusy(false);
        }
      }}
    >
      <SeasonalDecor variant="auth" />
      <h3>{signup ? "Create your Toga account" : "Log in to Toga"}</h3>
      <Field label="Georgia Tech email">
        {(id) => (
          <input
            id={id}
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="you@gatech.edu"
            required
            disabled={busy}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        )}
      </Field>
      <Field label="Password">
        {(id) => (
          <input
            id={id}
            type="password"
            autoComplete={signup ? "new-password" : "current-password"}
            required
            minLength={signup ? 12 : undefined}
            maxLength={128}
            disabled={busy}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        )}
      </Field>
      {signup && (
        <>
          <p className="muted">Use at least 12 characters.</p>
          <Field label="Confirm password">
            {(id) => (
              <input
                id={id}
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                maxLength={128}
                disabled={busy}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            )}
          </Field>
        </>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button className="button burgundy full" disabled={busy}>
        {busy ? "Please wait…" : signup ? "Create account" : "Log in"}
      </button>
      <div className="otp-actions">
        <button
          type="button"
          className="text-button otp-action"
          disabled={busy}
          onClick={() => {
            setMode(signup ? "login" : "signup");
            setPassword("");
            setConfirmPassword("");
            setError("");
          }}
        >
          {signup
            ? "Already have an account? Log in"
            : "New to Toga? Create account"}
        </button>
        {!signup && (
          <button
            type="button"
            className="text-button otp-action"
            disabled={busy}
            onClick={() => setMode("recovery")}
          >
            Account recovery
          </button>
        )}
      </div>
      {mode === "recovery" && (
        <div role="status">
          <p>
            If you’re still signed in on another device, set a password from
            Account there. Otherwise, email {CONTACT_EMAIL} for help proving
            account ownership. We cannot reset a password just from an email
            address.
          </p>
          <p>
            You can also try the existing email recovery option, but email
            delivery is currently unreliable.
          </p>
          <button
            type="button"
            className="text-button"
            disabled={busy}
            onClick={onRecovery}
          >
            Try email recovery
          </button>
        </div>
      )}
      <p className="muted">
        By continuing you agree to our <a href="/terms">Terms</a> and{" "}
        <a href="/privacy">Privacy Policy</a>.
      </p>
    </form>
  );
}
