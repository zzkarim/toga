"use client";
import {
  LENDER_CONFIRMATION,
  renterAcknowledgement,
  TERMS_VERSION,
} from "../lib/legal.mjs";
import RentalCalendar from "./rental-calendar";
import { rangeAvailable } from "../lib/availability.mjs";
import { useState } from "react";
import { Field, PhotoUpload, money } from "./ui";
import { categories } from "../lib/rules.mjs";
import { rentalTotal } from "../lib/browse.mjs";
import SizeInput from "./size-input";
import { sizeFields, sizeValue } from "../lib/sizing.mjs";
import { displayPhone } from "../lib/profile.mjs";
export function ListingForm({ item, onSubmit, busy, onUpload }) {
  const [form, setForm] = useState(
    item || {
      title: "",
      description: "",
      categories: [],
      size: "M",
      condition: "Good",
      retailValue: "",
      price: "",
      photos: [],
    },
  );
  const [sizing, setSizing] = useState(() => sizeFields(item?.size || "M"));
  const [sizeError, setSizeError] = useState("");
  const [lenderConfirmed, setLenderConfirmed] = useState(false);
  const [uploading, setUploading] = useState(false);
  const set = (key, value) => setForm((old) => ({ ...old, [key]: value }));
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!uploading && lenderConfirmed) {
          try {
            setSizeError("");
            onSubmit({ ...form, size: sizeValue(sizing), lenderConfirmed });
          } catch (error) {
            setSizeError(error.message);
          }
        }
      }}
    >
      <div className="field">
        <span>Photos · at least one</span>
        <PhotoUpload
          value={form.photos}
          onChange={(photos) => set("photos", photos)}
          onBusyChange={(value) => {
            setUploading(value);
            onUpload(value);
          }}
        />
      </div>
      <Field label="Item name">
        {(id) => (
          <input
            id={id}
            required
            minLength={3}
            maxLength={100}
            placeholder="Black satin dress"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
          />
        )}
      </Field>
      <div className="two-col">
        <fieldset className="tag-picker">
          <legend>Categories · optional</legend>
          <div className="tag-options">
            {categories.map((tag) => (
              <button
                type="button"
                key={tag}
                aria-pressed={(form.categories || []).includes(tag)}
                onClick={() =>
                  set(
                    "categories",
                    (form.categories || []).includes(tag)
                      ? form.categories.filter((value) => value !== tag)
                      : [...(form.categories || []), tag],
                  )
                }
              >
                {tag}
              </button>
            ))}
          </div>
          {(form.categories || []).includes("Custom") && (
            <Field label="Custom category">
              {(id) => (
                <input
                  id={id}
                  required
                  maxLength={40}
                  placeholder="Enter category…"
                  value={form.customCategory || ""}
                  onChange={(e) => set("customCategory", e.target.value)}
                />
              )}
            </Field>
          )}
        </fieldset>
        <Field label="Price per day ($)">
          {(id) => (
            <input
              id={id}
              type="number"
              inputMode="decimal"
              required
              min="0.01"
              max="1000"
              step="0.01"
              placeholder="15"
              value={form.price}
              onChange={(e) => set("price", e.target.value)}
            />
          )}
        </Field>
        <Field label="Condition">
          {(id) => (
            <select
              id={id}
              value={form.condition}
              onChange={(e) => set("condition", e.target.value)}
            >
              {["New", "Like New", "Good"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          )}
        </Field>
      </div>
      <SizeInput fields={sizing} onChange={setSizing} />
      {sizeError && (
        <p className="error" role="alert">
          {sizeError}
        </p>
      )}
      <Field label="Short description">
        {(id) => (
          <textarea
            id={id}
            required
            minLength={3}
            maxLength={3000}
            rows={3}
            placeholder="Fit, fabric, and any wear or damage."
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
          />
        )}
      </Field>
      <details className="optional-fields">
        <summary>Replacement value · optional</summary>
        <Field label="Estimated replacement value ($)">
          {(id) => (
            <input
              id={id}
              type="number"
              inputMode="decimal"
              min="0"
              max="10000"
              step="0.01"
              value={form.retailValue ?? ""}
              onChange={(e) => set("retailValue", e.target.value)}
            />
          )}
        </Field>
      </details>
      <label className="legal-check">
        <input
          type="checkbox"
          required
          checked={lenderConfirmed}
          onChange={(e) => setLenderConfirmed(e.target.checked)}
        />
        <span>{LENDER_CONFIRMATION}</span>
      </label>
      <p className="fine-print">
        No weapons or realistic weapon props, hazardous materials, stolen or
        counterfeit goods, or licensed items.{" "}
        <a href="/safety">Safety and prohibited items</a>
      </p>
      <p className="fine-print">
        Your listing is available as soon as you publish it.
      </p>
      <button
        className="button burgundy full"
        disabled={busy || uploading || !form.photos.length || !lenderConfirmed}
      >
        {uploading
          ? "Finishing photos…"
          : busy
            ? "Saving…"
            : item
              ? "Save changes"
              : "Publish listing"}
      </button>
    </form>
  );
}
export function ProfileForm({ user, onSubmit, onLogout, busy, onUpload }) {
  const [form, setForm] = useState({
    ...user,
    phone: displayPhone(user.phone),
  });
  const [uploading, setUploading] = useState(false);
  const set = (key, value) => setForm((old) => ({ ...old, [key]: value }));
  return (
    <form
      className="profile-form panel"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(form);
      }}
    >
      <h2>{user.phone ? "Your details" : "Complete your profile"}</h2>
      <p>
        Just your name and phone number to start. Your number is shared only
        with confirmed rental partners.
      </p>
      {user.rating && (
        <p>
          ★ {user.rating.toFixed(1)} · {user.ratingCount} rental reviews
        </p>
      )}
      <Field label="Georgia Tech email">
        {(id) => <input id={id} type="email" value={user.email} disabled />}
      </Field>
      <div className="two-col">
        <Field label="Full name">
          {(id) => (
            <input
              id={id}
              autoComplete="name"
              required
              minLength={2}
              maxLength={80}
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
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
              value={form.phone}
              maxLength={30}
              placeholder="(404) 555-1234"
              onBlur={() => set("phone", displayPhone(form.phone))}
              onChange={(e) => set("phone", e.target.value)}
            />
          )}
        </Field>
      </div>
      <details className="optional-fields">
        <summary>Optional profile details</summary>
        <div className="two-col">
          <Field label="Class year">
            {(id) => (
              <input
                id={id}
                type="number"
                min="2020"
                max="2040"
                value={form.classYear || ""}
                onChange={(e) => set("classYear", e.target.value)}
              />
            )}
          </Field>
        </div>
        <Field label="Payment information">
          {(id) => (
            <textarea
              id={id}
              rows={3}
              maxLength={500}
              aria-describedby="payment-help"
              placeholder="Cash at pickup, Venmo @username, Zelle, or PayPal"
              value={form.paymentInfo || ""}
              onChange={(e) => set("paymentInfo", e.target.value)}
            />
          )}
        </Field>
        <p id="payment-help">
          Tell renters how you'd like to be paid. For example: Venmo @username,
          Zelle, PayPal, or cash at pickup.
        </p>
        <div className="field">
          <span>Profile photo</span>
          <PhotoUpload
            max={1}
            value={form.profilePhotoUrl ? [form.profilePhotoUrl] : []}
            onChange={(photos) => set("profilePhotoUrl", photos[0] || "")}
            onBusyChange={(v) => {
              setUploading(v);
              onUpload(v);
            }}
          />
        </div>
      </details>
      <div className="form-actions">
        <button className="button burgundy" disabled={busy || uploading}>
          {busy ? "Saving…" : "Save profile"}
        </button>
        <button
          type="button"
          className="text-button"
          disabled={busy || uploading}
          onClick={onLogout}
        >
          Log out
        </button>
      </div>
    </form>
  );
}
export function RentalDates({ listing, onSubmit, busy, own }) {
  const [selection, setSelection] = useState({
    start: "",
    end: "",
    choosingEnd: false,
  });
  const [ranges, setRanges] = useState(listing.unavailableRanges || []);
  const [availabilityReady, setAvailabilityReady] = useState(false);
  const { start, end } = selection;
  const available = availabilityReady && rangeAvailable(start, end, ranges);
  const [acknowledged, setAcknowledged] = useState(false);
  const quote = rentalTotal(listing.price, start, end);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!available || !quote) return;
        onSubmit({
          listingId: listing.id,
          startDate: start,
          endDate: end,
          renterAcknowledged: acknowledged,
          termsVersion: TERMS_VERSION,
          replacementValue: listing.retailValue,
        });
      }}
    >
      <RentalCalendar
        listingId={listing.id}
        selection={selection}
        onChange={setSelection}
        ranges={ranges}
        onRanges={setRanges}
        onReady={setAvailabilityReady}
      />
      {!listing.isDemo && quote && (
        <div className="rental-quote">
          <span>
            {quote.days} day{quote.days === 1 ? "" : "s"} ×{" "}
            {money(listing.price)}
          </span>
          <strong>{money(quote.total)} total</strong>
        </div>
      )}
      {!listing.isDemo && (
        <label className="legal-check">
          <input
            type="checkbox"
            required
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
          />
          <span>{renterAcknowledgement(listing.retailValue)}</span>
        </label>
      )}
      <button
        disabled={
          listing.isDemo || busy || own || !quote || !acknowledged || !available
        }
        className="button burgundy full"
      >
        {listing.isDemo
          ? "Inspiration only — not for rent"
          : own
            ? "This is your listing"
            : busy
              ? "Sending…"
              : "Request rental"}
      </button>
      <p className="fine-print">
        {listing.isDemo ? (
          "Have something similar? List your own piece on Toga."
        ) : (
          <>
            Pickup and return days are included. No charge in Toga. Arrange
            payment with {listing.owner.name} using their preferred payment
            method.
          </>
        )}
      </p>
    </form>
  );
}
