import { Section } from '../components/Section';

export function ContextDeepDive() {
  return (
    <Section
      id="context"
      eyebrow="Shared context"
      title={
        <>
          <span className="gradient-text">A scratchpad that survives</span>{' '}
          <span className="gradient-text-accent">the next agent.</span>
        </>
      }
      body={
        <>
          <p>
            Every new chat starts from scratch. Goodboy doesn&apos;t. Five context slots (goal,
            decisions, files touched, open questions, last output) sit outside the transcript and
            persist across agents.
          </p>
          <p>
            A cheap summarizer updates them after each turn. You can edit them by hand at any time.
            When you spawn a reviewer agent in a new provider, it reads the same notes the
            implementer wrote.
          </p>
          <p className="text-[oklch(0.78_0.01_255)] text-[14px]">
            No re-explaining. No copy-paste between windows. No drift between agents on the same
            goal.
          </p>
        </>
      }
    >
      <ContextMockup />
    </Section>
  );
}

function ContextMockup() {
  return (
    <div className="card-glow p-5">
      <div className="flex items-center justify-between pb-4 border-b border-[oklch(0.36_0.012_255)]">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-[oklch(0.58_0.015_255)]">
            Session context
          </div>
          <div className="text-[13px] font-mono text-[oklch(0.92_0.006_90)]">
            context-slot-history
          </div>
        </div>
        <div className="text-[10.5px] text-[oklch(0.68_0.015_255)] flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-[oklch(0.69_0.13_148)]" />5 of 5 slots
          written
        </div>
      </div>
      <div className="mt-4 space-y-2.5">
        <Slot label="Goal" tone="primary">
          Add history table for{' '}
          <code className="font-mono text-[oklch(0.86_0.13_55)]">context_slots</code> so reversions
          are auditable. Preserve current write path.
        </Slot>
        <Slot label="Decisions" tone="anthropic">
          <ul className="space-y-1">
            <li className="flex gap-2">
              <span className="text-[oklch(0.86_0.13_55)] mt-px">·</span>history table mirrors slot
              schema with <code className="font-mono">snapshot_at</code>
            </li>
            <li className="flex gap-2">
              <span className="text-[oklch(0.86_0.13_55)] mt-px">·</span>trigger on UPDATE, not
              application code
            </li>
            <li className="flex gap-2">
              <span className="text-[oklch(0.86_0.13_55)] mt-px">·</span>retain 90 days, prune via
              nightly cron
            </li>
          </ul>
        </Slot>
        <Slot label="Files touched" tone="info">
          <ul className="font-mono text-[11.5px] space-y-0.5 text-[oklch(0.86_0.008_90)]">
            <li>packages/db/migrations/038_context_slot_history.sql</li>
            <li>packages/core/context/history.ts</li>
            <li>packages/core/context/__tests__/history.test.ts</li>
          </ul>
        </Slot>
        <Slot label="Open questions" tone="warning">
          Should reverts be reachable from the UI in v0.8, or wait for the audit page in v0.9?
        </Slot>
        <Slot label="Last output" tone="success">
          Migration applied. Trigger fires on update. Tests green. Ready for review.
        </Slot>
      </div>
      <div className="mt-4 flex items-center justify-between text-[10.5px] text-[oklch(0.68_0.015_255)]">
        <span>Auto-summarized after each turn · 412 tokens · $0.0021</span>
        <button className="rounded border border-[oklch(0.40_0.012_255)] px-2 py-0.5 hover:bg-[oklch(0.30_0.010_255)]">
          Edit
        </button>
      </div>
    </div>
  );
}

const toneMap: Record<string, string> = {
  primary: 'oklch(0.78 0.13 200)',
  anthropic: 'oklch(0.74 0.15 55)',
  info: 'oklch(0.69 0.11 238)',
  warning: 'oklch(0.76 0.13 78)',
  success: 'oklch(0.69 0.13 148)',
};

function Slot({
  label,
  tone,
  children,
}: {
  label: string;
  tone: keyof typeof toneMap;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[oklch(0.36_0.012_255)] bg-[oklch(0.22_0.007_255)] p-3 relative overflow-hidden">
      <span
        className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r"
        style={{ background: toneMap[tone] }}
      />
      <div className="pl-3">
        <div className="text-[10px] uppercase tracking-[0.12em] text-[oklch(0.58_0.015_255)] mb-1.5">
          {label}
        </div>
        <div className="text-[12.5px] leading-relaxed text-[oklch(0.88_0.008_90)]">{children}</div>
      </div>
    </div>
  );
}
