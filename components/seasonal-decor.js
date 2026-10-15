// Decorative only: no state, timers, network assets, or interaction handlers.
export default function SeasonalDecor() {
  return (
    <div className="seasonal-decor" aria-hidden="true">
      <svg className="seasonal-moon" viewBox="0 0 100 100" focusable="false">
        <path
          d="M75 12A40 40 0 1 0 88 76 39 39 0 0 1 75 12Z"
          fill="currentColor"
        />
        <path d="m84 19 2 6 6 2-6 2-2 6-2-6-6-2 6-2Z" fill="currentColor" />
      </svg>
      <svg className="seasonal-bat" viewBox="0 0 120 50" focusable="false">
        <path
          d="M60 20 54 10 51 20C35 12 21 4 4 4c7 12 8 19 4 30 14-7 23-5 29 7 9-5 15-3 23 6 8-9 14-11 23-6 6-12 15-14 29-7-4-11-3-18 4-30-17 0-31 8-47 16l-3-10Z"
          fill="currentColor"
        />
      </svg>
      <svg className="seasonal-ghost" viewBox="0 0 60 75" focusable="false">
        <path
          d="M9 64V28C9 0 51 0 51 28v36l-10-6-11 8-11-8Z"
          fill="currentColor"
        />
        <ellipse cx="23" cy="29" rx="3" ry="5" fill="var(--background)" />
        <ellipse cx="38" cy="29" rx="3" ry="5" fill="var(--background)" />
      </svg>
      <svg
        className="seasonal-web"
        viewBox="0 0 100 100"
        focusable="false"
        fill="none"
        stroke="currentColor"
      >
        <path d="M0 0h100M0 0v100M0 0l70 70M0 0l93 38M0 0l38 93M0 25q10-1 10-15 4 2 15-10M0 50q19-3 19-31 15 0 31-19M0 75q29-5 29-46 25 0 46-29M0 100q40-8 38-62 33 0 62-38" />
      </svg>
    </div>
  );
}
