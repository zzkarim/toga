export default function LegalDocument({ title, version, children }) {
  return (
    <main className="legal-document">
      <a href="/" className="text-button">
        Back to Toga
      </a>
      <p className="draft-banner">DRAFT: pending attorney review.</p>
      <h1>{title}</h1>
      {version && <p>Version {version}</p>}
      {children}
    </main>
  );
}
