import { DogMascot } from '../components/DogMascot';
import { LinkButton } from '../components/ui';

function GitHubGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 0a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.38v-1.32c-2.23.48-2.7-1.07-2.7-1.07-.37-.93-.9-1.18-.9-1.18-.73-.5.06-.49.06-.49.81.06 1.24.83 1.24.83.72 1.23 1.88.87 2.34.66.07-.52.28-.87.5-1.07-1.78-.2-3.64-.89-3.64-3.96 0-.87.3-1.59.83-2.15-.08-.2-.36-1.02.08-2.13 0 0 .67-.22 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.11.16 1.93.08 2.13.51.56.82 1.28.82 2.15 0 3.08-1.87 3.76-3.65 3.96.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 8 0Z" />
    </svg>
  );
}

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-12 pb-20 sm:pt-16 sm:pb-24">
      <div className="relative z-10 mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <div className="rise inline-flex items-center gap-2 text-[22px] font-semibold tracking-tight text-foreground">
            <DogMascot size={30} className="text-primary" />
            <span>Goodboy</span>
          </div>

          <h1
            className="rise mt-6 text-balance text-[42px] font-semibold leading-[1.02] tracking-[-0.035em] sm:text-[64px] lg:text-[72px]"
            style={{ animationDelay: '60ms' }}
          >
            <span className="text-gradient">Stop re-explaining</span>
            <br />
            <span className="text-foreground">yourself.</span>
          </h1>

          <p
            className="rise mx-auto mt-6 max-w-xl text-pretty text-[17px] leading-[1.6] text-muted-foreground sm:text-[19px]"
            style={{ animationDelay: '120ms' }}
          >
            Run Claude, Cursor, Codex and Gemini in one local workspace.
          </p>
          <p
            className="rise mx-auto mt-3 max-w-xl text-pretty text-[17px] leading-[1.6] text-muted-foreground sm:text-[19px]"
            style={{ animationDelay: '160ms' }}
          >
            They share the same goal, plan and context, so the next agent picks up right where the
            last left off.
          </p>

          <div
            className="rise mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
            style={{ animationDelay: '180ms' }}
          >
            <LinkButton href="#cta" size="lg" variant="primary">
              Install
            </LinkButton>
            <LinkButton
              href="https://github.com/akhayam99/goodboy"
              target="_blank"
              rel="noreferrer"
              size="lg"
              variant="secondary"
            >
              <GitHubGlyph />
              GitHub
            </LinkButton>
          </div>

          <p
            className="rise mt-5 text-[12.5px] text-muted-foreground/75"
            style={{ animationDelay: '240ms' }}
          >
            Free &amp; open source &middot; macOS &middot; bring your own subscription
          </p>
        </div>
      </div>
    </section>
  );
}
