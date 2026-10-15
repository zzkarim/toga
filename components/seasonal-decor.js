"use client";
import { createContext, useContext } from "react";
const SeasonalContext = createContext(false);
export function SeasonalProvider({ enabled, children }) {
  return (
    <SeasonalContext.Provider value={enabled}>
      {children}
    </SeasonalContext.Provider>
  );
}
function Glyph({ kind, className = "" }) {
  const paths = {
    moon: (
      <>
        <circle cx="40" cy="40" r="30" fill="currentColor" />
        <g fill="var(--background)" opacity=".15">
          <circle cx="30" cy="25" r="8" />
          <circle cx="48" cy="46" r="11" />
          <circle cx="23" cy="48" r="4" />
        </g>
      </>
    ),
    ghost: (
      <>
        <path
          d="M17 65V31C17 2 63 2 63 31v34l-11-7-12 9-12-9Z"
          fill="currentColor"
        />
        <g fill="var(--background)">
          <ellipse cx="31" cy="32" rx="3" ry="5" />
          <ellipse cx="49" cy="32" rx="3" ry="5" />
          <ellipse cx="40" cy="44" rx="4" ry="3" />
        </g>
      </>
    ),
    bat: (
      <path
        d="m40 32-4-8-3 8C24 23 11 19 1 20c6 9 7 16 3 26 10-6 17-4 22 5 5-4 9-2 14 5 5-7 9-9 14-5 5-9 12-11 22-5-4-10-3-17 3-26-10-1-23 3-32 12l-3-8Z"
        fill="currentColor"
      />
    ),
    web: (
      <g fill="none" stroke="currentColor">
        <path d="M0 0h80M0 0v80M0 0l56 56M0 0l75 30M0 0l30 75M0 20q8-1 8-12 4 2 12-8M0 40q15-2 15-25 12 0 25-15M0 60q23-4 23-37 20 0 37-23M0 80q32-6 30-50 27 0 50-30" />
      </g>
    ),
    spider: (
      <g stroke="currentColor" fill="none" strokeLinecap="round">
        <path d="M40 0v40M36 45l-9-7-5 9m14 2-12 1-4 7m24-12 9-7 5 9m-14 2 12 1 4 7" />
        <ellipse cx="40" cy="47" rx="6" ry="8" fill="currentColor" />
      </g>
    ),
    pumpkin: (
      <>
        <path
          d="M40 24q-4-13 9-17"
          fill="none"
          stroke="var(--gold)"
          strokeWidth="5"
        />
        <ellipse cx="40" cy="46" rx="31" ry="25" fill="currentColor" />
        <g fill="none" stroke="var(--background)" opacity=".3">
          <ellipse cx="40" cy="46" rx="16" ry="25" />
          <path d="M40 22v48" />
        </g>
        <g className="pumpkin-light" fill="var(--text)">
          <path d="m22 43 10-10 4 12m8 0 4-12 10 10M24 52q16 20 32 0l-9 5-7-3-7 3Z" />
        </g>
      </>
    ),
  };
  return (
    <svg
      className={`halloween-glyph halloween-${kind} ${className}`}
      viewBox="0 0 80 80"
      focusable="false"
    >
      {paths[kind]}
    </svg>
  );
}
// All motion is CSS. No timers, network assets, frame callbacks, or hidden classic markup.
export default function SeasonalDecor({ variant = "sky" }) {
  const enabled = useContext(SeasonalContext);
  if (!enabled) return null;
  return (
    <div className={`halloween-decor halloween-${variant}`} aria-hidden="true">
      {variant === "nav" ? (
        <>
          <Glyph kind="web" />
          <Glyph kind="pumpkin" />
        </>
      ) : (
        <>
          <Glyph kind="moon" />
          <Glyph kind="web" />
          <Glyph kind="spider" />
          <Glyph kind="bat" className="bat-one" />
          <Glyph kind="bat" className="bat-two" />
          <Glyph kind="bat" className="bat-three" />
          <Glyph kind="ghost" className="ghost-one" />
          <Glyph kind="ghost" className="ghost-two" />
          <Glyph kind="ghost" className="ghost-three" />
          <Glyph kind="pumpkin" />
          <span className="halloween-fog" />
        </>
      )}
    </div>
  );
}
