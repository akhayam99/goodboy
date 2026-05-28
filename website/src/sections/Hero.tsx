import { DogMascot } from '../components/DogMascot';
import { LinkButton } from '../components/ui';
import { AppOverviewSnapshot } from '../mockups/Snapshots';

export function Hero() {
  return (
    <section className="relative pt-16 pb-24 sm:pt-24 sm:pb-28">
      <div className="relative mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <div className="rise relative mx-auto inline-flex flex-col pb-7">
            <h1 className="flex items-center gap-2 sm:gap-3 text-[48px] sm:text-[68px] lg:text-[80px] leading-[0.95] tracking-[-0.035em] font-semibold text-foreground">
              <DogMascot size={96} className="shrink-0 text-primary" />
              <span>Goodboy</span>
            </h1>

            <p
              className="rise absolute inset-x-0 top-full -mt-1 text-center text-[15px] sm:text-[17px] font-medium leading-[1.2] tracking-[-0.005em] text-primary"
              style={{ animationDelay: '80ms' }}
            >
              AI workspace orchestrator.
            </p>
          </div>

          <p
            className="rise mx-auto mt-7 max-w-xl text-[15px] sm:text-[16px] leading-[1.6] text-muted-foreground"
            style={{ animationDelay: '120ms' }}
          >
            Stack workflows on one session. Route agents across Claude, Cursor, Codex, and Gemini
            without re-explaining the goal. Shared context, structured plans, real-time cost.
            Local-first. Your keys, your machine.
          </p>

          <div
            className="rise mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
            style={{ animationDelay: '180ms' }}
          >
            <LinkButton href="#cta" size="lg" variant="primary">
              Clone &amp; run
            </LinkButton>
            <LinkButton
              href="https://github.com/akhayam99/goodboy"
              target="_blank"
              rel="noreferrer"
              size="lg"
              variant="secondary"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
                <path d="M8 0a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.38v-1.32c-2.23.48-2.7-1.07-2.7-1.07-.37-.93-.9-1.18-.9-1.18-.73-.5.06-.49.06-.49.81.06 1.24.83 1.24.83.72 1.23 1.88.87 2.34.66.07-.52.28-.87.5-1.07-1.78-.2-3.64-.89-3.64-3.96 0-.87.3-1.59.83-2.15-.08-.2-.36-1.02.08-2.13 0 0 .67-.22 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.11.16 1.93.08 2.13.51.56.82 1.28.82 2.15 0 3.08-1.87 3.76-3.65 3.96.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 8 0Z" />
              </svg>
              GitHub
            </LinkButton>
          </div>

          <p
            className="rise mt-6 text-[12.5px] text-muted-foreground/75"
            style={{ animationDelay: '240ms' }}
          >
            MIT licensed &middot; macOS, Windows, Linux &middot; Bring your own subscription
          </p>
        </div>

        {/* One comprehensive snapshot of the running app: sidebar, chat,
            context panel, all visible together. The deep-dives below zoom in
            on each piece. */}
        <div className="rise relative mx-auto mt-16 max-w-5xl" style={{ animationDelay: '320ms' }}>
          <AppOverviewSnapshot />
        </div>
      </div>
    </section>
  );
}
