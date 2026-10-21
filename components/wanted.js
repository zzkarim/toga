"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import RentalCalendar from "./rental-calendar";
import { Field } from "./ui";
import { wantedDates } from "../lib/wanted.mjs";

const EXAMPLES = [
  "Mario costume",
  "Cowboy boots",
  "Jersey",
  "Black dress",
  "Leather jacket",
  "Overalls",
];
const ago = (value) => {
  const hours = (Date.now() - new Date(value)) / 3600000;
  if (hours < 1) return "Posted just now";
  if (hours < 24) return `Posted ${Math.floor(hours)}h ago`;
  const days = Math.floor(hours / 24);
  return `Posted ${days} day${days === 1 ? "" : "s"} ago`;
};

export function WantedForm({ onSubmit, busy }) {
  const [form, setForm] = useState({ title: "", details: "", size: "" });
  const [selection, setSelection] = useState({});
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  return (
    <form
      className="wanted-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!selection.start) return;
        onSubmit({
          ...form,
          startDate: selection.start,
          endDate: selection.end || selection.start,
        });
      }}
    >
      <Field label="What are you looking for?">
        {(id) => (
          <input
            id={id}
            required
            minLength={3}
            maxLength={80}
            placeholder="Mario onesie"
            value={form.title}
            onChange={set("title")}
          />
        )}
      </Field>
      <div className="two-col">
        <Field label="Details · optional">
          {(id) => (
            <input
              id={id}
              maxLength={300}
              placeholder="For Halloween, any color"
              value={form.details}
              onChange={set("details")}
            />
          )}
        </Field>
        <Field label="Size · optional">
          {(id) => (
            <input
              id={id}
              maxLength={30}
              placeholder="M/L"
              value={form.size}
              onChange={set("size")}
            />
          )}
        </Field>
      </div>
      <RentalCalendar
        selection={selection}
        onChange={setSelection}
        ranges={[]}
        title="When do you need it?"
        hint="Tap one day, or tap a start and end date."
        footnote="Your post disappears from Wanted after the last day."
      />
      <button
        className="button burgundy full"
        disabled={busy || !selection.start}
      >
        {busy ? "Posting…" : "Post request"}
      </button>
      <p className="fine-print">
        Other students see the item, details, size and dates. They never see
        your name or contact info.
      </p>
    </form>
  );
}

export function WantedView({ data, onPost, onHave, onStatus, onViewListing }) {
  const open = data.mine.filter((p) => p.status === "Open");
  const past = data.mine.filter((p) => p.status !== "Open");
  return (
    <>
      <div className="section-heading wanted-heading">
        <div>
          <div className="eyebrow">Wanted</div>
          <h1>What students are looking for</h1>
          <p className="wanted-intro">
            See what Georgia Tech students want to rent — or post something you
            need.
          </p>
        </div>
        <button className="button burgundy compact" onClick={onPost}>
          <Plus size={16} />
          Post what you need
        </button>
      </div>
      {data.mine.length > 0 && (
        <section className="wanted-mine" aria-label="Your Wanted posts">
          <h2>Your posts</h2>
          {[...open, ...past].map((post) => (
            <article className="wanted-card mine" key={post.id}>
              <div>
                <h3>{post.title}</h3>
                <p>
                  Needed {wantedDates(post)}
                  {post.size && ` · ${post.size}`}
                </p>
                <span className={`wanted-status ${post.status.toLowerCase()}`}>
                  {post.status === "Fulfilled" ? "Found" : post.status}
                </span>
                {post.responses.length > 0 && (
                  <ul className="wanted-responses">
                    {post.responses.map((l) => (
                      <li key={l.id}>
                        {l.isNew && <strong className="new-tag">New</strong>}
                        Someone listed {l.title}.{" "}
                        <button
                          className="text-button"
                          onClick={() => onViewListing(l.id)}
                        >
                          View listing
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {post.status === "Open" && (
                <div className="wanted-actions">
                  <button
                    className="text-button"
                    onClick={() => onStatus(post, "found")}
                  >
                    I found what I need
                  </button>
                  <button
                    className="text-button"
                    onClick={() => onStatus(post, "close")}
                  >
                    Remove
                  </button>
                </div>
              )}
            </article>
          ))}
        </section>
      )}
      <p className="results-meta">
        <span aria-live="polite">
          {data.posts.length} open request{data.posts.length === 1 ? "" : "s"}
        </span>
      </p>
      {data.posts.length ? (
        <div className="wanted-grid">
          {data.posts.map((post) => (
            <article className="wanted-card" key={post.id}>
              <div>
                <h3>{post.title}</h3>
                <p>
                  Needed {wantedDates(post)}
                  {post.size && ` · ${post.size}`}
                </p>
                {post.details && (
                  <p className="wanted-details">{post.details}</p>
                )}
                <p className="fine-print">
                  {ago(post.createdAt)}
                  {post.responseCount > 0 &&
                    ` · ${post.responseCount} listed so far`}
                </p>
              </div>
              <button
                className="button outline full"
                onClick={() => onHave(post)}
              >
                I have this
              </button>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <h2>Looking for something specific?</h2>
          <p>
            Post what you need for Halloween and someone on Toga might have it
            sitting in their closet.
          </p>
          <p className="fine-print">e.g. {EXAMPLES.join(" · ")}</p>
          <button className="button outline" onClick={onPost}>
            Post what you need
          </button>
        </div>
      )}
      <p className="wanted-footer fine-print">
        Have something someone wants? Tap “I have this” to list it. They still
        choose dates and request it like any other listing.
      </p>
    </>
  );
}
