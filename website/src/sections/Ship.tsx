import type { ReactNode } from 'react';
import { Eyebrow, SectionTitle } from '../components/ui';
import { useInView } from '../components/Reveal';
import { ResolveInDiff } from '../mockups/ResolveInDiff';

type Card = {
  icon: ReactNode;
  title: string;
  body: ReactNode;
};

const B = ({ children }: { children: ReactNode }) => (
  <strong className="font-semibold text-foreground">{children}</strong>
);

const IssueIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
    <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" />
    <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.6" />
    <circle cx="12" cy="12" r="0.5" fill="currentColor" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);

const InboxIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M4 13.5 6.5 5h11L20 13.5"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
    <path
      d="M4 13.5h4.5a2.5 2.5 0 0 0 2.2 1.3h2.6a2.5 2.5 0 0 0 2.2-1.3H20V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-5.5Z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  </svg>
);

const ResolveIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M20 12a7.5 7.5 0 1 1-3.2-6.15"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
    <path
      d="M9 12.5 11 14.5 15.5 9.5"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const CARDS: ReadonlyArray<Card> = [
  {
    icon: <IssueIcon />,
    title: 'Issues become sessions',
    body: (
      <>
        GitHub, GitLab, Linear, and Sentry each get a dashboard inside the app. Pick an issue and
        the <B>goal is written</B>, the <B>branch is named</B>. A Sentry error brings its stack
        trace along.
      </>
    ),
  },
  {
    icon: <InboxIcon />,
    title: 'One review inbox',
    body: (
      <>
        Pull requests and merge requests, <B>yours and the ones waiting on you</B>, for GitHub and
        GitLab. Comments stay drafts until you publish the batch.
      </>
    ),
  },
  {
    icon: <ResolveIcon />,
    title: 'Resolvers answer comments',
    body: (
      <>
        Hand a review comment to a resolver agent. It addresses it with a <B>local commit</B> and
        leaves the push to you.
      </>
    ),
  },
];

export const Ship = () => {
  const { ref, inView } = useInView<HTMLElement>();
  return (
    <section
      id="ship"
      ref={ref}
      className={`reveal-group edge-t relative py-24 sm:py-28 ${inView ? 'is-visible' : ''}`}
    >
      <div className="mx-auto max-w-5xl px-6">
        <div className="reveal max-w-2xl">
          <Eyebrow>Integrations</Eyebrow>
          <SectionTitle>Pick up the issue, land the merge</SectionTitle>
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

        <div className="reveal mx-auto mt-10 max-w-4xl" style={{ animationDelay: '160ms' }}>
          <ResolveInDiff />
        </div>

        <p
          className="reveal mt-8 max-w-2xl text-[13.5px] leading-[1.6] text-muted-foreground"
          style={{ animationDelay: '200ms' }}
        >
          Reading is ahead of acting for now: commenting, assigning, and transitioning an issue
          still happen in the browser.
        </p>
      </div>
    </section>
  );
};
