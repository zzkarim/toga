"use client";
import PasswordAuthForm from "./password-auth-form";
import { CONTACT_EMAIL } from "../lib/contact.mjs";
import SeasonalDecor from "./seasonal-decor";
import { useEffect, useRef, useState } from "react";
import { api, Field } from "./ui";
import {
  DOMAIN_ERROR,
  isAllowedEmail,
  normalizeEmail,
} from "../lib/campus.mjs";
const storageKey = "toga-pending-verification";
export default function AuthForm({
  onSuccess,
  onBusy,
  requireEmailVerification = true,
}) {
  const [recovery, setRecovery] = useState(false),
    [recoveryBusy, setRecoveryBusy] = useState(false);
  const reportBusy = (value) => {
    setRecoveryBusy(value);
    onBusy(value);
  };
  if (requireEmailVerification)
    return <VerifiedAuthForm onSuccess={onSuccess} onBusy={onBusy} />;
  if (recovery)
    return (
      <>
        <button
          type="button"
          className="text-button"
          disabled={recoveryBusy}
          onClick={() => setRecovery(false)}
        >
          Back to email and password
        </button>
        <VerifiedAuthForm
          onSuccess={onSuccess}
          onBusy={reportBusy}
          recoveryOnly
        />
      </>
    );
  return (
    <PasswordAuthForm
      onSuccess={onSuccess}
      onBusy={onBusy}
      onRecovery={() => setRecovery(true)}
    />
  );
}
export function VerifiedAuthForm({
  onSuccess,
  onBusy = () => {},
  recoveryOnly = false,
  lockedEmail = "",
}) {
  const [recovering, setRecovering] = useState(recoveryOnly);
  const [email, setEmail] = useState(lockedEmail),
    [mode, setMode] = useState("code"),
    [password, setPassword] = useState("");
  const [pending, setPending] = useState(null),
    [digits, setDigits] = useState(Array(6).fill(""));
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [now, setNow] = useState(Date.now()),
    [preview, setPreview] = useState("");
  const [deliveryStatus, setDeliveryStatus] = useState("");
  const inputs = useRef([]),
    lock = useRef(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey));
      if (
        saved &&
        (!lockedEmail || saved.email === lockedEmail) &&
        Date.parse(saved.expiresAt) > Date.now()
      ) {
        setEmail(saved.email);
        setPending(saved);
        setRecovering(saved.purpose === "recovery");
      } else sessionStorage.removeItem(storageKey);
    } catch {}
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (pending) inputs.current[0]?.focus();
  }, [pending]);
  useEffect(() => {
    setDeliveryStatus("");
    if (!pending) return;
    let stopped = false,
      timer;
    async function check() {
      if (stopped || Date.parse(pending.expiresAt) <= Date.now()) return;
      if (!document.hidden) {
        try {
          const result = await api("auth/otp/status", "POST", {
            email: pending.email,
            challenge: pending.challenge,
          });
          if (!stopped) setDeliveryStatus(result.status);
        } catch {
          /* Delivery checks must not interrupt code entry. */
        }
      }
      if (!stopped) timer = setTimeout(check, 60000);
    }
    timer = setTimeout(check, 15000);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [pending]);
  const cooldown = pending
    ? Math.max(0, Math.ceil((Date.parse(pending.resendAt) - now) / 1000))
    : 0;
  const expired = pending && Date.parse(pending.expiresAt) <= now;
  async function run(action) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    onBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(e.message);
    } finally {
      lock.current = false;
      setBusy(false);
      onBusy(false);
    }
  }
  async function requestCode() {
    if (!isAllowedEmail(email)) throw new Error(DOMAIN_ERROR);
    const purpose = lockedEmail
      ? "migrate"
      : recovering
        ? "recovery"
        : "signup";
    const data = await api("auth/otp/request", "POST", { email, purpose });
    const value = {
      email: normalizeEmail(email),
      challenge: data.challenge,
      purpose,
      expiresAt: data.expiresAt,
      resendAt: data.resendAt,
    };
    setEmail(value.email);
    setPending(value);
    setDigits(Array(6).fill(""));
    setNow(Date.now());
    setPreview(data.previewCode || "");
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(value));
    } catch {}
  }
  function insert(index, value) {
    const numbers = value.replace(/\D/g, "");
    if (!numbers) {
      setDigits((old) => old.map((d, i) => (i === index ? "" : d)));
      return;
    }
    const start = numbers.length === 6 ? 0 : index;
    setDigits((old) => {
      const next = [...old];
      [...numbers].slice(0, 6 - start).forEach((d, i) => (next[start + i] = d));
      return next;
    });
    inputs.current[Math.min(5, start + numbers.length)]?.focus();
  }
  if (pending)
    return (
      <form
        className="seasonal-auth"
        onSubmit={(e) => {
          e.preventDefault();
          run(async () => {
            const data = await api("auth/otp/verify", "POST", {
              email: pending.email,
              challenge: pending.challenge,
              code: digits.join(""),
              purpose: lockedEmail ? "migrate" : pending.purpose || "signup",
            });
            try {
              sessionStorage.removeItem(storageKey);
            } catch {}
            setDigits(Array(6).fill(""));
            await onSuccess(data);
          });
        }}
      >
        <SeasonalDecor variant="auth" />
        <h3>Enter your code</h3>
        <p>
          A six-digit code was requested for <strong>{pending.email}</strong>.
          It expires in 10 minutes.
        </p>
        <div
          className="otp-inputs"
          role="group"
          aria-label="Six-digit verification code"
        >
          {digits.map((digit, index) => (
            <input
              key={index}
              ref={(el) => (inputs.current[index] = el)}
              aria-label={`Digit ${index + 1}`}
              type="text"
              inputMode="numeric"
              autoComplete={index === 0 ? "one-time-code" : "off"}
              value={digit}
              disabled={busy}
              onFocus={(e) => e.target.select()}
              onChange={(e) => insert(index, e.target.value)}
              onPaste={(e) => {
                e.preventDefault();
                insert(index, e.clipboardData.getData("text"));
              }}
              onKeyDown={(e) => {
                if (e.key === "Backspace" && !digit && index > 0) {
                  e.preventDefault();
                  setDigits((old) =>
                    old.map((d, i) => (i === index - 1 ? "" : d)),
                  );
                  inputs.current[index - 1]?.focus();
                }
                if (e.key === "ArrowLeft" && index > 0) {
                  e.preventDefault();
                  inputs.current[index - 1]?.focus();
                }
                if (e.key === "ArrowRight" && index < 5) {
                  e.preventDefault();
                  inputs.current[index + 1]?.focus();
                }
              }}
            />
          ))}
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {deliveryStatus === "Bounced" && (
          <p className="error" role="status">
            Your email provider reported that this code could not be delivered.
            Wait for Resend code to become available, then try again. If it
            keeps failing, contact {CONTACT_EMAIL}. You can also use an existing
            password below.
          </p>
        )}
        {expired && <p role="status">This code expired. Request a new one.</p>}
        <button
          className="button burgundy full"
          disabled={busy || expired || digits.join("").length !== 6}
        >
          {busy ? "Verifying…" : "Verify"}
        </button>
        <div className="otp-actions">
          <button
            type="button"
            className="text-button otp-action"
            disabled={busy || cooldown > 0}
            onClick={() => run(requestCode)}
          >
            {cooldown ? `Resend code in ${cooldown}s` : "Resend code"}
          </button>
          <button
            type="button"
            className="text-button otp-action"
            disabled={busy}
            onClick={() => {
              setPending(null);
              setPreview("");
              setError("");
              try {
                sessionStorage.removeItem(storageKey);
              } catch {}
            }}
          >
            {lockedEmail ? "Back" : "Use a different email"}
          </button>
        </div>
        <p className="muted">
          By continuing you agree to our <a href="/terms">Terms</a> and{" "}
          <a href="/privacy">Privacy Policy</a>. Add login@jointoga.com to your
          contacts so Toga emails reach your inbox.
        </p>
        {!lockedEmail && (
          <button
            type="button"
            className="text-button"
            disabled={busy}
            onClick={() => {
              setPending(null);
              setMode("password");
              setError("");
              setPreview("");
              try {
                sessionStorage.removeItem(storageKey);
              } catch {}
            }}
          >
            Use an existing password
          </button>
        )}
        <p className="muted otp-help">
          Didn't get the code? Check Spam/Junk, then try Resend code. A
          successful resend replaces the previous code.
        </p>
        {preview && (
          <p>
            Development only: <code>{preview}</code>
          </p>
        )}
      </form>
    );
  return (
    <form
      className="seasonal-auth"
      onSubmit={(e) => {
        e.preventDefault();
        run(async () => {
          if (!isAllowedEmail(email)) throw new Error(DOMAIN_ERROR);
          if (mode === "code") await requestCode();
          else {
            const data = await api("auth/password-login", "POST", {
              email,
              password,
            });
            setPassword("");
            await onSuccess(data);
          }
        });
      }}
    >
      <SeasonalDecor variant="auth" />
      <h3>
        {lockedEmail
          ? "Verify your email"
          : recovering
            ? "Recover your account"
            : mode === "code"
              ? "Join Toga"
              : "Sign in to Toga"}
      </h3>
      <p>
        {mode === "code"
          ? recovering
            ? "Verify your email to recover access and set a new password."
            : "Verify your Georgia Tech email, then create a password for future sign-ins."
          : "Use your existing Toga password."}
      </p>
      <Field label="Email address">
        {(id) => (
          <input
            id={id}
            type="email"
            required
            autoComplete="email"
            autoCapitalize="none"
            spellCheck="false"
            placeholder="you@gatech.edu"
            value={email}
            disabled={busy || Boolean(lockedEmail)}
            onChange={(e) => setEmail(e.target.value)}
          />
        )}
      </Field>
      {mode === "password" && (
        <Field label="Password">
          {(id) => (
            <input
              id={id}
              type="password"
              required
              maxLength={128}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </Field>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button className="button burgundy full" disabled={busy}>
        {busy ? "Please wait…" : mode === "code" ? "Continue" : "Sign in"}
      </button>
      {!lockedEmail && (
        <button
          type="button"
          className="text-button"
          disabled={busy}
          onClick={() => {
            setRecovering(mode === "password");
            setMode(mode === "code" ? "password" : "code");
            setPassword("");
            setError("");
          }}
        >
          {mode === "code"
            ? "Already have an account? Sign in"
            : "Forgot password? Verify your email"}
        </button>
      )}
      <p className="muted">
        By continuing you agree to our <a href="/terms">Terms</a> and{" "}
        <a href="/privacy">Privacy Policy</a>. Add login@jointoga.com to your
        contacts so Toga emails reach your inbox. Use your Georgia Tech email
        address. Check Junk/Spam if your email doesn’t arrive.
      </p>
    </form>
  );
}
