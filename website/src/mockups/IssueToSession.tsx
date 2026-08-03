import type { ReactNode } from 'react';
import { MARK_PATH, type Mark } from '../components/BrandIcons';
import { useToggleInView } from '../components/Reveal';
import { CycleBar } from './CycleBar';
import { useCycle, usePrefersReducedMotion } from './motion';

type Issue = {
  mark: Mark;
  source: string;
  ref: string;
  title: string;
  goal: string;
  branch: string;
  carried: string;
};

const ISSUES: ReadonlyArray<Issue> = [
  {
    mark: 'linear',
    source: 'Linear',
    ref: 'ENG-482',
    title: 'Retry webhook delivery on 5xx',
    goal: 'Retry webhook delivery on 5xx',
    branch: 'ak/eng-482-webhook-retry',
    carried: 'description and comments carried over',
  },
  {
    mark: 'sentry',
    source: 'Sentry',
    ref: 'ACME-9F2',
    title: "TypeError: cannot read 'plan' of undefined",
    goal: "Fix the TypeError reading 'plan' in the summarizer",
    branch: 'ak/acme-9f2-plan-typeerror',
    carried: 'stack trace carried over',
  },
  {
    mark: 'github',
    source: 'GitHub',
    ref: '#214',
    title: 'Dark mode audit for the diff lens',
    goal: 'Dark mode audit for the diff lens',
    branch: 'ak/214-dark-mode-audit',
    carried: 'issue body carried over',
  },
];

const MarkGlyph = ({ mark }: { mark: Mark }) => (
  <svg width="11" height="11" viewBox="0 0 24 24" aria-hidden className="shrink-0">
    <path d={MARK_PATH[mark]} fill="currentColor" />
  </svg>
);

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex flex-col gap-1">
    <span className="text-[9px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">
      {label}
    </span>
    <div className="rounded-md border border-border-soft/70 bg-muted/30 px-2.5 py-1.5 text-[11px] leading-snug text-foreground/90">
      {children}
    </div>
  </div>
);

export const IssueToSession = () => {
  const reduced = usePrefersReducedMotion();
  const { ref: viewRef, inView } = useToggleInView<HTMLDivElement>();
  const index = useCycle(ISSUES.length, 3600, inView && !reduced);
  const active = ISSUES[index];

  return (
    <div
      ref={viewRef}
      aria-hidden="true"
      className="grid w-full gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]"
    >
      <div className="rounded-xl border border-border-soft/70 bg-subtle/40 p-3">
        <div className="flex h-5 items-center justify-between text-[9.5px] text-muted-foreground">
          <span className="font-semibold uppercase tracking-[0.08em]">Issue inbox</span>
          <span className="tabular-nums">3 assigned to you</span>
        </div>
        <CycleBar beat={index} ms={3600} active={inView && !reduced} />
        <div className="mt-2 flex flex-col gap-1.5">
          {ISSUES.map((issue, i) => (
            <div
              key={issue.ref}
              className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 transition-colors ${
                i === index
                  ? 'border-primary/45 bg-primary/[0.07]'
                  : 'border-border-soft/50 bg-muted/25 opacity-70'
              }`}
            >
              <span className="mt-[3px] text-muted-foreground">
                <MarkGlyph mark={issue.mark} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-[9.5px] text-muted-foreground">
                  <span className="font-mono">{issue.ref}</span>
                  <span className="opacity-60">{issue.source}</span>
                </span>
                <span className="mt-0.5 line-clamp-1 block text-[11px] font-medium text-foreground/90">
                  {issue.title}
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col rounded-xl border border-border-soft/70 bg-subtle/40 p-3">
        <div className="flex h-5 items-center justify-between text-[9.5px] text-muted-foreground">
          <span className="font-semibold uppercase tracking-[0.08em]">New session</span>
          <span className="inline-flex items-center gap-1 font-mono">
            <MarkGlyph mark={active.mark} />
            {active.ref}
          </span>
        </div>

        <div key={active.ref} className="tg-fade mt-2 flex flex-1 flex-col gap-2">
          <Field label="Goal">{active.goal}</Field>
          <Field label="Branch">
            <span className="font-mono text-[10.5px]">{active.branch}</span>
          </Field>
          <div className="flex items-center gap-2 text-[9.5px] text-muted-foreground">
            <span className="chip chip-primary">worktree</span>
            <span>{active.carried}</span>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <span className="text-[9.5px] text-muted-foreground">acme-web</span>
          <span className="rounded-md bg-primary px-2.5 py-1 text-[10px] font-medium text-primary-foreground">
            Create session
          </span>
        </div>
      </div>
    </div>
  );
};
