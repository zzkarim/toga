"use client";
import { useEffect, useState, useId } from "react";
import { campusToday } from "../lib/rules.mjs";
import { rangeAvailable, selectRentalDate } from "../lib/availability.mjs";
import { api } from "./ui";
const dayKey = (d) => d.toISOString().slice(0, 10);
export const dayLabel = (day) =>
  new Date(day + "T00:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
export default function RentalCalendar({
  listingId,
  selection,
  onChange,
  ranges,
  onRanges,
  onReady,
  title = "Choose your rental dates",
  hint = "Select one day for a one-day rental, or select a start and end date for multiple days.",
  footnote = "Crossed-out dates are unavailable. Pickup and return days are included.",
}) {
  const today = campusToday(),
    id = useId();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [hover, setHover] = useState("");
  const [loadError, setLoadError] = useState("");
  useEffect(() => {
    // Owner blocking passes local ranges only; renter calendars poll the server.
    if (!listingId) return;
    let active = true;
    const refresh = async () => {
      try {
        const data = await api(`listings/${listingId}/availability`);
        if (active) {
          onRanges(data.unavailableRanges);
          onReady(true);
          setLoadError("");
        }
      } catch {
        if (active) {
          onReady(false);
          setLoadError(
            "Availability could not refresh. Please reopen this listing or try again shortly.",
          );
        }
      }
    };
    refresh();
    const timer = setInterval(refresh, 15000);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [listingId, onRanges, onReady]);
  const first = new Date(month + "-01T00:00:00Z"),
    count = new Date(
      Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
    ).getUTCDate();
  const move = (delta) =>
    setMonth(
      dayKey(
        new Date(
          Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + delta, 1),
        ),
      ).slice(0, 7),
    );
  const previewEnd =
    selection.choosingEnd &&
    hover >= selection.start &&
    rangeAvailable(selection.start, hover, ranges) &&
    (+new Date(hover) - +new Date(selection.start)) / 86400000 <= 30
      ? hover
      : selection.end;
  const stale =
    selection.start && !rangeAvailable(selection.start, selection.end, ranges);
  return (
    <section className="rental-calendar" aria-labelledby={id}>
      <h3 id={id}>{title}</h3>
      <p className="fine-print">{hint}</p>
      <div className="calendar-month">
        <button
          type="button"
          aria-label="Previous month"
          disabled={month <= today.slice(0, 7)}
          onClick={() => move(-1)}
        >
          ‹
        </button>
        <strong aria-live="polite">
          {first.toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          })}
        </strong>
        <button type="button" aria-label="Next month" onClick={() => move(1)}>
          ›
        </button>
      </div>
      <div className="calendar-grid" onMouseLeave={() => setHover("")}>
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <span className="calendar-weekday" key={day}>
            {day}
          </span>
        ))}
        {Array.from({ length: first.getUTCDay() }, (_, i) => (
          <span aria-hidden="true" key={`blank-${i}`} />
        ))}
        {Array.from({ length: count }, (_, i) => {
          const day = `${month}-${String(i + 1).padStart(2, "0")}`,
            past = day < today,
            blocked = !rangeAvailable(day, day, ranges),
            selected =
              selection.start && day >= selection.start && day <= selection.end,
            preview =
              selection.start && day >= selection.start && day <= previewEnd,
            edge = day === selection.start || day === selection.end;
          return (
            <button
              key={day}
              type="button"
              disabled={past || blocked}
              aria-label={`${dayLabel(day)}${blocked ? ", unavailable" : past ? ", past" : ""}${selected ? ", selected" : ""}`}
              aria-pressed={!!selected}
              aria-current={day === today ? "date" : undefined}
              className={`calendar-day${selected ? " selected" : ""}${preview ? " preview" : ""}${edge ? " edge" : ""}${blocked ? " blocked" : ""}`}
              onMouseEnter={() => setHover(day)}
              onFocus={() => setHover(day)}
              onClick={() => {
                onChange(selectRentalDate(selection, day, ranges));
                setHover("");
              }}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      <p className="fine-print">{footnote}</p>
      <p className="calendar-selection" aria-live="polite">
        {selection.start
          ? `${dayLabel(selection.start)}${selection.end !== selection.start ? ` – ${dayLabel(selection.end)}` : " · 1 day"}. ${selection.choosingEnd ? "Ready for one day, or select a later end date." : "Select another day to start a new range."}`
          : "Choose an available day to start."}
      </p>
      {(loadError || selection.error || stale) && (
        <p role="alert" className="error">
          {loadError ||
            selection.error ||
            "Those dates are no longer available. Please choose different dates."}
        </p>
      )}
    </section>
  );
}
