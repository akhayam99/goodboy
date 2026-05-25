const items = [
  { label: 'Tauri 2', sub: 'native shell', glyph: 'T' },
  { label: 'React 19', sub: 'UI', glyph: 'R' },
  { label: 'TypeScript', sub: 'strict mode', glyph: 'TS' },
  { label: 'Tailwind 4', sub: 'design system', glyph: 'tw' },
  { label: 'Zustand', sub: 'state', glyph: 'Z' },
  { label: 'SQLite', sub: 'local DB', glyph: 'SQ' },
  { label: 'Vite', sub: 'build', glyph: 'V' },
  { label: 'Turborepo', sub: 'monorepo', glyph: 'TR' },
];

export function Stack() {
  return (
    <section id="stack" className="relative py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid items-start gap-16 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.10em] text-muted-foreground">
              Architecture
            </p>
            <h2 className="mt-4 text-3xl sm:text-4xl leading-[1.05] tracking-[-0.025em] font-semibold text-foreground">
              Native shell. Modern web underneath.
            </h2>
            <p className="mt-6 max-w-prose text-[15px] leading-[1.7] text-muted-foreground">
              Tauri shell wrapping a React + TypeScript surface. SQLite stores everything locally.
              API keys live in your OS credential store. Nothing leaves the machine unless an agent
              calls a provider you authorized.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {items.map((i) => (
              <div
                key={i.label}
                className="flex aspect-square flex-col justify-between rounded-xl border border-border-soft bg-subtle p-4"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-md border border-border-soft bg-muted font-mono text-[12px] font-semibold text-primary">
                  {i.glyph}
                </div>
                <div>
                  <div className="text-[13px] font-medium text-foreground">{i.label}</div>
                  <div className="text-[11px] text-muted-foreground">{i.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
