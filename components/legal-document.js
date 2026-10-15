import { Children, cloneElement } from "react";
import { legalPublicationProblems } from "../lib/legal-config.mjs";
export default function LegalDocument({ title, version, children }) {
  const sections = Children.toArray(children).map((section, index) => ({
    section,
    id: section.props.id || `section-${index + 1}`,
    title: Children.toArray(section.props.children).find(
      (child) => child.type === "h2",
    )?.props.children,
  }));
  const draft = legalPublicationProblems().length > 0;
  return (
    <main className="legal-document">
      <a href="/" className="text-button">
        Back to Toga
      </a>
      {draft && (
        <p className="draft-banner">
          DRAFT — non-final pilot documents. Operator identification, governing
          jurisdiction, and legal review remain pending. No attorney approval is
          claimed.
        </p>
      )}
      <h1>{title}</h1>
      {version && <p>Version {version}</p>}
      <nav className="legal-toc" aria-label="On this page">
        {sections.map(({ id, title }) => (
          <a key={id} href={`#${id}`}>
            {title}
          </a>
        ))}
      </nav>
      {sections.map(({ section, id }) =>
        cloneElement(section, { id, key: id }),
      )}
    </main>
  );
}
