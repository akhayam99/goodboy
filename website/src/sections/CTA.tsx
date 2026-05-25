const lines = [
  {
    prompt: '$',
    command: 'git clone https://github.com/akhayam99/goodboy.git',
    cls: 'text-[oklch(0.92_0.006_90)]',
  },
  { prompt: '$', command: 'cd goodboy && pnpm install', cls: 'text-[oklch(0.92_0.006_90)]' },
  { prompt: '$', command: 'pnpm tauri:dev', cls: 'text-[oklch(0.88_0.12_200)]' },
];

export function CTA() {
  return (
    <section id="cta" className="py-24 relative">
      <div className="mx-auto max-w-5xl px-6">
        <div className="card-glow relative overflow-hidden p-10 sm:p-14 text-center">
          <div className="absolute inset-0 grid-bg pointer-events-none opacity-60" />
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 h-40 w-[600px] bg-[oklch(0.78_0.13_200_/_0.25)] blur-3xl rounded-full pointer-events-none" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-[oklch(0.69_0.13_148_/_0.3)] bg-[oklch(0.69_0.13_148_/_0.08)] px-3 py-1 text-[11.5px] text-[oklch(0.82_0.13_148)] mb-6">
              <span className="h-1.5 w-1.5 rounded-full bg-[oklch(0.69_0.13_148)]" />
              Open source · MIT
            </div>
            <h2 className="text-[40px] sm:text-[60px] tracking-[-0.03em] font-bold leading-[0.98]">
              <span className="gradient-text">Clone, install,</span>
              <br />
              <span className="gradient-text-accent">run it.</span>
            </h2>
            <p className="mt-5 text-[15.5px] text-[oklch(0.82_0.01_255)] leading-[1.6] max-w-xl mx-auto">
              No waitlist. No email. The repo is public. Bring your own Claude / Cursor / Codex
              subscription and you&apos;re running locally in a couple of minutes.
            </p>

            <div className="mt-9 mx-auto max-w-2xl rounded-xl border border-[oklch(0.36_0.012_255)] bg-[oklch(0.18_0.006_255)] overflow-hidden text-left">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[oklch(0.36_0.012_255)] bg-[oklch(0.23_0.007_255)]">
                <span className="h-2.5 w-2.5 rounded-full bg-[oklch(0.63_0.17_22)]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[oklch(0.76_0.13_78)]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[oklch(0.69_0.13_148)]" />
                <span className="ml-3 text-[10.5px] font-mono text-[oklch(0.58_0.015_255)]">
                  ~/work
                </span>
              </div>
              <div className="px-5 py-4 font-mono text-[12.5px] leading-[1.9]">
                {lines.map((l) => (
                  <div key={l.command} className="flex items-start gap-2">
                    <span className="text-[oklch(0.58_0.015_255)] select-none shrink-0">
                      {l.prompt}
                    </span>
                    <span className={l.cls}>{l.command}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href="https://github.com/akhayam99/goodboy"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-[oklch(0.78_0.13_200)] px-5 py-2.5 text-[14px] font-semibold text-[oklch(0.13_0.02_200)] hover:bg-[oklch(0.82_0.13_200)] transition-colors shadow-[0_0_40px_-10px_oklch(0.78_0.13_200_/_0.7)]"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
                  <path d="M8 0a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.38v-1.32c-2.23.48-2.7-1.07-2.7-1.07-.37-.93-.9-1.18-.9-1.18-.73-.5.06-.49.06-.49.81.06 1.24.83 1.24.83.72 1.23 1.88.87 2.34.66.07-.52.28-.87.5-1.07-1.78-.2-3.64-.89-3.64-3.96 0-.87.3-1.59.83-2.15-.08-.2-.36-1.02.08-2.13 0 0 .67-.22 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.11.16 1.93.08 2.13.51.56.82 1.28.82 2.15 0 3.08-1.87 3.76-3.65 3.96.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 8 0Z" />
                </svg>
                View on GitHub
              </a>
              <a
                href="https://github.com/akhayam99/goodboy/blob/main/README.md"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-[oklch(0.42_0.012_255)] bg-[oklch(0.26_0.008_255_/_0.8)] px-5 py-2.5 text-[14px] font-medium text-[oklch(0.88_0.008_90)] hover:bg-[oklch(0.32_0.010_255)] transition-colors"
              >
                Read the docs
              </a>
            </div>

            <div className="mt-6 flex items-center justify-center gap-5 text-[11.5px] text-[oklch(0.68_0.015_255)]">
              <span>macOS · Windows · Linux</span>
              <span>·</span>
              <span>Node 20+ · pnpm 9+</span>
              <span>·</span>
              <span>Bring your own subscription</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
