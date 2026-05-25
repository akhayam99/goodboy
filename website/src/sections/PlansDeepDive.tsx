import { Section } from '../components/Section';

export function PlansDeepDive() {
  return (
    <Section
      id="plans"
      eyebrow="Plans"
      title={<>Plans are artifacts, not transcripts.</>}
      body={
        <>
          <p>
            Planner agents emit structured plans wrapped in{' '}
            <code className="font-mono text-[oklch(0.86_0.13_55)]">&lt;&lt;plan&gt;&gt;</code>{' '}
            markers. Goodboy lifts them out of the chat and stores them as first-class objects.
          </p>
          <p>
            Trees, statuses, references. A plan shows you what&apos;s active, what&apos;s consumed,
            what&apos;s been superseded. Downstream agents pick them up and execute. You see
            progress as it lands.
          </p>
          <p className="text-[oklch(0.78_0.01_255)] text-[14px]">
            No more scrolling through a 4,000-line conversation to find what was decided.
          </p>
        </>
      }
    >
      <PlanMockup />
    </Section>
  );
}

const tree = [
  { id: '1', text: 'Add history table & trigger', status: 'done', depth: 0 },
  { id: '1.1', text: 'Write migration 038_context_slot_history.sql', status: 'done', depth: 1 },
  { id: '1.2', text: 'Apply migration locally', status: 'done', depth: 1 },
  { id: '1.3', text: 'Add ON UPDATE trigger', status: 'done', depth: 1 },
  { id: '2', text: 'Write unit tests', status: 'active', depth: 0 },
  { id: '2.1', text: 'Fixture-backed history insert path', status: 'done', depth: 1 },
  { id: '2.2', text: 'Rollback test for trigger', status: 'active', depth: 1 },
  { id: '2.3', text: 'Pruning cron test', status: 'pending', depth: 1 },
  { id: '3', text: 'Wire UI revert affordance', status: 'pending', depth: 0 },
  { id: '3.1', text: 'Open question: v0.8 or v0.9?', status: 'blocked', depth: 1 },
];

const statusColors: Record<string, { dot: string; text: string }> = {
  done: {
    dot: 'bg-[oklch(0.69_0.13_148)]',
    text: 'text-[oklch(0.62_0.015_255)] line-through decoration-[oklch(0.50_0.015_255)]',
  },
  active: { dot: 'bg-[oklch(0.69_0.11_238)]', text: 'text-[oklch(0.92_0.006_90)]' },
  pending: { dot: 'bg-[oklch(0.45_0.015_255)]', text: 'text-[oklch(0.78_0.01_255)]' },
  blocked: { dot: 'bg-[oklch(0.76_0.13_78)]', text: 'text-[oklch(0.86_0.13_78)]' },
};

function PlanMockup() {
  return (
    <div className="rounded-xl border border-border-soft bg-subtle p-5 shadow-md">
      <div className="flex items-center justify-between pb-4 border-b border-border-soft">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md chip-merged">
            <svg width="14" height="14" viewBox="0 0 16 16">
              <path d="M3 3h10v10H3z" stroke="currentColor" strokeWidth="1.5" fill="none" />
              <path
                d="M5.5 6h5M5.5 8.5h5M5.5 11h3"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div>
            <div className="text-[13.5px] font-medium text-[oklch(0.92_0.006_90)]">
              Add history table for context_slots
            </div>
            <div className="text-[10.5px] text-[oklch(0.68_0.015_255)] font-mono">
              plan · drafted by planner · picked up by implementer
            </div>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded chip-info px-2 py-0.5 text-[10px]">
          <span className="h-1 w-1 rounded-full bg-current" />
          active
        </span>
      </div>
      <ul className="mt-4 space-y-1.5">
        {tree.map((n) => {
          const c = statusColors[n.status];
          return (
            <li
              key={n.id}
              className="flex items-start gap-2.5 text-[12.5px]"
              style={{ paddingLeft: `${n.depth * 18}px` }}
            >
              <span
                className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${c.dot} ${n.status === 'active' ? 'pulse' : ''}`}
              />
              <span className="font-mono text-[10px] text-[oklch(0.58_0.015_255)] mt-0.5 w-7 shrink-0">
                {n.id}
              </span>
              <span className={c.text}>{n.text}</span>
            </li>
          );
        })}
      </ul>
      <div className="mt-4 pt-3 border-t border-border-soft flex items-center justify-between text-[10.5px] text-muted-foreground">
        <span>Referenced by 3 sessions · 1 PR linked</span>
        <span className="font-mono">v2 · edited 4m ago</span>
      </div>
    </div>
  );
}
