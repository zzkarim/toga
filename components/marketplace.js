"use client";
import { needsAcceptance } from "../lib/legal.mjs";
import AuthForm from "../components/auth-form";
import { useEffect, useState } from "react";
import {
  Search,
  ArrowRight,
  Plus,
  X,
  Check,
  Heart,
  Star,
  Menu,
  Shirt,
  CalendarDays,
} from "lucide-react";
import { api, Field, Modal, PhotoUpload, money } from "../components/ui";
import { ListingForm, ProfileForm, RentalDates } from "../components/forms";
import { CAMPUS, DESCRIPTION, safeDestination } from "../lib/campus.mjs";
import { categories } from "../lib/rules.mjs";
import { filterListings, sizes } from "../lib/browse.mjs";
const date = (value) =>
  new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
export default function Home() {
  const [user, setUser] = useState(null),
    [view, setView] = useState("browse"),
    [listings, setListings] = useState([]),
    [mine, setMine] = useState([]),
    [rentals, setRentals] = useState([]),
    [activity, setActivity] = useState({ items: [], unreadCount: 0 }),
    [activityError, setActivityError] = useState(""),
    [admin, setAdmin] = useState(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [menu, setMenu] = useState(false);
  const [modal, setModal] = useState(null),
    [selected, setSelected] = useState(null),
    [photoIndex, setPhotoIndex] = useState(0),
    [photos, setPhotos] = useState([]),
    [score, setScore] = useState(5),
    [deferred, setDeferred] = useState(null);
  const [category, setCategory] = useState("All pieces"),
    [size, setSize] = useState("All sizes"),
    [maxPrice, setMaxPrice] = useState(""),
    [query, setQuery] = useState(""),
    [saved, setSaved] = useState([]),
    [rentalTab, setRentalTab] = useState("outgoing"),
    [adminTab, setAdminTab] = useState("listings");
  const [password, setPassword] = useState(""),
    [currentPassword, setCurrentPassword] = useState("");
  const [token, setToken] = useState(""),
    [destination, setDestination] = useState("/?view=browse");
  async function refresh() {
    const { user: me } = await api("me");
    if (me?.needsTermsAcceptance) {
      window.location.replace("/accept-terms");
      return;
    }
    setUser(me);
    if (!me) {
      setListings([]);
      setMine([]);
      setRentals([]);
      setActivity({ items: [], unreadCount: 0 });
      setAdmin(null);
      return;
    }
    const [a, b, c, d] = await Promise.all([
      api("listings"),
      api("listings?mine=true"),
      api("requests"),
      api("activity"),
    ]);
    setListings(a.listings);
    setMine(b.listings);
    setRentals(c.requests);
    setActivity(d);
    setActivityError("");
    if (me.role === "admin") setAdmin(await api("admin"));
  }
  useEffect(() => {
    const params = new URLSearchParams(location.search),
      next = safeDestination(params.get("next"));
    const updateView = () => {
      const requested = new URLSearchParams(location.search).get("view");
      setView(
        ["browse", "closet", "rentals", "profile", "admin", "saved"].includes(
          requested,
        )
          ? requested
          : "browse",
      );
    };
    updateView();
    if (params.get("token")) {
      setToken(params.get("token"));
      setDestination(next);
      setModal("verify");
      history.replaceState(null, "", "/");
    }
    try {
      const ids = JSON.parse(localStorage.getItem("toga-saved") || "[]");
      if (Array.isArray(ids)) setSaved(ids);
    } catch {}
    refresh()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    window.addEventListener("popstate", updateView);
    return () => window.removeEventListener("popstate", updateView);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!user?.id) return;
    let stopped = false,
      running = false;
    const poll = async () => {
      if (document.visibilityState === "hidden" || running) return;
      running = true;
      try {
        const [updates, latest] = await Promise.all([
          api("activity"),
          api("requests"),
        ]);
        if (!stopped) {
          setActivity(updates);
          setRentals(latest.requests);
          setActivityError("");
        }
      } catch {
        if (!stopped)
          setActivityError(
            "Rental updates could not refresh. Use Refresh to try again.",
          );
      } finally {
        running = false;
      }
    };
    const timer = setInterval(poll, 30000);
    window.addEventListener("focus", poll);
    document.addEventListener("visibilitychange", poll);
    return () => {
      stopped = true;
      clearInterval(timer);
      window.removeEventListener("focus", poll);
      document.removeEventListener("visibilitychange", poll);
    };
  }, [user?.id]);
  function navigate(next) {
    setView(next);
    setMenu(false);
    setError("");
    history.pushState(null, "", `/?view=${next}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function open(type, item = null) {
    setError("");
    setSelected(item);
    setModal(type);
    setPhotos([]);
    setPhotoIndex(0);
    setUploading(false);
    if (type === "rating")
      setScore(item.ratings.find((r) => r.raterId === user.id)?.score || 5);
  }
  function gate(type, item) {
    if (!user) {
      open("login");
      return;
    }
    if (!user.name || !user.phone) {
      setDeferred({ type, item });
      setModal(null);
      navigate("profile");
      setToast("Add your name and phone number to continue.");
      return;
    }
    open(type, item);
  }
  async function perform(fn, message, onSuccess) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await fn();
      setModal(null);
      setToast(message || "Saved.");
      try {
        await refresh();
      } catch {
        setError(
          "Your changes were saved, but the page could not refresh. Please reload.",
        );
      }
      onSuccess?.();
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  function toggleSaved(id) {
    const next = saved.includes(id)
      ? saved.filter((x) => x !== id)
      : [...saved, id];
    setSaved(next);
    try {
      localStorage.setItem("toga-saved", JSON.stringify(next));
    } catch {}
  }
  function resetFilters() {
    setCategory("All pieces");
    setSize("All sizes");
    setMaxPrice("");
    setQuery("");
  }
  const visible = filterListings(listings, {
    category,
    size,
    maxPrice,
    query,
    saved: view === "saved" ? saved : null,
  });
  const incoming = rentals.filter((r) => r.lenderId === user?.id),
    outgoing = rentals.filter((r) => r.renterId === user?.id);
  const shownRentals = (
    rentalTab === "incoming" ? incoming : outgoing
  ).toSorted(
    (a, b) =>
      (a.status === "Pending" ? -1 : 0) - (b.status === "Pending" ? -1 : 0) ||
      +new Date(b.createdAt) - +new Date(a.createdAt),
  );
  const incomingCount = incoming.filter((r) => r.status === "Pending").length;
  const protectedBusy = busy || uploading;
  return (
    <>
      <header className={`header ${!user ? "landing-header" : ""}`}>
        <button
          className="brand"
          onClick={() => navigate("browse")}
          aria-label="Toga home"
        >
          <img src="/logo.png" alt="" />
          <span>Toga</span>
        </button>
        {user && (
          <>
            <nav
              className={menu ? "nav is-open" : "nav"}
              aria-label="Main navigation"
            >
              {[
                ["browse", "Browse"],
                ["closet", "My listings"],
                ["rentals", "My Rentals"],
                ["profile", "Account"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  className={view === key ? "active" : ""}
                  onClick={() => navigate(key)}
                >
                  {label}
                  {key === "rentals" && activity.unreadCount > 0 && (
                    <span
                      className="count"
                      aria-label={`${activity.unreadCount} unread rental updates`}
                    >
                      {activity.unreadCount}
                    </span>
                  )}
                </button>
              ))}
            </nav>
            <div className="header-actions">
              <button
                className="icon-button"
                aria-label="Saved listings"
                onClick={() => navigate("saved")}
              >
                <Heart size={20} />
              </button>
              <button
                className="button burgundy compact"
                onClick={() => gate("listing")}
              >
                <Plus size={16} />
                List an item
              </button>
              <button
                className="mobile-menu icon-button"
                aria-label="Toggle navigation"
                aria-expanded={menu}
                onClick={() => setMenu(!menu)}
              >
                <Menu />
              </button>
            </div>
          </>
        )}
      </header>
      {!user ? (
        <main className="landing">
          <div className="landing-mark">
            <img src="/logo.png" alt="Toga" />
          </div>
          <h1>{DESCRIPTION}</h1>
          <p>For Georgia Tech students.</p>
          <button
            className="button burgundy"
            disabled={loading}
            onClick={() => open("login")}
          >
            {loading ? "Loading…" : "Sign up / log in"}
            <ArrowRight size={17} />
          </button>
          {error && !modal && (
            <p className="error" role="alert">
              {error}
              <button className="text-button" onClick={() => location.reload()}>
                Retry
              </button>
            </p>
          )}
        </main>
      ) : (
        <main
          className={
            view === "browse" || view === "saved" ? "marketplace" : "dashboard"
          }
        >
          {error && !modal && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {["browse", "saved"].includes(view) ? (
            <>
              <div className="section-heading">
                <div>
                  <div className="eyebrow">{CAMPUS}</div>
                  <h1>
                    {view === "saved" ? "Saved listings" : "Browse the closet"}
                  </h1>
                </div>
                <button className="text-button" onClick={() => open("how")}>
                  How rentals work
                </button>
              </div>
              <div className="browse-controls">
                <div className="search-box">
                  <Search size={18} />
                  <input
                    aria-label="Search listings"
                    placeholder="Search clothing"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  {query && (
                    <button
                      className="icon-button"
                      aria-label="Clear search"
                      onClick={() => setQuery("")}
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>
                <label className="filter-control">
                  <span>Size</span>
                  <select
                    aria-label="Filter by size"
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                  >
                    {["All sizes", ...sizes].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label className="filter-control">
                  <span>Max $ / day</span>
                  <input
                    aria-label="Maximum price per day"
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    placeholder="Any"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                  />
                </label>
              </div>
              <div className="category-row" aria-label="Categories">
                {["All pieces", ...categories].map((c) => (
                  <button
                    key={c}
                    aria-pressed={category === c}
                    className={category === c ? "selected" : ""}
                    onClick={() => setCategory(c)}
                  >
                    {c === "Interview/Professional" ? "Interview & work" : c}
                  </button>
                ))}
              </div>
              <div className="results-meta">
                <span aria-live="polite">
                  {visible.length} listing{visible.length === 1 ? "" : "s"}
                </span>
                {(query ||
                  category !== "All pieces" ||
                  size !== "All sizes" ||
                  maxPrice !== "") && (
                  <button className="text-button" onClick={resetFilters}>
                    Clear filters
                  </button>
                )}
              </div>
              <div className="listing-grid">
                {visible.map((item) => (
                  <article className="listing-card" key={item.id}>
                    <div className="listing-image">
                      <button
                        className="listing-photo-button"
                        onClick={() => open("detail", item)}
                        aria-label={`View ${item.title}`}
                      >
                        <img
                          src={item.photos[0]}
                          alt={item.title}
                          loading="lazy"
                        />
                      </button>
                      <span className="size-tag">{item.size}</span>
                      <button
                        className={`save-button ${saved.includes(item.id) ? "is-saved" : ""}`}
                        aria-label={`${saved.includes(item.id) ? "Unsave" : "Save"} ${item.title}`}
                        aria-pressed={saved.includes(item.id)}
                        onClick={() => toggleSaved(item.id)}
                      >
                        <Heart
                          size={18}
                          fill={
                            saved.includes(item.id) ? "currentColor" : "none"
                          }
                        />
                      </button>
                    </div>
                    <div className="listing-info">
                      <span className="item-category">
                        {item.category} · {item.condition}
                      </span>
                      <button
                        className="item-title"
                        onClick={() => open("detail", item)}
                      >
                        {item.title}
                      </button>
                      <div className="item-bottom">
                        <span>
                          <strong>{money(item.price)}</strong>
                          <small> / day</small>
                        </span>
                        <span className="lender">
                          {item.owner.name.split(" ")[0]}
                          {item.rating && <> · ★ {item.rating.toFixed(1)}</>}
                        </span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
              {!visible.length && (
                <div className="empty-state">
                  <Shirt size={30} />
                  <h2>
                    {listings.length
                      ? "No matching listings"
                      : "The closet is just getting started"}
                  </h2>
                  <p>
                    {view === "saved"
                      ? "Save listings with the heart button to find them here."
                      : listings.length
                        ? "Try clearing your filters."
                        : "Be the first to share something from your closet."}
                  </p>
                  <button
                    className="button outline"
                    onClick={() =>
                      listings.length ? resetFilters() : gate("listing")
                    }
                  >
                    {listings.length ? "Clear filters" : "List an item"}
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="section-heading">
                <h1>
                  {{
                    closet: "My listings",
                    rentals: "Rental requests",
                    profile: "My account",
                    admin: "Admin",
                  }[view] || "Your account"}
                </h1>
                {user.role === "admin" && view !== "admin" && (
                  <button
                    className="text-button"
                    onClick={() => navigate("admin")}
                  >
                    Admin dashboard
                  </button>
                )}
              </div>
              {view === "profile" && (
                <>
                  <button
                    className="button outline"
                    onClick={() => {
                      setPassword("");
                      setCurrentPassword("");
                      open("password");
                    }}
                  >
                    Set or change password
                  </button>
                  <ProfileForm
                    key={user.id}
                    user={user}
                    busy={busy}
                    onUpload={setUploading}
                    onSubmit={(form) =>
                      perform(
                        () => api("me", "PATCH", form),
                        "Profile saved.",
                        () => {
                          if (deferred) {
                            const next = deferred;
                            setDeferred(null);
                            open(next.type, next.item);
                          } else if (!user.phone) navigate("browse");
                        },
                      )
                    }
                    onLogout={() =>
                      perform(
                        () => api("auth/logout", "POST", {}),
                        "You’re logged out.",
                        () => navigate("browse"),
                      )
                    }
                  />
                </>
              )}
              {view === "closet" && (
                <>
                  <div className="dashboard-intro">
                    <p>
                      {mine.length} listing{mine.length === 1 ? "" : "s"}
                    </p>
                    <button
                      className="button burgundy"
                      onClick={() => gate("listing")}
                    >
                      <Plus size={16} />
                      List an item
                    </button>
                  </div>
                  {mine.map((item) => (
                    <article className="rental-card" key={item.id}>
                      <img
                        className="rental-thumb"
                        src={item.photos[0]}
                        alt={item.title}
                      />
                      <div className="rental-body">
                        <span className="status">
                          {item.status === "Active" ? "Available" : item.status}
                        </span>
                        <h2>{item.title}</h2>
                        <p>
                          {money(item.price)} / day · {item.size}
                        </p>
                      </div>
                      {["Active", "Draft"].includes(item.status) ? (
                        <div className="rental-actions">
                          <button
                            className="button outline"
                            onClick={() => open("listing", item)}
                          >
                            Edit
                          </button>
                          <button
                            className="text-button"
                            onClick={() => open("delete", item)}
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <button
                          className="button outline"
                          onClick={() => {
                            setRentalTab("incoming");
                            navigate("rentals");
                          }}
                        >
                          View requests
                        </button>
                      )}
                    </article>
                  ))}
                  {!mine.length && (
                    <div className="empty-state">
                      <Shirt />
                      <h2>No listings yet</h2>
                      <p>
                        Add a photo and a few details to publish your first
                        item.
                      </p>
                    </div>
                  )}
                </>
              )}
              {view === "rentals" && (
                <>
                  {activityError && (
                    <p role="status" className="error">
                      {activityError}
                    </p>
                  )}
                  {activity.unreadCount > 0 && (
                    <section
                      className="rental-updates panel"
                      aria-label="New rental updates"
                    >
                      <h2>
                        {activity.unreadCount} new rental update
                        {activity.unreadCount === 1 ? "" : "s"}
                      </h2>
                      <p>
                        New requests and status changes appear here, even if an
                        email is missed.
                      </p>
                      <ul>
                        {activity.items.map((item) => (
                          <li key={item.id}>{item.message}</li>
                        ))}
                      </ul>
                      <button
                        className="button outline"
                        disabled={busy}
                        onClick={() =>
                          perform(
                            () =>
                              api("activity/read", "POST", {
                                ids: activity.items.map((item) => item.id),
                              }),
                            "Updates marked as read.",
                          )
                        }
                      >
                        Mark these updates as read
                      </button>
                    </section>
                  )}
                  <div
                    className="dashboard-tabs"
                    aria-label="Rental request direction"
                  >
                    <button
                      aria-pressed={rentalTab === "outgoing"}
                      className={rentalTab === "outgoing" ? "selected" : ""}
                      onClick={() => setRentalTab("outgoing")}
                    >
                      Sent <span>{outgoing.length}</span>
                    </button>
                    <button
                      aria-pressed={rentalTab === "incoming"}
                      className={rentalTab === "incoming" ? "selected" : ""}
                      onClick={() => setRentalTab("incoming")}
                    >
                      Received <span>{incoming.length}</span>
                      {incomingCount > 0 &&
                        ` · ${incomingCount} awaiting reply`}
                    </button>
                    <button
                      disabled={busy}
                      onClick={() =>
                        perform(() => Promise.resolve(), "Requests refreshed.")
                      }
                    >
                      Refresh
                    </button>
                  </div>
                  {shownRentals.map((r) => (
                    <article className="rental-card" key={r.id}>
                      <img
                        className="rental-thumb"
                        src={r.listing.photos[0]}
                        alt={r.listing.title}
                      />
                      <div className="rental-body">
                        <span className="status">{r.status}</span>
                        <h2>{r.listing.title}</h2>
                        <p>
                          {date(r.startDate)} – {date(r.endDate)} ·{" "}
                          {r.partner.name}
                        </p>
                        <p>{money(r.pricePerDay)} / day</p>
                        {(r.partner.phone || r.partner.paymentInfo) && (
                          <div className="contact-details">
                            {r.partner.phone && (
                              <a href={`tel:${r.partner.phone}`}>
                                {r.partner.name} · {r.partner.phone}
                              </a>
                            )}
                            <small>
                              Coordinate pickup and payment with your rental
                              partner.
                            </small>
                            {r.partner.paymentInfo && (
                              <div className="payment-info">
                                <strong>Payment information</strong>
                                <div>{r.partner.paymentInfo}</div>
                              </div>
                            )}
                          </div>
                        )}
                        {r.status === "Pending" && (
                          <p className="request-hint">
                            {r.lenderId === user.id
                              ? "Accept or decline within 48 hours."
                              : "Waiting for a response. Expires after 48 hours."}
                          </p>
                        )}
                        <p className="safety-tip">
                          Meet in public campus spaces. Photograph condition at
                          pickup and return. <a href="/safety">Safety tips</a>
                        </p>
                        <div className="rental-links">
                          {["Confirmed", "Active Rental", "Completed"].includes(
                            r.status,
                          ) && (
                            <button
                              className="text-button"
                              onClick={() => open("condition", r)}
                            >
                              Condition photos ({r.checks.length})
                            </button>
                          )}
                          {r.status === "Completed" && (
                            <>
                              <button
                                className="text-button"
                                onClick={() => open("rating", r)}
                              >
                                {r.ratings.some((x) => x.raterId === user.id)
                                  ? "Edit rating"
                                  : "Rate rental"}
                              </button>
                              <button
                                className="text-button"
                                onClick={() => open("report", r)}
                              >
                                Report a problem
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="rental-actions">
                        {r.status === "Pending" &&
                          (r.lenderId === user.id ? (
                            <>
                              <button
                                disabled={busy}
                                className="button burgundy"
                                onClick={() =>
                                  perform(
                                    () =>
                                      api(
                                        `requests/${r.id}/accept`,
                                        "POST",
                                        {},
                                      ),
                                    "Request accepted. Contact your rental partner to arrange pickup.",
                                  )
                                }
                              >
                                Accept
                              </button>
                              <button
                                disabled={busy}
                                className="button outline"
                                onClick={() =>
                                  perform(
                                    () =>
                                      api(
                                        `requests/${r.id}/decline`,
                                        "POST",
                                        {},
                                      ),
                                    "Request declined.",
                                  )
                                }
                              >
                                Decline
                              </button>
                            </>
                          ) : (
                            <button
                              disabled={busy}
                              className="button outline"
                              onClick={() =>
                                perform(
                                  () =>
                                    api(`requests/${r.id}/cancel`, "POST", {}),
                                  "Request cancelled.",
                                )
                              }
                            >
                              Cancel request
                            </button>
                          ))}
                        {r.renterId === user.id && r.status === "Confirmed" && (
                          <button
                            className="button burgundy"
                            onClick={() => open("pickup", r)}
                          >
                            Mark picked up
                          </button>
                        )}
                        {r.renterId === user.id &&
                          r.status === "Active Rental" && (
                            <button
                              className="button burgundy"
                              onClick={() => open("return", r)}
                            >
                              Mark returned
                            </button>
                          )}
                      </div>
                    </article>
                  ))}
                  {!shownRentals.length && (
                    <div className="empty-state">
                      <CalendarDays />
                      <h2>
                        {rentalTab === "incoming"
                          ? "No incoming requests"
                          : "No requests sent yet"}
                      </h2>
                      <p>
                        {rentalTab === "incoming"
                          ? "Requests for your listings will appear here."
                          : "Browse the closet and request your dates."}
                      </p>
                      <button
                        className="button outline"
                        onClick={() =>
                          navigate(
                            rentalTab === "incoming" ? "closet" : "browse",
                          )
                        }
                      >
                        {rentalTab === "incoming"
                          ? "My listings"
                          : "Browse listings"}
                      </button>
                    </div>
                  )}
                </>
              )}
              {view === "admin" &&
                (user.role === "admin" && admin ? (
                  <>
                    <div className="admin-tabs">
                      {[
                        "users",
                        "listings",
                        "requests",
                        "reports",
                        "emails",
                      ].map((t) => (
                        <button
                          className={adminTab === t ? "selected" : ""}
                          key={t}
                          onClick={() => setAdminTab(t)}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                    <div
                      className="table-wrap"
                      role="region"
                      aria-label="Admin records"
                      tabIndex={0}
                    >
                      <table>
                        <thead>
                          <tr>
                            {(adminTab === "users"
                              ? [
                                  "Name",
                                  "Email",
                                  "Phone",
                                  "Role",
                                  "Terms status",
                                  "Terms version",
                                  "Accepted at",
                                ]
                              : adminTab === "listings"
                                ? [
                                    "Item",
                                    "Owner",
                                    "Status",
                                    "Replacement value",
                                  ]
                                : adminTab === "requests"
                                  ? [
                                      "ID",
                                      "Item",
                                      "Status",
                                      "Renter",
                                      "Dates",
                                      "Renter acknowledgement",
                                    ]
                                  : adminTab === "reports"
                                    ? ["Rental", "Reporter", "Problem", "Photo"]
                                    : ["To", "Subject", "Delivery"]
                            ).map((h) => (
                              <th key={h}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(admin[adminTab] || []).map((row) => (
                            <tr key={row.id}>
                              {(adminTab === "users"
                                ? [
                                    row.name,
                                    row.email,
                                    row.phone,
                                    row.role,
                                    row.termsAcceptedAt
                                      ? needsAcceptance(row)
                                        ? "Update required"
                                        : "Current"
                                      : "Not accepted",
                                    row.termsVersion || "—",
                                    row.termsAcceptedAt
                                      ? new Date(
                                          row.termsAcceptedAt,
                                        ).toISOString()
                                      : "—",
                                  ]
                                : adminTab === "listings"
                                  ? [
                                      row.title,
                                      row.ownerId,
                                      row.status,
                                      row.retailValue
                                        ? money(row.retailValue)
                                        : "Not provided",
                                    ]
                                  : adminTab === "requests"
                                    ? [
                                        row.id,
                                        row.listingId,
                                        row.status,
                                        row.renterId,
                                        `${date(row.startDate)} – ${date(row.endDate)}`,
                                        row.renterAcknowledgedAt
                                          ? `${row.renterAcknowledgedTermsVersion} · ${new Date(row.renterAcknowledgedAt).toISOString()} · ${row.renterAcknowledgedReplacementValue == null ? "Amount not recorded" : money(row.renterAcknowledgedReplacementValue)}`
                                          : "Not recorded",
                                      ]
                                    : adminTab === "reports"
                                      ? [
                                          row.requestId,
                                          row.reporterId,
                                          row.description,
                                          row.photoUrl ? (
                                            <a
                                              href={row.photoUrl}
                                              target="_blank"
                                              rel="noreferrer"
                                            >
                                              View photo
                                            </a>
                                          ) : (
                                            "—"
                                          ),
                                        ]
                                      : [
                                          row.to,
                                          row.subject,
                                          row.sentAt
                                            ? "Accepted by the email provider"
                                            : row.error || row.deliveryStatus,
                                        ]
                              ).map((value, i) => (
                                <td key={i}>{value}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <p className="error">Admin access required.</p>
                ))}
            </>
          )}
        </main>
      )}
      {user && (
        <div className="how-footer">
          <span>Toga</span>
          <span>Georgia Tech</span>
          <button onClick={() => open("how")}>How rentals work</button>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
        </div>
      )}
      {modal && (
        <Modal
          title={
            {
              login: "Welcome to Toga",
              password: "Set your password",
              verify: "Sign in to Toga",
              detail: selected?.title,
              listing: selected ? "Edit listing" : "List an item",
              how: "How rentals work",
              delete: "Remove listing?",
              rating: "Rate your rental",
              report: "Report a problem",
              condition: "Condition photos",
              pickup: "Confirm pickup",
              return: "Confirm return",
            }[modal]
          }
          busy={protectedBusy}
          onClose={() => {
            if (!protectedBusy) setModal(null);
          }}
          wide={modal === "detail"}
        >
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {modal === "login" && (
            <AuthForm
              onBusy={setBusy}
              onSuccess={async (data) => {
                await refresh();
                setModal(null);
                navigate(
                  new URL(data.next, location.origin).searchParams.get(
                    "view",
                  ) || "browse",
                );
              }}
            />
          )}
          {modal === "password" && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError("");
                try {
                  await api("auth/password", "POST", {
                    password,
                    currentPassword,
                  });
                  setPassword("");
                  setCurrentPassword("");
                  await refresh();
                  setModal(null);
                  setToast(
                    "Password saved. Next time, log in without an email link.",
                  );
                } catch (e) {
                  setError(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <p>
                Use at least 12 characters. After saving, you can log in with
                your password. Other sessions will be signed out.
              </p>
              {user?.hasPassword && (
                <Field label="Current password (not needed after email verification)">
                  {(id) => (
                    <input
                      id={id}
                      type="password"
                      autoComplete="current-password"
                      maxLength={128}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                    />
                  )}
                </Field>
              )}
              <Field label="New password">
                {(id) => (
                  <input
                    id={id}
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={12}
                    maxLength={128}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                )}
              </Field>
              <button className="button burgundy full" disabled={busy}>
                {busy ? "Saving…" : "Save password"}
              </button>
              <button
                type="button"
                className="text-button"
                disabled={busy}
                onClick={() => {
                  setPassword("");
                  setCurrentPassword("");
                  setModal(null);
                }}
              >
                Do this later
              </button>
            </form>
          )}
          {modal === "verify" && (
            <>
              <p>
                Continue to securely sign in. This link can only be used once.
              </p>
              <button
                className="button burgundy full"
                disabled={busy || !token}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    const data = await api("auth/verify", "POST", {
                      token,
                      next: destination,
                    });
                    setToken("");
                    setPassword("");
                    setCurrentPassword("");
                    setModal("password");
                    await refresh();
                    navigate(
                      new URL(data.next, location.origin).searchParams.get(
                        "view",
                      ) || "browse",
                    );
                  } catch (e) {
                    setError(e.message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? "Signing in…" : "Continue to Toga"}
              </button>
              <button className="text-button" onClick={() => open("login")}>
                Request a new link
              </button>
            </>
          )}
          {modal === "listing" && (
            <ListingForm
              item={selected}
              busy={busy}
              onUpload={setUploading}
              onSubmit={(data) =>
                perform(
                  () =>
                    api(
                      selected ? `listings/${selected.id}` : "listings",
                      selected ? "PATCH" : "POST",
                      data,
                    ),
                  "Listing saved.",
                  () => navigate("closet"),
                )
              }
            />
          )}
          {modal === "detail" && (
            <div className="detail-layout">
              <div>
                <img
                  className="detail-photo"
                  src={selected.photos[photoIndex]}
                  alt={selected.title}
                />
                <div className="detail-thumbs">
                  {selected.photos.length > 1 &&
                    selected.photos.map((p, i) => (
                      <button
                        key={p}
                        onClick={() => setPhotoIndex(i)}
                        aria-label={`View photo ${i + 1}`}
                        aria-pressed={photoIndex === i}
                      >
                        <img src={p} alt="" />
                      </button>
                    ))}
                </div>
              </div>
              <div>
                <div className="eyebrow">{selected.category}</div>
                <div className="detail-price">
                  {money(selected.price)}
                  <span> / day</span>
                </div>
                <div className="detail-tags">
                  <span>Size {selected.size}</span>
                  <span>{selected.condition}</span>
                </div>
                <p>{selected.description}</p>
                <div className="owner-card">
                  <div>
                    <strong>{selected.owner.name}</strong>
                    <small>
                      {selected.rating
                        ? `★ ${selected.rating.toFixed(1)} · ${selected.ratingCount} reviews`
                        : "No ratings yet"}
                      {selected.owner.classYear &&
                        ` · Class of ${selected.owner.classYear}`}
                    </small>
                  </div>
                </div>
                <RentalDates
                  listing={selected}
                  busy={busy}
                  own={selected.ownerId === user?.id}
                  onSubmit={(data) => {
                    if (!user.phone || !user.name) {
                      setDeferred({ type: "detail", item: selected });
                      setModal(null);
                      navigate("profile");
                      setToast(
                        "Complete your profile, then choose your dates.",
                      );
                      return;
                    }
                    perform(
                      () => api("requests", "POST", data),
                      "Request sent. The lender has 48 hours to respond.",
                      () => {
                        setRentalTab("outgoing");
                        navigate("rentals");
                      },
                    );
                  }}
                />
              </div>
            </div>
          )}
          {modal === "how" && (
            <ol className="simple-steps">
              <li>Choose an item and request pickup and return dates.</li>
              <li>The lender has 48 hours to accept or decline.</li>
              <li>
                Once accepted, use the shared phone numbers to arrange pickup
                and payment through Venmo or cash.
              </li>
              <li>
                Mark the item picked up, then returned. Add condition photos and
                a rating if you’d like.
              </li>
            </ol>
          )}
          {modal === "delete" && (
            <>
              <p>
                Remove “{selected.title}” from the closet? Past rental records
                will be kept.
              </p>
              <button
                disabled={busy}
                className="button burgundy full"
                onClick={() =>
                  perform(
                    () => api(`listings/${selected.id}`, "DELETE"),
                    "Listing removed.",
                  )
                }
              >
                Remove listing
              </button>
            </>
          )}
          {["pickup", "return", "condition"].includes(modal) && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const stage =
                  modal === "return"
                    ? "Return"
                    : modal === "pickup"
                      ? "Pickup"
                      : new FormData(e.target).get("stage");
                perform(
                  async () => {
                    if (photos[0])
                      await api(`requests/${selected.id}/condition`, "POST", {
                        stage,
                        photoUrl: photos[0],
                      });
                    if (modal !== "condition")
                      await api(`requests/${selected.id}/${modal}`, "POST", {});
                  },
                  modal === "condition"
                    ? "Photo saved."
                    : modal === "return"
                      ? "Return confirmed. The item is available again."
                      : "Pickup confirmed.",
                );
              }}
            >
              {modal === "condition" && selected.checks.length > 0 && (
                <div className="condition-gallery">
                  {selected.checks.map((check) => (
                    <a
                      key={check.id}
                      href={check.photoUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <img
                        src={check.photoUrl}
                        alt={`${check.stage} condition`}
                      />
                      <span>
                        {check.stage} ·{" "}
                        {check.userId === user.id
                          ? "You"
                          : "Your rental partner"}
                      </span>
                    </a>
                  ))}
                </div>
              )}
              <p>
                {modal === "condition"
                  ? "Add a photo of the item’s condition."
                  : "Add an optional condition photo before confirming."}
              </p>
              {modal === "condition" && (
                <Field label="Stage">
                  {(id) => (
                    <select id={id} name="stage">
                      <option>Pickup</option>
                      <option>Return</option>
                    </select>
                  )}
                </Field>
              )}
              <PhotoUpload
                max={1}
                value={photos}
                onChange={setPhotos}
                onBusyChange={setUploading}
              />
              <button
                className="button burgundy full"
                disabled={
                  protectedBusy || (modal === "condition" && !photos.length)
                }
              >
                {modal === "condition"
                  ? "Save photo"
                  : modal === "return"
                    ? "Confirm returned"
                    : "Confirm picked up"}
              </button>
            </form>
          )}
          {modal === "rating" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                perform(
                  () =>
                    api(`requests/${selected.id}/rating`, "POST", {
                      score,
                      comment: new FormData(e.target).get("comment"),
                    }),
                  "Rating saved.",
                );
              }}
            >
              <div className="rating-stars" role="group" aria-label="Rating">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-label={`${n} stars`}
                    aria-pressed={score === n}
                    onClick={() => setScore(n)}
                  >
                    <Star
                      size={30}
                      fill={n <= score ? "currentColor" : "none"}
                    />
                  </button>
                ))}
              </div>
              <Field label="Comment · optional">
                {(id) => (
                  <textarea
                    id={id}
                    name="comment"
                    maxLength={1000}
                    rows={3}
                    defaultValue={
                      selected.ratings.find((r) => r.raterId === user.id)
                        ?.comment || ""
                    }
                  />
                )}
              </Field>
              <button className="button burgundy full" disabled={busy}>
                Save rating
              </button>
            </form>
          )}
          {modal === "report" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                perform(
                  () =>
                    api(`requests/${selected.id}/report`, "POST", {
                      description: new FormData(e.target).get("description"),
                      photoUrl: photos[0],
                    }),
                  "Report submitted to the Toga team.",
                );
              }}
            >
              <p>
                Your report goes to the Toga team for manual review. Toga
                provides good-faith mediation only and does not guarantee
                outcomes. Include photos that help explain the problem.
              </p>
              <Field label="What happened?">
                {(id) => (
                  <textarea
                    id={id}
                    name="description"
                    required
                    minLength={5}
                    maxLength={3000}
                    rows={4}
                  />
                )}
              </Field>
              <div className="field">
                <span>Photo · optional</span>
                <PhotoUpload
                  max={1}
                  value={photos}
                  onChange={setPhotos}
                  onBusyChange={setUploading}
                />
              </div>
              <button className="button burgundy full" disabled={protectedBusy}>
                Submit report
              </button>
            </form>
          )}
        </Modal>
      )}
    </>
  );
}
