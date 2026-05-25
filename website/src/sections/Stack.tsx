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
    <section id="stack" className="py-24 relative">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid lg:grid-cols-[1.1fr_1fr] gap-16 items-start">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-[oklch(0.82_0.12_200)] pb-4">
              Architecture
            </div>
            <h2 className="text-[38px] sm:text-[50px] tracking-[-0.025em] font-bold leading-[1.02]">
              <span className="gradient-text">Native shell.</span>
              <br />
              <span className="gradient-text-accent">Modern web underneath.</span>
            </h2>
            <p className="mt-6 text-[16px] text-[oklch(0.70_0.012_255)] leading-[1.65]">
              Tauri shell wrapping a React + TypeScript surface. SQLite stores everything locally.
              API keys live in your OS credential store. Nothing leaves the machine unless an agent
              calls a provider you authorized.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {items.map((i) => (
              <div
                key={i.label}
                className="card-glow p-4 aspect-square flex flex-col justify-between"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[oklch(0.78_0.13_200_/_0.12)] text-[oklch(0.85_0.12_200)] border border-[oklch(0.78_0.13_200_/_0.2)] text-[12px] font-mono font-semibold">
                  {i.glyph}
                </div>
                <div>
                  <div className="text-[13px] font-medium text-[oklch(0.92_0.006_90)]">
                    {i.label}
                  </div>
                  <div className="text-[10.5px] text-[oklch(0.68_0.015_255)]">{i.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
