const ROWS = [
  { title: 'Backfill settlement boundaries', meta: 'HBL-433 · ledger-core · $3.10' },
  { title: 'Pick the retry window for notify-relay', meta: 'HBL-437 · notify-relay · $1.40' },
  { title: 'Cascade the ledger rounding', meta: 'HBL-431 · ledger-core · $5.02' },
] as const satisfies ReadonlyArray<{ title: string; meta: string }>;

export const PhonePreview = () => (
  <div
    aria-hidden
    data-iphone-preview=""
    className="flex h-56 w-44 shrink-0 flex-col gap-3 overflow-hidden rounded-t-2xl border border-b-0 border-border bg-subtle p-3"
  >
    <div className="flex items-center justify-between text-chip text-muted-foreground">
      <span>Harborline</span>
      <span>4 running</span>
    </div>
    <span className="text-heading text-foreground">Work</span>
    <ul className="flex flex-col gap-2">
      {ROWS.map(({ title, meta }) => (
        <li key={title} className="flex flex-col">
          <span className="truncate text-chip text-foreground">{title}</span>
          <span className="truncate text-chip text-faint-foreground">{meta}</span>
        </li>
      ))}
    </ul>
  </div>
);
