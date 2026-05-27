/* Small, focused snapshots of real Goodboy desktop UI. Each one mirrors a
   single panel of apps/desktop/src/ at full fidelity: same Tailwind tokens,
   same font sizes (text-2xs = 11px, text-xs = 12px), same border radii, same
   density. Read as snapshots taken from a running session, not as marketing
   approximations.

   Source map:
   - SessionsSnapshot           <- features/workspace/components/SessionActivityBar
                                   + features/workspace/components/SessionDetailPanel
   - WorkflowStackSnapshot      <- WorkspacesSidebar AgentsSection (multi-workflow)
   - WorkflowSnapshot           <- features/workflows/components/WorkflowsPanel +
                                   features/workflows/components/WorkflowNextStepCta
   - ContextSnapshot            <- features/context/components/ContextPanel
   - ChatHeaderSnapshot         <- features/chat/components/ChatBreadcrumb
   - AgentPickerSnapshot        <- features/quick-actions/QuickActionsPopover
   - NewSessionLinearSnapshot   <- features/session/components/NewSessionDialog
                                   with features/integrations/linear/IssuePicker
   - PRSnapshot                 <- features/github/components/* (PR row + diff comment)
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
import { AgentAvatar, KIND_LABEL, type AgentKind } from '../components/AgentAvatar';

/* ---------------------------- tokens --------------------------------- */

/* The desktop's SessionActivityBar uses bg-muted/40 for inactive cards and
   bg-elevated for the active one. We mirror those literal classes here so a
   reader of the desktop source can spot the same structure. */

/* Same palette + short labels as apps/desktop/src/features/session/agent-kind.ts
   AGENT_KIND_PALETTE. Local `kind` keys here are the short forms used in chip
   labels (`plan` for the `planner` kind, `imple` for `implementer`, etc.) so
   the rendered text matches the real UI exactly. */
const KIND = {
  scout: { bg: 'bg-sky-400', label: 'scout', kind: 'scout' as AgentKind },
  plan: { bg: 'bg-violet-400', label: 'plan', kind: 'planner' as AgentKind },
  imple: { bg: 'bg-emerald-400', label: 'imple', kind: 'implementer' as AgentKind },
  review: { bg: 'bg-cyan-400', label: 'review', kind: 'reviewer' as AgentKind },
  debug: { bg: 'bg-amber-400', label: 'debug', kind: 'debugger' as AgentKind },
  test: { bg: 'bg-teal-400', label: 'test', kind: 'tester' as AgentKind },
  docs: { bg: 'bg-orange-400', label: 'docs', kind: 'docs' as AgentKind },
  generic: { bg: 'bg-rose-400', label: 'agent', kind: 'generic' as AgentKind },
} as const;

/* Apps/desktop AgentKindChip pattern: width-locked colored pill with a tiny
   silhouette of the role's dog on the left, label on the right. Mirrors the
   exact 60px width used in the product sidebar. */
function KindBadge({ kind }: { kind: keyof typeof KIND }) {
  const k = KIND[kind];
  return (
    <span
      className={[
        'inline-flex w-[3.75rem] shrink-0 items-center justify-center gap-1 rounded py-0.5 pl-1 pr-1.5 text-[9px] font-semibold uppercase leading-none tracking-wide text-zinc-950',
        k.bg,
      ].join(' ')}
    >
      <AgentAvatar kind={k.kind} size={10} tint="bg-zinc-950/80" />
      <span>{k.label}</span>
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

type SessionKind = keyof typeof KIND;

interface SessionMock {
  readonly id: string;
  readonly kind: SessionKind;
  readonly goal: string;
  readonly cost: number;
  readonly state: 'active' | 'running' | 'pending' | 'idle';
  readonly linearId?: string;
  readonly pr?: 'draft' | 'open' | 'merged';
}

const SESSION_DATA: ReadonlyArray<SessionMock> = [
  {
    id: 'a',
    kind: 'plan',
    goal: 'Audit reversions on context slots',
    cost: 0.41,
    state: 'active',
    linearId: 'GRW-628',
  },
  {
    id: 'b',
    kind: 'imple',
    goal: 'Add history table migration',
    cost: 0.18,
    state: 'running',
  },
  {
    id: 'c',
    kind: 'review',
    goal: 'Cleanup, tests, PR #617',
    cost: 0.09,
    state: 'pending',
  },
  {
    id: 'd',
    kind: 'scout',
    goal: 'Map all callsites of upsertSlot',
    cost: 0.03,
    state: 'idle',
  },
  {
    id: 'e',
    kind: 'docs',
    goal: 'Document the history table API',
    cost: 0.02,
    state: 'idle',
    linearId: 'GRW-631',
  },
  {
    id: 'f',
    kind: 'debug',
    goal: 'Trigger fires twice on rollback',
    cost: 0.07,
    state: 'idle',
    pr: 'draft',
  },
];

/* Sessions snapshot. Faithful slice of WorkspacesSidebar:
     [ w-28 rail  |  divider  |  detail panel ]
   The detail panel shows the same things the real product shows: a status
   icon next to the title, a list of agent rows with kind chip + token/turn/
   cost line, and a footer that pairs the branch chip with the session cost
   chip. No "ACTIVE SESSION / Status / Branch / PR / Spend" label-value list
   — that's marketing UI, not product UI.
*/
export function SessionsSnapshot() {
  return (
    <SnapshotFrame className="max-w-[460px]">
      <div className="flex">
        {/* w-28 rail */}
        <div className="flex w-[112px] shrink-0 flex-col gap-1 p-1.5">
          <div className="mb-0.5 mt-0.5 flex items-center justify-between gap-1 pl-1 pr-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Sessions
            </span>
          </div>
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

        {/* hairline divider, exactly like the real WorkspacesSidebar. */}
        <div
          aria-hidden
          className="my-1 ml-1.5 w-px shrink-0 bg-gradient-to-b from-transparent via-border-soft via-30% to-transparent"
        />

        {/* detail panel: header + agents + footer (mirror SessionDetailPanel) */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* header: status icon + title + linear chip + overflow menu */}
          <div className="flex shrink-0 items-center gap-2 px-3 pt-3 pb-2">
            <span
              aria-hidden
              className="inline-flex size-[18px] shrink-0 items-center justify-center rounded text-warning"
              title="in progress"
            >
              <ConstructionIcon size={13} />
            </span>
            <span className="line-clamp-2 min-w-0 flex-1 text-[12px] font-semibold leading-snug text-foreground">
              Audit reversions on context slots
            </span>
            <a
              href="#linear"
              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[#5e6ad2]/30 bg-[#5e6ad2]/5 px-1.5 py-0.5 font-mono text-[10px] font-medium text-[#5e6ad2]"
              title="open GRW-628 in Linear"
            >
              GRW-628
            </a>
            <span aria-hidden className="shrink-0 text-muted-foreground/50" title="session actions">
              <DotsVerticalIcon size={13} />
            </span>
          </div>

          {/* agent rows */}
          <div className="flex flex-1 flex-col gap-1.5 overflow-hidden px-3 pb-1">
            <AgentRow
              num={1}
              kind="scout"
              name="scout-callsites"
              tokensIn="1.2k"
              tokensOut="240"
              turns={3}
              cost="$0.04"
              age="12m"
            />
            <AgentRow
              num={2}
              kind="plan"
              name="plan-completion"
              tokensIn="3.1k"
              tokensOut="890"
              turns={5}
              cost="$0.12"
              age="4m"
            />
            <AgentRow
              num={3}
              kind="imple"
              name="imple-restructure"
              tokensIn="4.5k"
              tokensOut="1.1k"
              turns={9}
              cost="$0.18"
              age="42s"
              running
              selected
            />
          </div>

          {/* footer: branch chip + cost chip (SessionMetaFooter) */}
          <div className="mt-auto flex shrink-0 items-center gap-2 px-3 pt-2 pb-3">
            <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 truncate rounded-md border border-border-soft bg-muted/30 px-2 py-1 font-mono text-[10px] text-foreground/80">
              <IconBranch size={10} aria-hidden className="shrink-0 text-muted-foreground" />
              <span className="truncate">ak/context-slot-history</span>
            </span>
            <span className="ml-auto inline-flex shrink-0 items-center rounded-md border border-success/20 bg-success/10 px-2 py-1 font-mono text-[10px] tabular-nums text-success">
              $0.34
            </span>
          </div>
        </div>
      </div>
    </SnapshotFrame>
  );
}

function SessionRailItem({ session }: { session: SessionMock }) {
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
        <AgentAvatar kind={KIND[session.kind].kind} size={12} />
        {session.linearId ? <LinearIdChip id={session.linearId} /> : null}
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

function LinearIdChip({ id }: { id: string }) {
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-sm border border-[#5e6ad2]/40 bg-[#5e6ad2]/10 px-1 py-px font-mono text-[8px] font-medium text-[#5e6ad2]"
      title={`linear: ${id}`}
    >
      {id}
    </span>
  );
}

function AgentRow({
  num,
  kind,
  name,
  tokensIn,
  tokensOut,
  turns,
  cost,
  age,
  running,
  selected,
}: {
  num: number;
  kind: keyof typeof KIND;
  name: string;
  tokensIn: string;
  tokensOut: string;
  turns: number;
  cost: string;
  age: string;
  running?: boolean;
  selected?: boolean;
}) {
  return (
    <div
      className={[
        'group flex flex-col gap-1 rounded border px-2 py-1.5 transition-colors',
        selected
          ? running
            ? 'spin-border-info border-transparent bg-elevated'
            : 'border-border bg-elevated'
          : 'border-transparent bg-muted/40',
      ].join(' ')}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="w-4 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground/60"
        >
          {num}.
        </span>
        <KindBadge kind={kind} />
        <span className="min-w-0 flex-1 truncate text-[11.5px] text-foreground">{name}</span>
      </div>
      <div className="flex items-center gap-1.5 whitespace-nowrap pl-6 text-[10px] tabular-nums text-muted-foreground/80">
        <span className="inline-flex items-baseline gap-0.5">
          <span aria-hidden className="text-muted-foreground/60">
            ↓
          </span>
          {tokensIn}
        </span>
        <span className="inline-flex items-baseline gap-0.5">
          <span aria-hidden className="text-muted-foreground/60">
            ↑
          </span>
          {tokensOut}
        </span>
        <span aria-hidden className="text-muted-foreground/40">
          ·
        </span>
        <span>{turns}t</span>
        <span aria-hidden className="text-muted-foreground/40">
          ·
        </span>
        <span className="font-mono">{cost}</span>
        <span aria-hidden className="text-muted-foreground/40">
          ·
        </span>
        <span className="font-mono text-muted-foreground/80">{age}</span>
      </div>
    </div>
  );
}

function ConstructionIcon({ size = 13 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2" y="6" rx="2" width="20" height="8" />
      <path d="M17 14v7" />
      <path d="M7 14v7" />
      <path d="M17 3v3" />
      <path d="M7 3v3" />
      <path d="M10 14 2.3 6.3" />
      <path d="m14 6 7.7 7.7" />
      <path d="m8 6 8 8" />
    </svg>
  );
}

function DotsVerticalIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="12" cy="5" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="12" cy="19" r="1.6" />
    </svg>
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
          Should reverts be reachable from the UI in v0.0.8, or wait for the audit page in v0.0.9?
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

/* ---------------------------- Session cost --------------------------- */

/* Mirrors apps/desktop/src/features/providers/components/CostBadge +
   TelemetryPill. Each turn carries an estimated cost; the session-level
   total ticks live in the chip strip. No monthly caps, no threshold alerts:
   only what the product actually surfaces today. */

const TURNS = [
  {
    who: 'You',
    model: null,
    kind: 'plan' as const,
    body: 'Audit reversions on context slots.',
    cost: null,
  },
  {
    who: 'Plan',
    model: 'claude-sonnet-4.6',
    kind: 'plan' as const,
    body: '4 steps drafted. Trigger on UPDATE.',
    cost: 0.071,
  },
  {
    who: 'Implement',
    model: 'claude-opus-4.5',
    kind: 'imple' as const,
    body: 'Migration 038 applied. Trigger fires.',
    cost: 0.142,
  },
  {
    who: 'Review',
    model: 'gpt-5-codex',
    kind: 'review' as const,
    body: 'Composite index suggested. PR opened.',
    cost: 0.198,
  },
];

export function BudgetSnapshot() {
  const total = TURNS.reduce((s, t) => s + (t.cost ?? 0), 0);
  return (
    <SnapshotFrame className="max-w-[440px]">
      <FrameHeader
        label="Session cost"
        right={
          <span className="inline-flex items-baseline gap-0.5 font-mono text-[11px] tabular-nums text-foreground">
            <span>$0</span>
            <span className="opacity-70">.{total.toFixed(2).split('.')[1]}</span>
          </span>
        }
      />
      <div className="space-y-2 p-3">
        {TURNS.map((t, i) => (
          <TurnRow key={i} turn={t} />
        ))}
        <div className="mt-1 flex items-center justify-between rounded-md border border-border-soft bg-subtle px-2.5 py-2 text-[10.5px]">
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <span className="size-1.5 rounded-full bg-success" aria-hidden />
            Session soft cap
          </span>
          <span className="font-mono text-[11px] text-foreground">
            ${total.toFixed(2)}
            <span className="text-muted-foreground"> / $2.00</span>
          </span>
        </div>
      </div>
    </SnapshotFrame>
  );
}

function TurnRow({ turn }: { turn: (typeof TURNS)[number] }) {
  return (
    <div className="rounded-md border border-border-soft bg-subtle p-2.5">
      <div className="flex items-center gap-2">
        {turn.model ? (
          <KindBadge kind={turn.kind} />
        ) : (
          <span className="rounded bg-muted px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
            you
          </span>
        )}
        <span className="min-w-0 flex-1 truncate text-[11.5px] text-foreground/85">
          {turn.body}
        </span>
        {turn.cost != null ? (
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            ${turn.cost.toFixed(3)}
          </span>
        ) : null}
      </div>
      {turn.model ? (
        <p className="mt-1 pl-1 font-mono text-[10px] text-muted-foreground/70">{turn.model}</p>
      ) : null}
    </div>
  );
}

/* ---------------------------- Chat header ---------------------------- */

/* Mirror of features/chat/components/ChatBreadcrumb. Path-on-the-left,
   dog-on-the-right pattern: workspace > session > workflow chip on the left,
   a quiet role avatar pinned to the right so the user always knows which
   kind of agent they are talking to. */
export function ChatHeaderSnapshot() {
  return (
    <SnapshotFrame className="max-w-[520px]">
      <div className="flex h-9 items-center gap-1.5 border-b border-border-soft bg-[oklch(0.27_0.008_255)] px-3 text-[11px]">
        <span className="font-medium text-muted-foreground">app-web</span>
        <Chevron />
        <span className="font-medium text-muted-foreground">refactor tests focus</span>
        <Chevron />
        <span className="inline-flex shrink-0 items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
          <IconBranch size={9} />
          <span>Clinical Bond Test Refactor</span>
          <span aria-hidden className="opacity-60">
            ·
          </span>
          <span className="font-mono tabular-nums">1/3</span>
        </span>
        <Chevron />
        <span className="font-medium text-foreground/90">Map Test Files</span>
        <div className="flex-1" />
        <AgentAvatar kind="scout" size={20} />
      </div>
      <div className="flex items-center justify-center px-6 py-12 text-center">
        <p className="max-w-[26ch] text-[12px] leading-relaxed text-muted-foreground">
          Path on the left.
          <br />
          The dog on the right is the agent driving this turn.
        </p>
      </div>
    </SnapshotFrame>
  );
}

function Chevron() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="shrink-0 text-muted-foreground/40"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

/* ---------------------------- Agent picker --------------------------- */

/* Mirror of QuickActionsPopover with the agent action set. Each row carries
   the agent name on the left and a role badge + dog avatar on the right, so
   even custom-named agents stay legible. Triggered by typing @ in the
   composer. */
const PICKER_AGENTS: ReadonlyArray<{
  readonly name: string;
  readonly status: 'pending' | 'running' | 'completed';
  readonly kind: AgentKind;
}> = [
  { name: 'scout-callsites', status: 'completed', kind: 'scout' },
  { name: 'come stai?', status: 'running', kind: 'planner' },
  { name: 'plan-completion', status: 'completed', kind: 'planner' },
  { name: 'imple-restructure', status: 'running', kind: 'implementer' },
  { name: 'review-pr-617', status: 'pending', kind: 'reviewer' },
  { name: 'docs-history-api', status: 'pending', kind: 'docs' },
];

export function AgentPickerSnapshot() {
  return (
    <SnapshotFrame className="max-w-[520px]">
      <FrameHeader
        label="@ agents"
        right={
          <span className="font-mono text-[10px] text-muted-foreground/70">
            ↑↓ to nav · ↵ to pick
          </span>
        }
      />
      <ul className="divide-y divide-border-soft/40">
        {PICKER_AGENTS.map((agent, i) => (
          <li
            key={agent.name}
            className={[
              'flex items-center gap-3 px-3 py-2',
              i === 1 ? 'bg-muted/60' : 'hover:bg-muted/40',
            ].join(' ')}
          >
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-[12px] font-medium text-foreground">{agent.name}</span>
              <span className="text-[10px] text-muted-foreground">{agent.status}</span>
            </div>
            <span className="flex shrink-0 items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              <span>{KIND_LABEL[agent.kind]}</span>
              <AgentAvatar kind={agent.kind} size={14} />
            </span>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2 border-t border-border-soft bg-[oklch(0.22_0.005_255)] px-3 py-2">
        <span className="font-mono text-[12px] text-foreground">@</span>
        <span className="text-[11px] text-muted-foreground/60">type to filter agents…</span>
      </div>
    </SnapshotFrame>
  );
}

/* ---------------------------- New session + Linear ----------------- */

/* Mirror of features/session/components/NewSessionDialog when a workspace
   has the Linear integration. Picking a Linear issue auto-fills the goal,
   derives a kebab branch slug, and tags the resulting session with the
   issue identifier so it shows up in the rail above. */
export function NewSessionLinearSnapshot() {
  return (
    <SnapshotFrame className="max-w-[560px]">
      <div className="flex items-start gap-3 border-b border-border-soft bg-[oklch(0.27_0.008_255)] px-4 pt-3 pb-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.10em] text-muted-foreground">
            New session
          </span>
          <span className="text-[12px] text-muted-foreground/80">
            Creates a fresh worktree on a new branch. Set up a workflow next.
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-5 p-4">
        {/* Linear section */}
        <SectionRow
          icon={<LinearMark />}
          title="Linear issue"
          subtitle="Auto-fills the goal from the title and description."
        >
          <div className="flex items-center gap-2 rounded-md border border-[#5e6ad2]/30 bg-[#5e6ad2]/5 px-2.5 py-2 text-[12px]">
            <span className="inline-flex shrink-0 items-center rounded-sm bg-[#5e6ad2]/15 px-1.5 py-0.5 font-mono text-[10px] font-medium text-[#5e6ad2]">
              GRW-628
            </span>
            <span className="min-w-0 flex-1 truncate text-foreground/90">
              Audit context_slots reversions
            </span>
            <span className="shrink-0 text-[10px] text-muted-foreground">In Progress</span>
          </div>
        </SectionRow>

        {/* Goal */}
        <SectionRow
          icon={<TargetMark />}
          title="Goal"
          subtitle="What this session should accomplish. Be specific. This is the agent's primary context."
        >
          <div className="rounded-md border border-border-soft bg-subtle px-3 py-2 text-[12px] leading-relaxed text-foreground/90">
            Add a history table for context_slots so reversions are auditable. Preserve current
            write path.
          </div>
        </SectionRow>

        {/* Branch */}
        <SectionRow
          icon={<BranchMark />}
          title="Branch"
          subtitle="Worktree branch. Slug auto-derived from the goal."
        >
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-md border border-border-soft bg-subtle px-2 py-1 font-mono text-[11px] text-foreground/80">
              <span className="text-muted-foreground/70">ak/</span>
              <span>context-slot-history</span>
            </span>
            <span className="text-[10px] text-muted-foreground">new branch off main</span>
          </div>
        </SectionRow>

        {/* Footer */}
        <div className="-mx-4 -mb-4 mt-1 flex items-center gap-3 border-t border-border-soft bg-[oklch(0.22_0.005_255)] px-4 py-2.5 text-[11px]">
          <label className="inline-flex items-center gap-1.5 text-muted-foreground">
            <span className="inline-flex size-3 items-center justify-center rounded-sm border border-primary bg-primary/30">
              <IconCheck size={8} className="text-primary" />
            </span>
            Set up workflow next
          </label>
          <span className="flex-1" />
          <span className="rounded-md px-2 py-1 text-muted-foreground">Cancel</span>
          <span className="rounded-md bg-primary px-3 py-1 text-[11.5px] font-semibold text-primary-foreground">
            Create session
          </span>
        </div>
      </div>
    </SnapshotFrame>
  );
}

function SectionRow({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-[11px] font-semibold uppercase tracking-[0.10em] text-foreground">
          {title}
        </span>
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">{subtitle}</p>
      {children}
    </div>
  );
}

function LinearMark() {
  return (
    <span
      aria-hidden
      className="inline-flex size-4 items-center justify-center rounded-sm bg-[#5e6ad2] font-bold text-[10px] text-white"
    >
      L
    </span>
  );
}

function TargetMark() {
  return <IconTarget size={13} className="text-primary" />;
}

function BranchMark() {
  return <IconBranch size={13} className="text-primary" />;
}

/* ---------------------------- Multi-workflow stack ------------------- */

/* Mirror of WorkspacesSidebar AgentsSection when a session has two workflow
   blocks attached. Each block lists its steps (with the per-step agent role
   chip) and shows the "Attach another workflow" affordance below. The whole
   stack lives in a single session: workflows are 1-to-many, not 1-to-1. */
const STACK_WORKFLOWS = [
  {
    name: 'Clinical Bond Test Refactor',
    progress: '2/3',
    custom: true,
    steps: [
      {
        kind: 'scout' as const,
        name: 'Map Test Files',
        state: 'done' as const,
        model: 'haiku-4-5',
      },
      {
        kind: 'imple' as const,
        name: 'Propose Refactor Strategy',
        state: 'active' as const,
        model: 'sonnet-4-5',
      },
      {
        kind: 'imple' as const,
        name: 'Implement Agreed Changes',
        state: 'pending' as const,
        model: 'sonnet-4-5',
      },
    ],
  },
  {
    name: 'Cleanup follow-up',
    progress: '0/3',
    custom: true,
    steps: [
      {
        kind: 'generic' as const,
        name: 'Locate & Analyze',
        state: 'pending' as const,
        model: 'haiku-4-5',
      },
      {
        kind: 'plan' as const,
        name: 'Plan Refactor',
        state: 'pending' as const,
        model: 'opus-4-7',
      },
      {
        kind: 'imple' as const,
        name: 'Implement Refactor',
        state: 'pending' as const,
        model: 'sonnet-4-5',
      },
    ],
  },
];

export function WorkflowStackSnapshot() {
  return (
    <SnapshotFrame className="max-w-[440px]">
      <FrameHeader
        label="refactor tests focus"
        right={
          <span className="font-mono text-[10px] text-muted-foreground/70">
            {STACK_WORKFLOWS.length} workflows · 1 session
          </span>
        }
      />
      <div className="space-y-4 p-3">
        {STACK_WORKFLOWS.map((wf) => (
          <WorkflowBlock key={wf.name} workflow={wf} />
        ))}
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded border border-dashed border-border-soft px-2 py-1.5 text-left text-[11px] text-muted-foreground transition-colors hover:border-border hover:bg-muted/40 hover:text-foreground"
        >
          <IconPlus size={11} />
          Attach another workflow
        </button>
      </div>
    </SnapshotFrame>
  );
}

function WorkflowBlock({ workflow }: { workflow: (typeof STACK_WORKFLOWS)[number] }) {
  return (
    <div>
      <div className="flex items-center gap-2 pb-2">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          <IconBranch size={10} className="text-primary" />
          Workflow
        </span>
        <span className="font-mono text-[10px] text-muted-foreground/60">
          {workflow.custom ? 'custom' : 'preset'}
        </span>
        <span className="ml-auto inline-flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span className="font-mono tabular-nums">{workflow.progress}</span>
        </span>
      </div>
      <div className="flex flex-col gap-1">
        {workflow.steps.map((s, i) => (
          <StackStepRow key={i} index={i + 1} step={s} />
        ))}
      </div>
    </div>
  );
}

function StackStepRow({
  index,
  step,
}: {
  index: number;
  step: (typeof STACK_WORKFLOWS)[number]['steps'][number];
}) {
  const done = step.state === 'done';
  const active = step.state === 'active';
  return (
    <div
      className={[
        'flex items-center gap-2 rounded px-2 py-1.5 text-[11px]',
        active ? 'bg-muted/60 ring-1 ring-primary/30' : 'bg-subtle',
      ].join(' ')}
    >
      <span
        className={[
          'inline-flex size-4 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold',
          done
            ? 'bg-success/20 text-success'
            : active
              ? 'bg-primary/20 text-primary'
              : 'bg-muted text-muted-foreground/70',
        ].join(' ')}
      >
        {done ? <IconCheck size={9} /> : index}
      </span>
      <KindBadge kind={step.kind} />
      <span className="min-w-0 flex-1 truncate font-medium text-foreground/90">{step.name}</span>
      <span className="shrink-0 font-mono text-[10px] text-muted-foreground/70">{step.model}</span>
    </div>
  );
}
