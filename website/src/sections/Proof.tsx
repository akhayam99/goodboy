import type { ReactNode } from 'react';
import { Eyebrow, SectionTitle, LinkButton } from '../components/ui';
import { useInView } from '../components/Reveal';

const GitHubGlyph = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
    <path d="M8 0a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.38v-1.32c-2.23.48-2.7-1.07-2.7-1.07-.37-.93-.9-1.18-.9-1.18-.73-.5.06-.49.06-.49.81.06 1.24.83 1.24.83.72 1.23 1.88.87 2.34.66.07-.52.28-.87.5-1.07-1.78-.2-3.64-.89-3.64-3.96 0-.87.3-1.59.83-2.15-.08-.2-.36-1.02.08-2.13 0 0 .67-.22 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.11.16 1.93.08 2.13.51.56.82 1.28.82 2.15 0 3.08-1.87 3.76-3.65 3.96.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 8 0Z" />
  </svg>
);

const B = ({ children }: { children: ReactNode }) => (
  <strong className="font-semibold text-foreground">{children}</strong>
);

const FACTS: ReadonlyArray<{ k: string; v: ReactNode }> = [
  {
    k: 'Open source, MIT',
    v: (
      <>
        Every line is <B>on GitHub</B>. Read it, fork it, run your own build.
      </>
    ),
  },
  {
    k: 'Local-first',
    v: (
      <>
        Your sessions, history, and keys stay <B>on your machine</B>.
      </>
    ),
  },
  {
    k: 'Your own logins',
    v: (
      <>
        <B>No new account</B>. It drives the command-line tools you already signed into, on the
        plans you already pay for.
      </>
    ),
  },
];

export const Proof = () => {
  const { ref, inView } = useInView<HTMLElement>();
  return (
    <section
      id="proof"
      ref={ref}
      className={`reveal-group relative py-24 sm:py-28 ${inView ? 'is-visible' : ''}`}
    >
      <div className="mx-auto max-w-3xl px-6">
        <div className="reveal max-w-2xl">
          <Eyebrow>No pitch</Eyebrow>
          <SectionTitle>The tool I use every day</SectionTitle>
        </div>

        <div className="reveal mt-12 grid gap-3 sm:grid-cols-3" style={{ animationDelay: '100ms' }}>
          {FACTS.map((f) => (
            <div key={f.k} className="rounded-2xl border border-border-soft bg-subtle/40 p-5">
              <h3 className="text-[14px] font-semibold text-foreground">{f.k}</h3>
              <p className="mt-2 text-[13px] leading-[1.55] text-muted-foreground">{f.v}</p>
            </div>
          ))}
        </div>

        <div
          className="reveal letter mt-10 flex flex-col gap-5 text-[18px] leading-[1.6] text-foreground/90"
          style={{ animationDelay: '160ms' }}
        >
          <p>
            For a while my home screen was a chat box. I would type the goal, watch an agent work,
            then go looking for the diff, the cost, the pull request, each in its own place. Worse,
            every new window started cold, so I kept re-explaining myself: the goal, the plan, the
            thing I had already decided an hour ago.
          </p>
          <p>
            So I built the part I kept wishing for. <B>Goodboy carries the thread now</B>. Each
            agent inherits the goal, the decisions, the last output, and the open questions you
            answered, instead of asking you again. This is the shape the tool has today, and it is
            the shape I use every day. If it does not fit yours, the repo is open and I am
            listening.
          </p>
        </div>

        <div className="reveal mt-8 flex" style={{ animationDelay: '220ms' }}>
          <LinkButton
            href="https://github.com/akhayam99/goodboy"
            target="_blank"
            rel="noreferrer"
            size="md"
            variant="secondary"
          >
            <GitHubGlyph />
            Read the source
          </LinkButton>
        </div>
      </div>
    </section>
  );
};
