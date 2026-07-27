import type { ReactNode } from 'react';
import { Eyebrow, SectionTitle } from '../components/ui';
import { useInView } from '../components/Reveal';

type Card = {
  icon: ReactNode;
  title: string;
  body: ReactNode;
};

const B = ({ children }: { children: ReactNode }) => (
  <strong className="font-semibold text-foreground">{children}</strong>
);

const ThreadIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M7 8a4 4 0 0 1 4-4h2a4 4 0 0 1 0 8h-2a4 4 0 0 0 0 8h2a4 4 0 0 0 4-4"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </svg>
);

const StepsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M4 6h10M4 12h7M4 18h13"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
    <circle cx="18" cy="6" r="2" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);

const ProvidersIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
    <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
    <rect
      x="13.5"
      y="4"
      width="6.5"
      height="6.5"
      rx="1.5"
      stroke="currentColor"
      strokeWidth="1.6"
    />
    <rect
      x="4"
      y="13.5"
      width="6.5"
      height="6.5"
      rx="1.5"
      stroke="currentColor"
      strokeWidth="1.6"
    />
    <rect
      x="13.5"
      y="13.5"
      width="6.5"
      height="6.5"
      rx="1.5"
      stroke="currentColor"
      strokeWidth="1.6"
    />
  </svg>
);

const CARDS: ReadonlyArray<Card> = [
  {
    icon: <ThreadIcon />,
    title: 'Stop re-explaining the goal',
    body: (
      <>
        The goal, the decisions, the last output, and your open questions follow every agent. The
        next one starts <B>briefed, not blank</B>.
      </>
    ),
  },
  {
    icon: <StepsIcon />,
    title: 'Hand off the whole job',
    body: (
      <>
        <B>Compose once, run it again</B>. Each step takes the right model and effort, scouts fan
        out on huge repos, and a big plan splits into clusters.
      </>
    ),
  },
  {
    icon: <ProvidersIcon />,
    title: 'Use every agent you pay for',
    body: (
      <>
        Claude, Cursor, Codex, Gemini, OpenCode, and OpenRouter in <B>one session</B>, on your own
        logins and keys. Set a budget cap and routing falls back when you hit it.
      </>
    ),
  },
];

export const Solutions = () => {
  const { ref, inView } = useInView<HTMLElement>();
  return (
    <section
      id="solutions"
      ref={ref}
      className={`reveal-group relative py-24 sm:py-28 ${inView ? 'is-visible' : ''}`}
    >
      <div className="mx-auto max-w-5xl px-6">
        <div className="reveal max-w-2xl">
          <Eyebrow>Why it matters</Eyebrow>
          <SectionTitle>Three things you stop fighting</SectionTitle>
        </div>

        <div className="reveal mt-12 grid gap-4 md:grid-cols-3" style={{ animationDelay: '120ms' }}>
          {CARDS.map((card) => (
            <div
              key={card.title}
              className="flex flex-col gap-4 rounded-2xl border border-border-soft bg-subtle/40 p-6"
            >
              <span className="inline-flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {card.icon}
              </span>
              <h3 className="text-[18px] font-semibold leading-snug text-foreground">
                {card.title}
              </h3>
              <p className="text-[14.5px] leading-[1.6] text-muted-foreground">{card.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
