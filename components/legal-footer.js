import { CONTACT_EMAIL } from "../lib/legal-config.mjs";
export default function LegalFooter() {
  return (
    <footer className="legal-footer">
      <a className="footer-brand" href="/">
        Toga
      </a>
      <nav aria-label="Legal">
        <a href="/terms">Terms</a>
        <a href="/privacy">Privacy</a>
        <a href="/safety">Safety</a>
        <a href="/privacy#contact">Contact</a>
      </nav>
      <p>Toga is not affiliated with or endorsed by Georgia Tech.</p>
      <small>Contact: {CONTACT_EMAIL}</small>
    </footer>
  );
}
