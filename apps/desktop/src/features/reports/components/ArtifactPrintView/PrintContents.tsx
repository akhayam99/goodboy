type Props = {
  readonly sections: ReadonlyArray<string>;
};

export const PrintContents = ({ sections }: Props) => (
  <nav className="print-contents" aria-label="Contents">
    <p className="print-contents-label">Contents</p>
    <ol className="print-contents-list">
      {sections.map((section, index) => (
        <li key={`${index}-${section}`}>{section}</li>
      ))}
    </ol>
  </nav>
);
