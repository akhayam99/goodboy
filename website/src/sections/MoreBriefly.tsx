import type { ReactNode } from 'react';
import { Eyebrow, SectionTitle } from '../components/ui';
import { useInView } from '../components/Reveal';

type Item = { k: string; v: ReactNode; beta?: boolean };

const B = ({ children }: { children: ReactNode }) => (
  <strong className="font-semibold text-foreground">{children}</strong>
);

const ITEMS: ReadonlyArray<Item> = [
  {
    k: 'Fan-out',
    v: (
      <>
        On a huge repo a scout splits into <B>parallel child scouts</B>, and a big plan splits into
        clusters, one implementer each.
      </>
    ),
  },
  {
    k: 'Stage board',
    v: (
      <>
        The home sorts every session by <B>what it needs</B>: building, running, needs you, in
        review, done.
      </>
    ),
  },
  {
    k: 'Diff lens',
    v: (
      <>
        Syntax-highlighted diffs across <B>a dozen languages</B>, with change bars in the gutter.
      </>
    ),
  },
  {
    k: 'Impact Studio',
    v: (
      <>
        Outcome and flow analytics on the work you <B>shipped</B>, last 30 days or all time.
      </>
    ),
  },
  {
    k: 'Model picker',
    v: (
      <>
        Every provider's catalog in one picker: <B>families, versions, and an effort ladder</B>,
        each model under its authored name.
      </>
    ),
  },
  {
    k: 'Budget Studio',
    v: (
      <>
        One dashboard totals your spend <B>per provider</B>, against the caps you set.
      </>
    ),
  },
  {
    k: 'GPU terminal',
    v: (
      <>
        A real <B>login shell</B> on xterm 6, GPU-rendered, multi-tab, spawned on demand.
      </>
    ),
  },
  {
    k: 'Workspaces, plain or composite',
    v: (
      <>
        Start <B>without a repo</B> and convert later, run one session across many repos, or pop a
        workspace into its own window.
      </>
    ),
  },
  {
    k: 'Tool permissions',
    beta: true,
    v: (
      <>
        <B>Allow, deny, or ask</B> per tool, scoped global, workspace, or session. Beta, enforced on
        Claude sessions first.
      </>
    ),
  },
  {
    k: 'Skills',
    v: (
      <>
        Markdown skills per workspace, invoked with a <B>slash command</B>, runnable on any
        provider.
      </>
    ),
  },
];

export const MoreBriefly = () => {
  const { ref, inView } = useInView<HTMLElement>();
  return (
    <section
      id="more"
      ref={ref}
      className={`reveal-group relative py-24 sm:py-28 ${inView ? 'is-visible' : ''}`}
    >
      <div className="mx-auto max-w-5xl px-6">
        <div className="reveal max-w-2xl">
          <Eyebrow>Everything else</Eyebrow>
          <SectionTitle>The rest, briefly</SectionTitle>
        </div>

        <dl
          className="reveal mt-12 grid gap-x-10 gap-y-7 sm:grid-cols-2"
          style={{ animationDelay: '100ms' }}
        >
          {ITEMS.map((it) => (
            <div key={it.k} className="border-t border-border-soft pt-3.5">
              <dt className="text-[15px] font-semibold text-foreground">
                {it.k}
                {it.beta ? <span className="chip chip-warning ml-2 align-middle">beta</span> : null}
              </dt>
              <dd className="mt-1.5 text-pretty text-[13.5px] leading-[1.6] text-muted-foreground">
                {it.v}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
};
