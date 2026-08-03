import type { ReactNode } from 'react';
import { Eyebrow, SectionTitle } from '../components/ui';
import { useInView } from '../components/Reveal';

type Item = { k: string; v: ReactNode };

const B = ({ children }: { children: ReactNode }) => (
  <strong className="font-semibold text-foreground">{children}</strong>
);

const ITEMS: ReadonlyArray<Item> = [
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
    v: (
      <>
        <B>Allow, deny, or ask</B> per tool, scoped global, workspace, or session. Enforced on
        Claude sessions first.
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
      className={`scene reveal-group relative ${inView ? 'is-visible' : ''}`}
    >
      <div className="mx-auto w-full max-w-5xl px-6">
        <div className="reveal max-w-2xl">
          <Eyebrow>Everything else</Eyebrow>
          <SectionTitle>The rest, briefly</SectionTitle>
        </div>

        <dl
          className="reveal mt-10 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3"
          style={{ animationDelay: '100ms' }}
        >
          {ITEMS.map((it) => (
            <div key={it.k} className="border-t border-border-soft pt-3.5">
              <dt className="text-[15px] font-semibold text-foreground">{it.k}</dt>
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
