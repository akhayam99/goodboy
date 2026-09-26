type Props = {
  readonly sections: ReadonlyArray<string>;
};

const sectionNumber = (index: number): string => String(index + 1).padStart(2, '0');

export const PrintContents = ({ sections }: Props) => (
  <nav className="print-contents" aria-label="Contents">
    <p className="print-contents-label">Contents</p>
    <ol className="print-contents-list">
      {sections.map((section, index) => (
        <li key={`${index}-${section}`}>
          <span className="print-contents-number">{sectionNumber(index)}</span>
          {section}
        </li>
      ))}
    </ol>
  </nav>
);
