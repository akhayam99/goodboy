import { DogMascot } from '../components/DogMascot';
import { LinkButton } from '../components/ui';
import { ThreadGraphSnapshot } from '../mockups/ThreadGraph';

const GitHubGlyph = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
    <path d="M8 0a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.38v-1.32c-2.23.48-2.7-1.07-2.7-1.07-.37-.93-.9-1.18-.9-1.18-.73-.5.06-.49.06-.49.81.06 1.24.83 1.24.83.72 1.23 1.88.87 2.34.66.07-.52.28-.87.5-1.07-1.78-.2-3.64-.89-3.64-3.96 0-.87.3-1.59.83-2.15-.08-.2-.36-1.02.08-2.13 0 0 .67-.22 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.11.16 1.93.08 2.13.51.56.82 1.28.82 2.15 0 3.08-1.87 3.76-3.65 3.96.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 8 0Z" />
  </svg>
);

export const Hero = () => (
  <>
    <section className="scene relative overflow-hidden">
      <div className="relative z-10 mx-auto w-full max-w-3xl px-6 text-center">
        <div className="rise flex justify-center">
          <DogMascot size={64} className="text-primary" />
        </div>

        <p
          className="rise mt-6 text-[13px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:text-[14px]"
          style={{ animationDelay: '60ms' }}
        >
          Still re-explaining yourself?
        </p>

        <h1
          className="rise mt-4 text-balance text-[42px] font-semibold leading-[1.03] tracking-[-0.035em] text-foreground sm:text-[62px] lg:text-[70px]"
          style={{ animationDelay: '120ms' }}
        >
          Goodboy <span className="text-[oklch(0.74_0.15_150)]">remembers</span>, so you don&apos;t
          have to.
        </h1>

        <p
          className="rise mx-auto mt-6 max-w-xl text-pretty text-[17px] leading-[1.6] text-muted-foreground sm:text-[19px]"
          style={{ animationDelay: '180ms' }}
        >
          It carries what you&apos;re building, what you decided, and what&apos;s still open into
          every <strong className="font-semibold text-foreground">coding agent</strong> it runs.
          When a step ends, an{' '}
          <strong className="font-semibold text-foreground">orchestrator</strong> reads the result
          and <strong className="font-semibold text-foreground">picks the next one</strong>: the
          agent, the model, how hard to think.
          <br className="hidden sm:block" /> Across Claude, Cursor, Codex, Antigravity, OpenCode,
          OpenRouter, and Moonshot.
        </p>

        <div
          className="rise mt-9 flex flex-col items-center gap-3 pointer-fine:hidden"
          style={{ animationDelay: '240ms' }}
        >
          <div className="flex w-full max-w-xs flex-col items-center gap-1.5">
            <LinkButton
              href="https://github.com/akhayam99/goodboy"
              target="_blank"
              rel="noreferrer"
              size="lg"
              variant="primary"
              className="w-full"
            >
              <GitHubGlyph />
              Star on GitHub
            </LinkButton>
            <p className="text-[12px] text-muted-foreground/75">
              Free and open source, MIT. Install on your Mac or Linux machine.
            </p>
          </div>
          <LinkButton href="#cta" size="lg" variant="ghost">
            How to install
          </LinkButton>
        </div>

        <div
          className="rise mt-9 hidden flex-col items-center justify-center gap-3 pointer-fine:flex"
          style={{ animationDelay: '240ms' }}
        >
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
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
          <p className="text-[12.5px] text-muted-foreground/75">
            Free and open source, MIT. Installs on macOS and Linux.
          </p>
        </div>
      </div>
    </section>

    <section id="thread" className="scene relative overflow-hidden">
      <div className="relative z-10 mx-auto w-full max-w-[720px] px-6">
        <p className="rise text-center text-[13px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          One run, six agents
        </p>
        <h2
          className="rise mx-auto mt-3 max-w-lg text-balance text-center text-[26px] font-semibold leading-[1.2] tracking-[-0.02em] text-foreground sm:text-[30px]"
          style={{ animationDelay: '60ms' }}
        >
          The orchestrator picks who works next
        </h2>
        <div className="rise mt-8 [&>svg]:max-h-[60svh]" style={{ animationDelay: '140ms' }}>
          <ThreadGraphSnapshot />
        </div>
      </div>
    </section>
  </>
);
