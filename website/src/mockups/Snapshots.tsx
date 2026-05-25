/* Small, focused snapshots of real Goodboy desktop UI. Each one mirrors a
   single panel of apps/desktop/src/ at full fidelity: same Tailwind tokens,
   same font sizes (text-2xs = 11px, text-xs = 12px), same border radii, same
   density. Read as snapshots taken from a running session, not as marketing
   approximations.

   Source map:
   - SessionsSnapshot   <- features/workspace/components/SessionActivityBar
   - WorkflowSnapshot   <- features/plans/components/PlannerWidget +
                           features/workflow/components/WorkflowNextStepCta
   - ContextSnapshot    <- features/context/components/ContextPanel
   - PRSnapshot         <- features/github/components/* (PR row + diff comment)
*/

import type { ReactNode } from 'react';
import {
  IconArrowDown,
  IconArrowUp,
  IconBranch,
  IconCheck,
  IconClipboard,
  IconFolder,
  IconHelp,
  IconList,
  IconPlus,
  IconPullRequest,
  IconSparkles,
  IconTarget,
  IconTerminal,
} from '../components/Icons';

/* ---------------------------- tokens --------------------------------- */

/* The desktop's SessionActivityBar uses bg-muted/40 for inactive cards and
   bg-elevated for the active one. We mirror those literal classes here so a
   reader of the desktop source can spot the same structure. */

const KIND = {
  scout: { bg: 'bg-sky-400', label: 'scout' },
  plan: { bg: 'bg-violet-400', label: 'plan' },
  imple: { bg: 'bg-emerald-400', label: 'imple' },
  review: { bg: 'bg-cyan-400', label: 'review' },
  debug: { bg: 'bg-amber-400', label: 'debug' },
  test: { bg: 'bg-teal-400', label: 'test' },
} as const;

function KindBadge({ kind }: { kind: keyof typeof KIND }) {
  return (
    <span
      className={[
        'inline-flex shrink-0 items-center justify-center rounded px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide leading-none text-zinc-950',
        KIND[kind].bg,
      ].join(' ')}
    >
      {KIND[kind].label}
    </span>
  );
}

/* Shared frame used by every snapshot. Drops chrome dots, sits flush with
   the page surface (the page itself is the "app"), but keeps the border +
   shadow rhythm of the real desktop surface. */
function SnapshotFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={[
        'relative overflow-hidden rounded-xl border border-border-soft bg-[oklch(0.25_0.006_255)] shadow-md',
        className ?? '',
      ].join(' ')}
    >
      {children}
    </div>
  );
}

function FrameHeader({ label, right }: { label: string; right?: ReactNode }) {
  return (
    <div className="flex h-8 items-center justify-between gap-2 border-b border-border-soft bg-[oklch(0.27_0.008_255)] px-3">
      <span className="text-[10px] font-semibold uppercase tracking-[0.10em] text-muted-foreground">
        {label}
      </span>
      {right}
    </div>
  );
}

/* ---------------------------- Sessions -------------------------------- */

const SESSION_DATA = [
  {
    id: 'a',
    kind: 'plan' as const,
    goal: 'Audit reversions on context slots',
    cost: 0.41,
    state: 'active' as const,
  },
  {
    id: 'b',
    kind: 'imple' as const,
    goal: 'Add history table migration',
    cost: 0.18,
    state: 'running' as const,
  },
  {
    id: 'c',
    kind: 'review' as const,
    goal: 'Cleanup, tests, PR #617',
    cost: 0.09,
    state: 'pending' as const,
  },
  {
    id: 'd',
    kind: 'scout' as const,
    goal: 'Map all callsites of upsertSlot',
    cost: 0.03,
    state: 'idle' as const,
  },
  {
    id: 'e',
    kind: 'debug' as const,
    goal: 'Trigger fires twice on rollback',
    cost: 0.07,
    state: 'idle' as const,
    pr: 'draft' as const,
  },
];

/* Sessions rail snapshot. 112px wide rail like the real SessionActivityBar,
   plus a 200px section title strip on the left to anchor the composition on
   wide viewports. On narrow viewports the title collapses above the rail. */
export function SessionsSnapshot() {
  return (
    <SnapshotFrame className="max-w-[420px]">
      <FrameHeader
        label="Sessions"
        right={<span className="text-[10px] font-mono text-muted-foreground/70">5 active</span>}
      />
      <div className="flex">
        <div className="flex w-[112px] shrink-0 flex-col gap-1 border-r border-border-soft p-1.5">
          <button
            type="button"
            className="mb-0.5 inline-flex w-full items-center justify-center gap-1 rounded-md border border-border bg-muted/60 px-1 py-1.5 text-[10px] font-medium text-foreground transition-colors hover:bg-muted"
          >
            <IconPlus size={11} aria-hidden />
            New session
          </button>
          {SESSION_DATA.map((s) => (
            <SessionRailItem key={s.id} session={s} />
          ))}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.10em] text-muted-foreground">
              Active session
            </p>
            <p className="mt-1 text-[13px] font-semibold leading-snug text-foreground">
              Audit reversions on context slots
            </p>
          </div>
          <dl className="space-y-2 text-[11.5px]">
            <Meta label="Status" value="in progress" tone="text-warning" />
            <Meta label="Branch" value="ak/context-slot-history" mono />
            <Meta label="PR" value="#617 in review" tone="text-info" />
            <Meta label="Spend" value="$0.41" mono />
          </dl>
          <div className="mt-auto flex items-center justify-between border-t border-border-soft pt-2 text-[10px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-success" aria-hidden />
              All in sync
            </span>
            <span className="font-mono">12s ago</span>
          </div>
        </div>
      </div>
    </SnapshotFrame>
  );
}

function SessionRailItem({ session }: { session: (typeof SESSION_DATA)[number] }) {
  const isActive = session.state === 'active';
  const isRunning = session.state === 'running';
  const isPending = session.state === 'pending';
  return (
    <div
      className={[
        'flex w-full flex-col items-center gap-1 rounded border px-1 py-2 text-center',
        isActive
          ? 'border-border bg-elevated text-foreground shadow-sm'
          : isRunning
            ? 'animate-[pulse_2.4s_ease-in-out_infinite] border-info/40 bg-muted/40 text-foreground'
            : isPending
              ? 'border-warning/60 bg-muted/40 text-foreground'
              : 'border-transparent bg-muted/40 text-foreground/70',
      ].join(' ')}
    >
      <span className="flex items-center gap-1">
        <span className={['size-2.5 shrink-0 rounded-full', KIND[session.kind].bg].join(' ')} />
        {session.pr ? <IconPullRequest size={9} className="text-muted-foreground" /> : null}
      </span>
      <span className="line-clamp-2 w-full text-[10px] leading-tight">{session.goal}</span>
      {session.cost > 0 ? (
        <span className="font-mono text-[9px] tabular-nums text-muted-foreground/70">
          ${session.cost.toFixed(2)}
        </span>
      ) : null}
    </div>
  );
}

function Meta({
  label,
  value,
  tone,
  mono,
}: {
  label: string;
  value: string;
  tone?: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={[mono ? 'font-mono text-[11px]' : '', tone ?? 'text-foreground'].join(' ')}>
        {value}
      </dd>
    </div>
  );
}

/* ---------------------------- Workflow -------------------------------- */

const WORKFLOW_STEPS = [
  { kind: 'scout' as const, role: 'scout', name: 'Map callsites', state: 'done' as const },
  { kind: 'plan' as const, role: 'planner', name: 'Plan completion', state: 'done' as const },
  {
    kind: 'imple' as const,
    role: 'implementer',
    name: 'Implement restructure',
    state: 'active' as const,
  },
  {
    kind: 'review' as const,
    role: 'reviewer',
    name: 'Review & open PR',
    state: 'pending' as const,
  },
];

export function WorkflowSnapshot() {
  return (
    <SnapshotFrame className="max-w-[440px]">
      <FrameHeader
        label="Workflow"
        right={
          <span className="text-[10px] font-mono text-muted-foreground/70">
            scout → plan → imple → review
          </span>
        }
      />
      <div className="space-y-2.5 p-3">
        {WORKFLOW_STEPS.map((s, i) => (
          <WorkflowStep key={s.role} step={s} index={i} />
        ))}

        <button
          type="button"
          className="group mt-3 flex w-full items-center justify-between gap-2 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary transition-colors hover:border-primary hover:bg-primary/20"
          aria-label="Start reviewer (claude-sonnet-4-6, medium effort)"
        >
          <span className="flex items-center gap-1.5">
            <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden>
              <path
                d="M5 12h14M13 6l6 6-6 6"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-transform group-hover:translate-x-0.5"
              />
            </svg>
            <span className="font-semibold">Review &amp; open PR</span>
            <KindBadge kind="review" />
          </span>
          <span className="text-[10px] font-normal opacity-60">sonnet-4.6</span>
        </button>
      </div>
    </SnapshotFrame>
  );
}

function WorkflowStep({ step, index }: { step: (typeof WORKFLOW_STEPS)[number]; index: number }) {
  const done = step.state === 'done';
  const active = step.state === 'active';
  return (
    <div
      className={[
        'flex flex-col gap-1.5 rounded-md px-3 py-2.5',
        active ? 'bg-muted/50 ring-1 ring-primary/30' : 'bg-subtle',
      ].join(' ')}
    >
      <div className="flex items-center gap-2">
        <span
          className={[
            'inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold',
            done
              ? 'bg-success/15 text-success'
              : active
                ? 'bg-primary/15 text-primary'
                : 'bg-muted text-muted-foreground',
          ].join(' ')}
        >
          {done ? <IconCheck size={10} /> : index + 1}
        </span>
        <span className={['size-2 shrink-0 rounded-full', KIND[step.kind].bg].join(' ')} />
        <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-foreground">
          {step.name}
        </span>
        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
          {step.role}
        </span>
      </div>
      {active ? (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Running with <span className="font-mono text-foreground/80">claude-opus-4.5</span>{' '}
          &middot; medium effort &middot; 2 turns
        </p>
      ) : null}
    </div>
  );
}

/* ---------------------------- Context --------------------------------- */

const TABS = [
  { key: 'context', label: 'Context', icon: IconTarget, badge: null, active: true },
  { key: 'plans', label: 'Plans', icon: IconClipboard, badge: 2, active: false },
  { key: 'files', label: 'Files', icon: IconFolder, badge: 3, active: false },
  { key: 'github', label: 'GitHub', icon: IconPullRequest, badge: null, active: false },
  { key: 'terminal', label: 'Term', icon: IconTerminal, badge: null, active: false },
] as const;

const SLOTS = [
  {
    key: 'goal',
    label: 'Goal',
    icon: IconTarget,
    body: 'Add history table for context_slots so reversions are auditable. Preserve current write path.',
  },
  {
    key: 'decisions',
    label: 'Decisions',
    icon: IconList,
    body: 'Trigger on UPDATE, not application code. Retain 90 days. Prune nightly.',
  },
  {
    key: 'last_output_summary',
    label: 'Last output',
    icon: IconSparkles,
    body: 'Migration applied. Trigger fires on update. Tests green. Ready for review.',
  },
];

export function ContextSnapshot() {
  return (
    <SnapshotFrame className="max-w-[420px]">
      <div className="flex h-8 items-center gap-0.5 border-b border-border-soft bg-[oklch(0.27_0.008_255)] px-2">
        {TABS.map(({ key, ...rest }) => (
          <TabButton key={key} {...rest} />
        ))}
      </div>
      <div className="flex flex-col gap-2.5 p-3">
        {SLOTS.map(({ key, ...rest }) => (
          <SlotCard key={key} {...rest} />
        ))}
      </div>
      <div className="flex flex-col gap-2 border-t border-border-soft bg-subtle/30 px-3 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.10em] text-warning">
          Open questions
        </p>
        <p className="flex items-start gap-1.5 text-[11.5px] leading-relaxed text-foreground/85">
          <IconHelp size={11} className="mt-0.5 shrink-0 text-warning" />
          Should reverts be reachable from the UI in v0.8, or wait for the audit page in v0.9?
        </p>
      </div>
    </SnapshotFrame>
  );
}

function TabButton({
  label,
  icon: Icon,
  badge,
  active,
}: {
  label: string;
  icon: typeof IconTarget;
  badge: number | null;
  active: boolean;
}) {
  return (
    <button
      type="button"
      className={[
        'flex items-center gap-1 rounded px-1.5 py-1 text-[10.5px] font-medium transition-colors',
        active
          ? 'bg-muted text-foreground'
          : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
      ].join(' ')}
    >
      <Icon size={11} aria-hidden />
      <span>{label}</span>
      {badge ? (
        <span className="ml-0.5 inline-flex min-w-[1rem] items-center justify-center rounded-full bg-muted px-1 text-[9px] font-medium text-muted-foreground">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

function SlotCard({
  label,
  icon: Icon,
  body,
}: {
  label: string;
  icon: typeof IconTarget;
  body: string;
}) {
  return (
    <div className="rounded-md border border-border-soft bg-subtle p-2.5">
      <div className="flex items-center gap-1.5 pb-1">
        <Icon size={11} className="text-muted-foreground" aria-hidden />
        <span className="text-[10px] font-semibold uppercase tracking-[0.10em] text-muted-foreground">
          {label}
        </span>
      </div>
      <p className="text-[11.5px] leading-relaxed text-foreground/85">{body}</p>
    </div>
  );
}

/* ---------------------------- PR --------------------------------- */

export function PRSnapshot() {
  return (
    <SnapshotFrame className="max-w-[440px]">
      <FrameHeader
        label="GitHub"
        right={
          <span className="text-[10px] font-mono text-muted-foreground/70">last sync 12s ago</span>
        }
      />
      <div className="space-y-2.5 p-3">
        <PRRow
          num={617}
          title="feat(core): context_slot_history with rollback"
          branch="ak/context-slot-history"
          state="open"
          additions={142}
          deletions={18}
          checksPass={5}
          checksFail={0}
          reviews="claude-reviewer ✓ · human pending"
        />
        <PRRow
          num={616}
          title="fix(desktop): annotate sweep opts param"
          branch="ak/typecheck-fix"
          state="merged"
          additions={3}
          deletions={1}
          checksPass={6}
          checksFail={0}
          reviews="merged via squash"
        />

        <div className="mt-1 rounded-md border border-border-soft bg-subtle p-2.5">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="chip chip-anthropic">claude-reviewer</span>
            <span>on</span>
            <code className="font-mono text-[10px] text-primary">migrations/038…sql:14</code>
          </div>
          <p className="mt-2 text-[11.5px] leading-relaxed text-foreground/85">
            Add a composite index on{' '}
            <code className="font-mono text-[10.5px] text-warning">
              (slot_id, snapshot_at DESC)
            </code>{' '}
            if reverts need to scan history quickly.
          </p>
        </div>
      </div>
    </SnapshotFrame>
  );
}

function PRRow({
  num,
  title,
  branch,
  state,
  additions,
  deletions,
  checksPass,
  checksFail,
  reviews,
}: {
  num: number;
  title: string;
  branch: string;
  state: 'open' | 'merged' | 'draft';
  additions: number;
  deletions: number;
  checksPass: number;
  checksFail: number;
  reviews: string;
}) {
  const stateChip =
    state === 'merged'
      ? 'chip chip-merged'
      : state === 'draft'
        ? 'chip chip-warning'
        : 'chip chip-success';
  return (
    <div className="rounded-md border border-border-soft bg-subtle p-2.5">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[11px] text-muted-foreground">#{num}</span>
        <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-foreground">
          {title}
        </span>
        <span className={stateChip}>{state}</span>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] font-mono text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <IconBranch size={10} />
          <span className="truncate">{branch}</span>
        </span>
        <span className="inline-flex items-center gap-0.5 text-success">
          <IconArrowUp size={9} />
          {additions}
        </span>
        <span className="inline-flex items-center gap-0.5 text-danger">
          <IconArrowDown size={9} />
          {deletions}
        </span>
        <span className="inline-flex items-center gap-1">
          <span
            className={['size-1.5 rounded-full', checksFail > 0 ? 'bg-danger' : 'bg-success'].join(
              ' ',
            )}
          />
          {checksPass}/{checksPass + checksFail} checks
        </span>
      </div>
      <p className="mt-1 text-[10.5px] text-muted-foreground/80">{reviews}</p>
    </div>
  );
}

/* ---------------------------- Budget ----------------------------------- */

const BUDGETS = [
  {
    name: 'Anthropic',
    model: 'sonnet-4.6',
    spent: 144,
    cap: 250,
    color: 'oklch(0.74 0.15 55)',
  },
  {
    name: 'Cursor',
    model: 'cursor-default',
    spent: 48,
    cap: 150,
    color: 'oklch(0.70 0.16 290)',
  },
  {
    name: 'Codex',
    model: 'gpt-5-codex',
    spent: 21,
    cap: 150,
    color: 'oklch(0.72 0.16 150)',
  },
];

export function BudgetSnapshot() {
  return (
    <SnapshotFrame className="max-w-[440px]">
      <FrameHeader
        label="Budget · May 2026"
        right={<span className="chip chip-success">on track</span>}
      />
      <div className="space-y-2.5 p-3">
        {BUDGETS.map((b) => (
          <BudgetRow key={b.name} {...b} />
        ))}
        <div className="mt-1 flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-2.5">
          <svg width="12" height="12" viewBox="0 0 16 16" className="mt-0.5 shrink-0 text-warning">
            <path
              d="M8 2l6 11H2L8 2z"
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
              strokeLinejoin="round"
            />
            <path
              d="M8 7v3M8 11.5v.1"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          <p className="text-[11px] leading-relaxed text-foreground/85">
            <span className="font-semibold text-foreground">Threshold alert.</span> Anthropic at 58%
            with 13 days remaining. Switch to Cursor or Codex from the model picker.
          </p>
        </div>
      </div>
    </SnapshotFrame>
  );
}

function BudgetRow({
  name,
  model,
  spent,
  cap,
  color,
}: {
  name: string;
  model: string;
  spent: number;
  cap: number;
  color: string;
}) {
  const pct = Math.round((spent / cap) * 100);
  return (
    <div className="rounded-md border border-border-soft bg-subtle p-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ background: color }} aria-hidden />
          <span className="text-[12px] font-semibold text-foreground">{name}</span>
          <span className="font-mono text-[10px] text-muted-foreground">{model}</span>
        </div>
        <span className="font-mono text-[12px] tabular-nums" style={{ color }}>
          ${spent}
          <span className="text-muted-foreground/70"> / ${cap}</span>
        </span>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}
