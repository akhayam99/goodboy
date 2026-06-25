import type { ReactNode } from 'react';
import { Eyebrow, SectionTitle } from '../components/ui';
import { useInView } from '../components/Reveal';

type Item = { k: string; v: ReactNode };

const B = ({ children }: { children: ReactNode }) => (
  <strong className="font-semibold text-foreground">{children}</strong>
);

const ITEMS: ReadonlyArray<Item> = [
  {
    k: 'Scout fan-out',
    v: (
      <>
        On a huge repo, a scout splits into <B>parallel child scouts</B> to survey more at once.
      </>
    ),
  },
  {
    k: 'Plan clusters',
    v: (
      <>
        When a plan splits into clusters, the implementer runs <B>one agent per cluster</B>.
      </>
    ),
  },
  {
    k: 'Stage board',
    v: (
      <>
        The home sorts every session by <B>what it needs</B>: attention, running, in review,
        building, done.
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
    k: 'Budget register',
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
    k: 'Composite workspaces',
    v: (
      <>
        Run one session across <B>many repos</B>, one chat, a branch checked out per repo.
      </>
    ),
  },
  {
    k: 'Mobile companion',
    v: (
      <>
        Spawn a workflow or merge a PR <B>from your phone</B>. A companion, not a full app.
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
