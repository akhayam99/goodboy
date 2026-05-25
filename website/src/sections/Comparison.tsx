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
      <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-[oklch(0.69_0.13_148_/_0.15)] text-[oklch(0.82_0.13_148)]">
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
      <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-[oklch(0.30_0.010_255)] text-[oklch(0.55_0.015_255)]">
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
    return (
      <span className="inline-flex items-center justify-center h-6 px-2 rounded chip-warning text-[10.5px] font-medium">
        partial
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center h-6 px-2 rounded chip-primary text-[10.5px] font-medium">
      {v}
    </span>
  );
}

export function Comparison() {
  return (
    <section id="compare" className="py-24 relative">
      <div className="mx-auto max-w-7xl px-6">
        <div className="max-w-2xl mb-14">
          <div className="text-[11px] uppercase tracking-[0.2em] text-[oklch(0.82_0.12_200)] pb-4">
            Comparison
          </div>
          <h2 className="text-[38px] sm:text-[50px] tracking-[-0.025em] font-bold leading-[1.02]">
            <span className="gradient-text">Where Goodboy fits.</span>
          </h2>
          <p className="mt-5 text-[16px] text-[oklch(0.70_0.012_255)] leading-relaxed">
            Not another IDE. The layer above. Keep what you have, add coordination.
          </p>
        </div>
        <div className="card-glow overflow-hidden">
          <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr_1fr] text-[11.5px]">
            <div className="px-4 py-3 text-[oklch(0.58_0.015_255)] uppercase tracking-wider text-[10.5px] bg-[oklch(0.25_0.008_255)]">
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
        'px-4 py-3 text-center text-[12.5px] font-semibold bg-[oklch(0.25_0.008_255)]',
        highlight
          ? 'text-[oklch(0.88_0.12_200)] border-l border-r border-[oklch(0.78_0.13_200_/_0.25)] bg-[oklch(0.78_0.13_200_/_0.06)]'
          : 'text-[oklch(0.92_0.006_90)]',
      ].join(' ')}
    >
      {label}
    </div>
  );
}

function ComparisonRow({ row, odd }: { row: Row; odd: boolean }) {
  const bg = odd ? 'bg-[oklch(0.22_0.007_255)]' : 'bg-[oklch(0.24_0.008_255)]';
  return (
    <>
      <div className={`px-4 py-3 text-[oklch(0.86_0.008_90)] ${bg}`}>{row.label}</div>
      <div
        className={`px-4 py-3 flex items-center justify-center ${bg} border-l border-r border-[oklch(0.78_0.13_200_/_0.15)]`}
      >
        <CellView v={row.goodboy} />
      </div>
      <div className={`px-4 py-3 flex items-center justify-center ${bg}`}>
        <CellView v={row.cursor} />
      </div>
      <div className={`px-4 py-3 flex items-center justify-center ${bg}`}>
        <CellView v={row.claudeCode} />
      </div>
      <div className={`px-4 py-3 flex items-center justify-center ${bg}`}>
        <CellView v={row.chatgpt} />
      </div>
    </>
  );
}
