const SECTIONS = ['Overview', 'Comments', 'Files', 'Commits', 'Checks'] as const;

export const DiffReviewRail = () => (
  <nav aria-hidden className="dfrRail">
    {SECTIONS.map((section) => (
      <p
        key={section}
        className="dfrRailRow"
        data-active={section === 'Files' ? 'true' : undefined}
      >
        {section}
      </p>
    ))}
  </nav>
);
