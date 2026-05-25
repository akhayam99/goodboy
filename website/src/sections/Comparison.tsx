type Cell = boolean | 'partial' | string;
type Row = { label: string; goodboy: Cell; cursor: Cell; claudeCode: Cell; chatgpt: Cell };

const rows: Row[] = [
  {
    label: 'Multiple AI providers',
    goodboy: true,
    cursor: false,
    claudeCode: false,
    chatgpt: false,
  },
  {
    label: 'Shared context across agents',
    goodboy: true,
    cursor: false,
    claudeCode: 'partial',
    chatgpt: false,
  },
  {
    label: 'Multi-agent parallel sessions',
    goodboy: true,
    cursor: false,
    claudeCode: 'partial',
    chatgpt: false,
  },
  {
    label: 'Per-session budget caps',
    goodboy: true,
    cursor: false,
    claudeCode: false,
    chatgpt: false,
  },
  {
    label: 'Structured plans as artifacts',
    goodboy: true,
    cursor: false,
    claudeCode: 'partial',
    chatgpt: false,
  },
  {
    label: 'Git worktrees per session',
    goodboy: true,
    cursor: false,
    claudeCode: 'partial',
    chatgpt: false,
  },
  {
    label: 'GitHub PR panel built-in',
    goodboy: true,
    cursor: false,
    claudeCode: false,
    chatgpt: false,
  },
  {
    label: 'Local-first (no cloud sync)',
    goodboy: true,
    cursor: false,
    claudeCode: true,
    chatgpt: false,
  },
  {
    label: 'Uses your subscription',
    goodboy: 'all three',
    cursor: 'own',
    claudeCode: 'own',
    chatgpt: 'own',
  },
  { label: 'Replaces your IDE', goodboy: false, cursor: true, claudeCode: false, chatgpt: false },
];

function CellView({ v }: { v: Cell }) {
  if (v === true) {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-success/15 text-success">
        <svg width="12" height="12" viewBox="0 0 12 12">
          <path
            d="M2.5 6.5 5 9l4.5-5.5"
            stroke="currentColor"
            strokeWidth="1.8"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }
  if (v === false) {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted text-muted-foreground/70">
        <svg width="10" height="10" viewBox="0 0 12 12">
          <path
            d="M3 3l6 6M9 3l-6 6"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </span>
    );
  }
  if (v === 'partial') {
    return <span className="chip chip-warning">partial</span>;
  }
  return <span className="chip chip-primary">{v}</span>;
}

export function Comparison() {
  return (
    <section id="compare" className="relative py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-12 max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.10em] text-muted-foreground">
            Comparison
          </p>
          <h2 className="mt-4 text-3xl sm:text-4xl leading-[1.05] tracking-[-0.025em] font-semibold text-foreground">
            Where Goodboy fits.
          </h2>
          <p className="mt-5 max-w-prose text-[15px] leading-[1.7] text-muted-foreground">
            Not another IDE. The layer above. Keep what you have, add coordination.
          </p>
        </div>
        <div className="overflow-hidden rounded-xl border border-border-soft bg-subtle">
          <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr_1fr] text-[11.5px]">
            <div className="bg-[oklch(0.27_0.008_255)] px-4 py-3 text-[10.5px] uppercase tracking-wider text-muted-foreground">
              Capability
            </div>
            <Header label="Goodboy" highlight />
            <Header label="Cursor" />
            <Header label="Claude Code" />
            <Header label="ChatGPT" />
            {rows.map((r, i) => (
              <ComparisonRow key={r.label} row={r} odd={i % 2 === 1} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Header({ label, highlight }: { label: string; highlight?: boolean }) {
  return (
    <div
      className={[
        'bg-[oklch(0.27_0.008_255)] px-4 py-3 text-center text-[12.5px] font-semibold',
        highlight
          ? 'border-l border-r border-primary/25 bg-primary/[0.06] text-primary'
          : 'text-foreground',
      ].join(' ')}
    >
      {label}
    </div>
  );
}

function ComparisonRow({ row, odd }: { row: Row; odd: boolean }) {
  const bg = odd ? 'bg-[oklch(0.27_0.008_255)]' : 'bg-subtle';
  return (
    <>
      <div className={`px-4 py-3 text-foreground ${bg}`}>{row.label}</div>
      <div
        className={`flex items-center justify-center border-l border-r border-primary/15 px-4 py-3 ${bg}`}
      >
        <CellView v={row.goodboy} />
      </div>
      <div className={`flex items-center justify-center px-4 py-3 ${bg}`}>
        <CellView v={row.cursor} />
      </div>
      <div className={`flex items-center justify-center px-4 py-3 ${bg}`}>
        <CellView v={row.claudeCode} />
      </div>
      <div className={`flex items-center justify-center px-4 py-3 ${bg}`}>
        <CellView v={row.chatgpt} />
      </div>
    </>
  );
}
