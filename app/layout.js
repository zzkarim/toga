import LegalFooter from "../components/legal-footer";
import { SeasonalProvider } from "../components/seasonal-decor";
import "./seasonal.css";
import "./globals.css";
import { DESCRIPTION } from "../lib/campus.mjs";
export const metadata = {
  metadataBase: new URL(process.env.APP_URL || "https://jointoga.com"),
  title: "Toga",
  description: DESCRIPTION,
  icons: { icon: "/logo.png", apple: "/logo.png" },
  robots: { index: true, follow: true },
  referrer: "no-referrer",
};
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className={
          process.env.TOGA_THEME === "classic"
            ? "theme-classic"
            : "theme-halloween"
        }
      >
        <SeasonalProvider enabled={process.env.TOGA_THEME !== "classic"}>
          {children}
          <LegalFooter />
        </SeasonalProvider>
      </body>
    </html>
  );
}
