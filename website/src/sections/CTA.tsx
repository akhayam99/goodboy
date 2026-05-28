import { LinkButton } from '../components/ui';

const lines = [
  { prompt: '$', command: 'git clone https://github.com/akhayam99/goodboy.git', muted: false },
  { prompt: '$', command: 'cd goodboy && pnpm install', muted: false },
  { prompt: '$', command: 'pnpm tauri:build', muted: true },
];

export function CTA() {
  return (
    <section id="cta" className="relative py-28 sm:py-36">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.10em] text-muted-foreground">
          Open source &middot; MIT
        </p>
        <h2 className="mt-5 text-3xl sm:text-5xl leading-[1.02] tracking-[-0.03em] font-semibold text-foreground">
          Clone, install, run it.
        </h2>
        <p className="mx-auto mt-5 max-w-md text-[15px] leading-[1.65] text-muted-foreground">
          No waitlist. No email. The repo is public. Bring your own Claude, Cursor, Codex or Gemini
          subscription and you&apos;re running locally.
        </p>

        <div className="mx-auto mt-10 max-w-xl overflow-hidden rounded-xl border border-border-soft bg-[oklch(0.22_0.007_255)] text-left">
          <div className="flex items-center gap-2 border-b border-border-soft bg-[oklch(0.27_0.008_255)] px-4 py-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-danger" aria-hidden />
            <span className="h-2.5 w-2.5 rounded-full bg-warning" aria-hidden />
            <span className="h-2.5 w-2.5 rounded-full bg-success" aria-hidden />
            <span className="ml-3 font-mono text-[10.5px] text-muted-foreground">~/work</span>
          </div>
          <div className="px-5 py-4 font-mono text-[12.5px] leading-[1.9]">
            {lines.map((l) => (
              <div key={l.command} className="flex items-start gap-2">
                <span className="shrink-0 select-none text-muted-foreground">{l.prompt}</span>
                <span className={l.muted ? 'text-primary' : 'text-foreground'}>{l.command}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <LinkButton
            href="https://github.com/akhayam99/goodboy"
            target="_blank"
            rel="noreferrer"
            size="lg"
            variant="primary"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
              <path d="M8 0a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.38v-1.32c-2.23.48-2.7-1.07-2.7-1.07-.37-.93-.9-1.18-.9-1.18-.73-.5.06-.49.06-.49.81.06 1.24.83 1.24.83.72 1.23 1.88.87 2.34.66.07-.52.28-.87.5-1.07-1.78-.2-3.64-.89-3.64-3.96 0-.87.3-1.59.83-2.15-.08-.2-.36-1.02.08-2.13 0 0 .67-.22 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.11.16 1.93.08 2.13.51.56.82 1.28.82 2.15 0 3.08-1.87 3.76-3.65 3.96.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 8 0Z" />
            </svg>
            View on GitHub
          </LinkButton>
          <LinkButton
            href="https://github.com/akhayam99/goodboy/blob/main/README.md"
            target="_blank"
            rel="noreferrer"
            size="lg"
            variant="secondary"
          >
            Read the docs
          </LinkButton>
        </div>

        <p className="mt-6 text-[12px] text-muted-foreground/70">
          macOS, Windows, Linux &middot; Node 20+ &middot; pnpm 9+ &middot; Bring your own
          subscription
        </p>
      </div>
    </section>
  );
}
