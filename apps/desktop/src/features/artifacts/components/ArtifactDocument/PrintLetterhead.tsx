type Props = {
  readonly eyebrowLabel: string;
  readonly dateLabel: string;
  readonly title: string;
};

export const PrintLetterhead = ({ eyebrowLabel, dateLabel, title }: Props) => (
  <header className="print-letterhead">
    <div className="print-eyebrow">
      <span className="print-kind">{eyebrowLabel}</span>
      {dateLabel.length > 0 ? <span className="print-date">{dateLabel}</span> : null}
    </div>
    <h1 className="print-title">{title}</h1>
  </header>
);
