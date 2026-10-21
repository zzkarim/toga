"use client";
import {
  LENDER_CONFIRMATION,
  renterAcknowledgement,
  TERMS_VERSION,
} from "../lib/legal.mjs";
import RentalCalendar, { dayLabel } from "./rental-calendar";
import { rangeAvailable, blockedRanges } from "../lib/availability.mjs";
import { useState } from "react";
import { Field, PhotoUpload, money } from "./ui";
import { categories } from "../lib/rules.mjs";
import { rentalTotal } from "../lib/browse.mjs";
import SizeInput from "./size-input";
import { sizeFields, sizeValue } from "../lib/sizing.mjs";
import { displayPhone } from "../lib/profile.mjs";
const SUPPLY_EXAMPLES = [
  ["🎃", "Old Halloween costume"],
  ["🏈", "Jersey"],
  ["🧥", "Jacket or coat"],
  ["👗", "Dress / formalwear"],
  ["👔", "Blazer or interview clothes"],
  ["🤠", "Costume pieces / themed clothes"],
];
export function SupplyPrompt({ isNew, onList, onSkip }) {
  return (
    <div className="supply-prompt">
      <p>
        {isNew
          ? "Toga works better when everyone adds something. Have a Halloween costume, jacket, dress, jersey, blazer, or anything someone else might want to borrow? Put it on Toga and make some extra cash when someone rents it."
          : "Halloween is coming up. List a costume or something from your closet and make some extra cash if another student rents it."}
      </p>
      <h3>Not sure what to list?</h3>
      <ul className="supply-examples">
        {SUPPLY_EXAMPLES.map(([icon, text]) => (
          <li key={text}>
            <span aria-hidden="true">{icon}</span>
            {text}
          </li>
        ))}
      </ul>
      <p className="fine-print">
        It doesn’t have to be a full costume — clothes that could become part of
        someone’s costume are useful too.
      </p>
      <button className="button burgundy full" type="button" onClick={onList}>
        List something
      </button>
      <button className="text-button full" type="button" onClick={onSkip}>
        Skip for now
      </button>
    </div>
  );
}
// Owner-blocked days reuse the rental range picker; live rentals stay unselectable.
function BlockedDates({ value, rentalRanges = [], onChange }) {
  const [open, setOpen] = useState(value.length > 0);
  const [selection, setSelection] = useState({});
  return (
    <fieldset className="blocked-dates">
      <legend>Any dates you know you can’t rent it out?</legend>
      <p className="fine-print">
        Optional — block days when you’ll be using the item yourself.
      </p>
      {value.length > 0 && (
        <ul className="blocked-list">
          {value.map((r) => (
            <li key={r.start}>
              {dayLabel(r.start)}
              {r.end !== r.start && ` – ${dayLabel(r.end)}`}
              <button
                type="button"
                aria-label={`Remove unavailable dates starting ${dayLabel(r.start)}`}
                onClick={() => onChange(value.filter((x) => x !== r))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      {open ? (
        <>
          <RentalCalendar
            selection={selection}
            onChange={setSelection}
            ranges={[...rentalRanges, ...value]}
            title="Pick days to block"
            hint="Tap one day, or tap a start and end date."
            footnote="Crossed-out dates are already unavailable."
          />
          <button
            type="button"
            className="button outline full"
            disabled={!selection.start}
            onClick={() => {
              onChange(
                blockedRanges([
                  ...value,
                  { start: selection.start, end: selection.end },
                ]),
              );
              setSelection({});
            }}
          >
            Mark unavailable
          </button>
        </>
      ) : (
        <button
          type="button"
          className="button outline"
          onClick={() => setOpen(true)}
        >
          Add unavailable dates
        </button>
      )}
    </fieldset>
  );
}
export function ListingForm({ item, onSubmit, busy, onUpload, onCancel }) {
  const [form, setForm] = useState(() => ({
    title: "",
    description: "",
    categories: [],
    condition: "Good",
    retailValue: "",
    price: "",
    photos: [],
    ...item,
    blockedRanges: item?.blockedRanges || [],
  }));
  const [sizing, setSizing] = useState(() => sizeFields(item?.size || "M"));
  const [sizeError, setSizeError] = useState("");
  const [lenderConfirmed, setLenderConfirmed] = useState(false);
  const [uploading, setUploading] = useState(false);
  const set = (key, value) => setForm((old) => ({ ...old, [key]: value }));
  return (
    <form
      className="listing-form"
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
        <span>Add photos · at least one</span>
        <PhotoUpload
          value={form.photos}
          onChange={(photos) => set("photos", photos)}
          onBusyChange={(value) => {
            setUploading(value);
            onUpload(value);
          }}
        />
      </div>
      <div className="two-col">
        <Field label="What are you listing?">
          {(id) => (
            <input
              id={id}
              required
              minLength={3}
              maxLength={100}
              placeholder="Black blazer"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
            />
          )}
        </Field>
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
              placeholder="8"
              value={form.price}
              onChange={(e) => set("price", e.target.value)}
            />
          )}
        </Field>
      </div>
      <SizeInput fields={sizing} onChange={setSizing} />
      {sizeError && (
        <p className="error" role="alert">
          {sizeError}
        </p>
      )}
      <fieldset className="tag-picker">
        <legend>Categories · optional</legend>
        <div className="tag-options">
          {categories.map((tag) => (
            <button
              type="button"
              key={tag}
              aria-pressed={form.categories.includes(tag)}
              onClick={() =>
                set(
                  "categories",
                  form.categories.includes(tag)
                    ? form.categories.filter((value) => value !== tag)
                    : [...form.categories, tag],
                )
              }
            >
              {tag}
            </button>
          ))}
        </div>
        {form.categories.includes("Custom") && (
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
      <BlockedDates
        value={form.blockedRanges}
        rentalRanges={item?.rentalRanges}
        onChange={(ranges) => set("blockedRanges", ranges)}
      />
      <details className="optional-fields" open={Boolean(item?.description)}>
        <summary>More details · optional</summary>
        <Field label="Description">
          {(id) => (
            <textarea
              id={id}
              maxLength={3000}
              rows={3}
              placeholder="Anything renters should know? Fit, fabric, any wear."
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
          )}
        </Field>
        <div className="two-col">
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
          <Field label="Replacement value ($)">
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
        </div>
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
      {onCancel && (
        <button
          type="button"
          className="text-button full"
          disabled={busy}
          onClick={onCancel}
        >
          Back
        </button>
      )}
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
