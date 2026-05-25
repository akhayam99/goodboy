import { AppMockup } from '../mockups/AppMockup';

export function Hero() {
  return (
    <section className="relative pt-20 pb-28">
      <div className="absolute inset-0 grid-bg pointer-events-none" />
      {/* large ambient glow behind headline */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-[oklch(0.78_0.13_200_/_0.07)] blur-[120px] pointer-events-none rounded-full" />

      <div className="relative mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-4xl text-center">
          {/* badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-[oklch(0.69_0.13_148_/_0.3)] bg-[oklch(0.69_0.13_148_/_0.07)] px-4 py-1.5 text-[12px] text-[oklch(0.82_0.13_148)] mb-8 fade-up">
            <span className="h-1.5 w-1.5 rounded-full bg-[oklch(0.69_0.13_148)]" />
            Open source · MIT
            <span className="text-[oklch(0.50_0.015_255)]">·</span>
            <span className="text-[oklch(0.65_0.012_255)]">macOS · Windows · Linux</span>
          </div>

          {/* headline */}
          <h1
            className="text-[56px] sm:text-[72px] lg:text-[88px] leading-[0.92] tracking-[-0.03em] font-bold fade-up"
            style={{ animationDelay: '60ms' }}
          >
            <span className="gradient-text">AI workspace</span>
            <br />
            <span className="gradient-text-accent">orchestrator.</span>
          </h1>

          {/* sub */}
          <p
            className="mt-7 text-[17px] sm:text-[19px] leading-[1.6] text-[oklch(0.72_0.012_255)] max-w-2xl mx-auto fade-up"
            style={{ animationDelay: '120ms' }}
          >
            Route agents across Claude, Cursor, and Codex without re-explaining the goal. Shared
            context, structured plans, real-time cost. Local-first. Your keys, your machine.
          </p>

          {/* CTAs */}
          <div
            className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3 fade-up"
            style={{ animationDelay: '180ms' }}
          >
            <a
              href="#cta"
              className="inline-flex items-center gap-2 rounded-lg bg-[oklch(0.78_0.13_200)] px-6 py-3 text-[15px] font-semibold text-[oklch(0.12_0.02_200)] hover:bg-[oklch(0.83_0.13_200)] transition-all shadow-[0_0_80px_-12px_oklch(0.78_0.13_200_/_0.7)]"
            >
              Clone &amp; run
              <svg width="13" height="13" viewBox="0 0 12 12" aria-hidden>
                <path
                  d="M3 6h6m-2-2 2 2-2 2"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </a>
            <a
              href="https://github.com/akhayam99/goodboy"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-[oklch(0.42_0.012_255)] bg-[oklch(0.26_0.008_255_/_0.8)] px-6 py-3 text-[15px] font-medium text-[oklch(0.88_0.008_90)] hover:bg-[oklch(0.32_0.010_255)] transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
                <path d="M8 0a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.38v-1.32c-2.23.48-2.7-1.07-2.7-1.07-.37-.93-.9-1.18-.9-1.18-.73-.5.06-.49.06-.49.81.06 1.24.83 1.24.83.72 1.23 1.88.87 2.34.66.07-.52.28-.87.5-1.07-1.78-.2-3.64-.89-3.64-3.96 0-.87.3-1.59.83-2.15-.08-.2-.36-1.02.08-2.13 0 0 .67-.22 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.11.16 1.93.08 2.13.51.56.82 1.28.82 2.15 0 3.08-1.87 3.76-3.65 3.96.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 8 0Z" />
              </svg>
              View on GitHub
            </a>
          </div>

          {/* trust bullets */}
          <div
            className="mt-8 flex flex-wrap items-center justify-center gap-x-7 gap-y-2 text-[12px] text-[oklch(0.56_0.015_255)] fade-up"
            style={{ animationDelay: '240ms' }}
          >
            <Bullet>No cloud sync</Bullet>
            <Bullet>No metered tokens</Bullet>
            <Bullet>MIT licensed</Bullet>
            <Bullet>Bring your own keys</Bullet>
          </div>
        </div>

        {/* app mockup */}
        <div className="relative mt-20 fade-up" style={{ animationDelay: '200ms' }}>
          <div className="absolute -inset-x-20 top-12 bottom-0 bg-[oklch(0.78_0.13_200_/_0.10)] blur-[80px] pointer-events-none rounded-full" />
          <div className="relative max-w-7xl mx-auto">
            <AppMockup />
          </div>
        </div>
      </div>
    </section>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden>
        <path
          d="M2.5 6.5 5 9l4.5-5.5"
          stroke="oklch(0.69 0.13 148)"
          strokeWidth="1.6"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {children}
    </span>
  );
}
