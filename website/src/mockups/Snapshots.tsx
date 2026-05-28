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

import { useState, type ReactNode } from 'react';
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

/* One coherent product story used across every mockup: a developer ships a
   password-reset flow. The ticket comes from Linear (AUTH-142), the branch
   is ak/password-reset, the agents that run on it are scout/plan/implement,
   the PR opens for review. Each surface (rail, breadcrumb, context, plans,
   PR) shows a slice of the same work so the page reads as one tour, not a
   loose collection of screenshots. */
const SESSION_DATA: ReadonlyArray<SessionMock> = [
  {
    id: 'a',
    kind: 'imple',
    goal: 'Add password reset via email link',
    cost: 0.34,
    state: 'active',
    linearId: 'AUTH-142',
  },
  {
    id: 'b',
    kind: 'debug',
    goal: 'Fix flaky checkout webhook test',
    cost: 0.18,
    state: 'running',
    linearId: 'PAY-77',
  },
  {
    id: 'c',
    kind: 'review',
    goal: 'Review PR #214 (rate limiter)',
    cost: 0.09,
    state: 'pending',
  },
  {
    id: 'd',
    kind: 'scout',
    goal: 'Map every place we send transactional email',
    cost: 0.03,
    state: 'idle',
  },
  {
    id: 'e',
    kind: 'docs',
    goal: 'Document the new password-reset endpoint',
    cost: 0.02,
    state: 'idle',
    linearId: 'AUTH-149',
  },
  {
    id: 'f',
    kind: 'plan',
    goal: 'Plan the migration off legacy session cookies',
    cost: 0.07,
    state: 'idle',
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
              Add password reset via email link
            </span>
            <a
              href="#linear"
              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[#5e6ad2]/30 bg-[#5e6ad2]/5 px-1.5 py-0.5 font-mono text-[10px] font-medium text-[#5e6ad2]"
              title="open AUTH-142 in Linear"
            >
              AUTH-142
            </a>
            <span
              className="relative inline-flex shrink-0 items-center text-muted-foreground/80"
              title="session actions"
            >
              <span className="rounded bg-foreground/10 p-0.5">
                <DotsVerticalIcon size={13} />
              </span>
              <SessionActionsMenu />
            </span>
          </div>

          {/* agent rows */}
          <div className="flex flex-col gap-1.5 px-3 pb-1">
            <AgentRow
              num={1}
              kind="scout"
              name="locate auth surface"
              tokensIn="1.2k"
              tokensOut="240"
              turns={3}
              cost="$0.04"
              age="14m"
            />
            <AgentRow
              num={2}
              kind="plan"
              name="design reset flow"
              tokensIn="3.1k"
              tokensOut="890"
              turns={5}
              cost="$0.12"
              age="6m"
            />
            <AgentRow
              num={3}
              kind="imple"
              name="build endpoint + email"
              tokensIn="4.5k"
              tokensOut="1.1k"
              turns={9}
              cost="$0.18"
              age="48s"
              running
              selected
            />
          </div>

          {/* footer: branch chip + PR chip + cost chip */}
          <div className="mt-auto flex shrink-0 items-center gap-1.5 px-3 pt-2 pb-3">
            <span className="inline-flex min-w-0 items-center gap-1.5 truncate rounded-md border border-border-soft bg-muted/30 px-2 py-1 font-mono text-[10px] text-foreground/80">
              <IconBranch size={10} aria-hidden className="shrink-0 text-muted-foreground" />
              <span className="truncate">ak/password-reset</span>
            </span>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-success/30 bg-success/10 px-1.5 py-1 font-mono text-[10px] text-success">
              <span className="size-1.5 rounded-full bg-success" aria-hidden />
              PR #214
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

/* Action menu mock that hangs below the ⋮ trigger in the session detail
   header. Mirrors apps/desktop/src/shared/components/OverflowMenu items as
   wired from SessionDetailPanel: detected editors first, scripts next, then
   settings + end session. Renders open so the reader sees what is collapsed
   behind the dots in the real product. */
function SessionActionsMenu() {
  return (
    <div className="absolute right-0 top-full z-10 mt-1 w-44 overflow-hidden rounded-md border border-border bg-muted text-[10.5px] shadow-lg">
      <p className="px-2.5 pt-1.5 pb-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/70">
        Open in editor
      </p>
      <MenuItem
        icon={<IconFolder size={10} className="text-muted-foreground/70" />}
        label="Cursor"
      />
      <MenuItem
        icon={<IconFolder size={10} className="text-muted-foreground/70" />}
        label="VS Code"
      />
      <div className="my-0.5 h-px bg-border-soft" aria-hidden />
      <p className="px-2.5 pt-1.5 pb-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/70">
        Run script
      </p>
      <MenuItem
        icon={<IconTerminal size={10} className="text-muted-foreground/70" />}
        label="copy environments"
      />
      <MenuItem
        icon={<IconTerminal size={10} className="text-muted-foreground/70" />}
        label="deploy preview"
      />
      <div className="my-0.5 h-px bg-border-soft" aria-hidden />
      <MenuItem icon={<DotsVerticalIcon size={10} />} label="Session settings" />
      <MenuItem
        icon={<XIcon size={10} className="text-danger/90" />}
        label="End session"
        hint="⌘."
        destructive
      />
    </div>
  );
}

function MenuItem({
  icon,
  label,
  hint,
  destructive,
}: {
  icon: ReactNode;
  label: string;
  hint?: string;
  destructive?: boolean;
}) {
  return (
    <div
      className={[
        'flex items-center gap-2 px-2.5 py-1.5',
        destructive ? 'text-danger/90' : 'text-foreground/85',
      ].join(' ')}
    >
      <span className="shrink-0">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {hint ? <kbd className="font-mono text-[9px] text-muted-foreground/70">{hint}</kbd> : null}
    </div>
  );
}

function XIcon({ size = 10, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
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
        <SessionStatusIcon state={session.state} />
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

/* Status icon for a rail card. Mirrors the SESSION_STATUS_PALETTE in
   apps/desktop/src/features/workspace/components/SessionActivityBar:
   active → construction (in progress), running → spinner, pending → bell,
   idle → clock. The rail tells you what each session is doing, not which
   kind of agent is selected inside it. */
function SessionStatusIcon({ state }: { state: SessionMock['state'] }) {
  if (state === 'active') {
    return <ConstructionIcon size={12} />;
  }
  if (state === 'running') {
    return <SpinnerIcon />;
  }
  if (state === 'pending') {
    return <BellIcon />;
  }
  return <ClockIcon />;
}

function SpinnerIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="animate-spin text-info"
      aria-hidden
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-warning"
      aria-hidden
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-muted-foreground/60"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
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
  { kind: 'scout' as const, role: 'scout', name: 'Locate auth surface', state: 'done' as const },
  { kind: 'plan' as const, role: 'planner', name: 'Design reset flow', state: 'done' as const },
  {
    kind: 'imple' as const,
    role: 'implementer',
    name: 'Build endpoint + email',
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
          aria-label="Start reviewer (claude-sonnet-4-5, medium effort)"
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
          <span className="text-[10px] font-normal opacity-60">sonnet-4-5</span>
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
          Running with <span className="font-mono text-foreground/80">claude-opus-4-7</span>{' '}
          &middot; medium effort &middot; 2 turns
        </p>
      ) : null}
    </div>
  );
}

/* ---------------------------- Context --------------------------------- */

type ContextTabKey = 'context' | 'plans' | 'files' | 'github' | 'terminal';

const CTX_TABS: ReadonlyArray<{
  readonly key: ContextTabKey;
  readonly label: string;
  readonly icon: typeof IconTarget;
  readonly badge: number | null;
}> = [
  { key: 'context', label: 'Context', icon: IconTarget, badge: null },
  { key: 'plans', label: 'Plans', icon: IconClipboard, badge: 2 },
  { key: 'files', label: 'Files', icon: IconFolder, badge: 3 },
  { key: 'github', label: 'GitHub', icon: IconPullRequest, badge: null },
  { key: 'terminal', label: 'Term', icon: IconTerminal, badge: null },
];

const SLOTS = [
  {
    key: 'goal',
    label: 'Goal',
    icon: IconTarget,
    body: 'Add password reset via email link. Reuse existing transactional mailer. Keep the login UI untouched.',
  },
  {
    key: 'decisions',
    label: 'Decisions',
    icon: IconList,
    body: 'Token TTL 60 minutes, single-use, hashed before storage. Rate-limit per email at 3 per hour.',
  },
  {
    key: 'last_output_summary',
    label: 'Last output',
    icon: IconSparkles,
    body: 'POST /auth/reset-request live. Email template wired. Endpoint + handler tests green.',
  },
];

/* Interactive context snapshot. Tabs are real buttons: click to switch panel.
   Each tab renders a faithful slice of the real ContextPanel surfaces. The
   sticky open-questions footer stays put across tabs, like the product. */
export function ContextSnapshot() {
  const [tab, setTab] = useState<ContextTabKey>('context');

  return (
    <SnapshotFrame className="max-w-[460px]">
      <div className="flex h-9 items-center gap-0.5 border-b border-border-soft bg-[oklch(0.27_0.008_255)] px-2">
        {CTX_TABS.map((t) => (
          <TabButton
            key={t.key}
            label={t.label}
            icon={t.icon}
            badge={t.badge}
            active={tab === t.key}
            onClick={() => setTab(t.key)}
          />
        ))}
      </div>

      <div className="min-h-[260px]">
        {tab === 'context' ? <ContextTabBody /> : null}
        {tab === 'plans' ? <PlansTabBody /> : null}
        {tab === 'files' ? <FilesTabBody /> : null}
        {tab === 'github' ? <GithubTabBody /> : null}
        {tab === 'terminal' ? <TerminalTabBody /> : null}
      </div>

      <button
        type="button"
        onClick={() => setTab('context')}
        className="flex w-full items-center justify-between gap-2 border-t border-border-soft bg-warning/5 px-3 py-2 text-left text-[11px] text-warning transition-colors hover:bg-warning/10"
      >
        <span className="inline-flex items-center gap-1.5 font-medium">
          <IconHelp size={11} />1 open question
        </span>
        <span aria-hidden className="opacity-60">
          →
        </span>
      </button>
    </SnapshotFrame>
  );
}

function ContextTabBody() {
  return (
    <div className="flex flex-col gap-2 p-3">
      {SLOTS.map(({ key, ...rest }) => (
        <SlotCard key={key} {...rest} />
      ))}
    </div>
  );
}

const PLANS_DATA = [
  {
    title: 'Password reset rollout',
    status: 'active' as const,
    body: '1. Token model (hashed, 60min TTL)\n2. POST /auth/reset-request handler\n3. Email template + send\n4. Frontend form on /reset/[token]',
  },
  {
    title: 'Rate-limit transactional mail',
    status: 'consumed' as const,
    body: 'consumed by build endpoint + email · 3/email/hour, exponential cooldown on abuse',
  },
];

function PlansTabBody() {
  return (
    <div className="flex flex-col gap-2 p-3">
      {PLANS_DATA.map((plan) => (
        <div key={plan.title} className="rounded-md border border-border-soft bg-subtle p-2.5">
          <div className="flex items-center gap-2 pb-1.5">
            <IconClipboard size={11} className="text-muted-foreground" />
            <span className="text-[11.5px] font-semibold text-foreground">{plan.title}</span>
            <span
              className={[
                'ml-auto rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
                plan.status === 'active' ? 'bg-warning/15 text-warning' : 'bg-info/10 text-info',
              ].join(' ')}
            >
              {plan.status}
            </span>
          </div>
          <pre className="whitespace-pre-wrap font-mono text-[10.5px] leading-relaxed text-foreground/75">
            {plan.body}
          </pre>
        </div>
      ))}
    </div>
  );
}

const FILES_DATA = [
  { path: 'src/auth/reset/token.ts', adds: 56, dels: 0, edit: 'created' as const },
  { path: 'src/auth/reset/handler.ts', adds: 84, dels: 0, edit: 'created' as const },
  { path: 'src/mail/templates/reset.tsx', adds: 34, dels: 0, edit: 'created' as const },
  { path: 'src/auth/routes.ts', adds: 6, dels: 2, edit: 'modified' as const },
];

function FilesTabBody() {
  return (
    <ul className="flex flex-col divide-y divide-border-soft/40">
      {FILES_DATA.map((f) => (
        <li key={f.path} className="flex items-center gap-2 px-3 py-2 text-[11px]">
          <span
            className={[
              'rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
              f.edit === 'created' ? 'bg-success/15 text-success' : 'bg-info/15 text-info',
            ].join(' ')}
          >
            {f.edit}
          </span>
          <code className="min-w-0 flex-1 truncate font-mono text-foreground/85">{f.path}</code>
          <span className="inline-flex items-center gap-0.5 font-mono text-[10px] text-success">
            <IconArrowUp size={9} />
            {f.adds}
          </span>
          {f.dels > 0 ? (
            <span className="inline-flex items-center gap-0.5 font-mono text-[10px] text-danger">
              <IconArrowDown size={9} />
              {f.dels}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function GithubTabBody() {
  return (
    <div className="flex flex-col gap-2 p-3">
      <div className="rounded-md border border-border-soft bg-subtle p-2.5">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10.5px] text-muted-foreground">#214</span>
          <span className="min-w-0 flex-1 truncate text-[11.5px] font-medium text-foreground">
            feat(auth): password reset via email link
          </span>
          <span className="chip chip-success">open</span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-mono text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <IconBranch size={9} />
            <span className="truncate">ak/password-reset</span>
          </span>
          <span className="inline-flex items-center gap-0.5 text-success">
            <IconArrowUp size={9} />
            180
          </span>
          <span className="inline-flex items-center gap-0.5 text-danger">
            <IconArrowDown size={9} />2
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-success" />6 / 6 checks
          </span>
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground/60">last sync 12s ago · click to refresh</p>
    </div>
  );
}

const TERMINAL_LINES = [
  { p: '$', t: 'pnpm test src/auth/reset', tone: 'cmd' as const },
  { p: '·', t: 'token.test.ts  ✓ 7 passed', tone: 'ok' as const },
  { p: '·', t: 'handler.test.ts  ✓ 12 passed', tone: 'ok' as const },
  { p: '·', t: 'rate-limit.test.ts  ✓ 4 passed', tone: 'ok' as const },
  { p: '$', t: 'pnpm typecheck', tone: 'cmd' as const },
  { p: '·', t: 'no errors found', tone: 'ok' as const },
];

function TerminalTabBody() {
  return (
    <div className="flex flex-col gap-0.5 px-3 py-3 font-mono text-[10.5px] leading-relaxed">
      {TERMINAL_LINES.map((line, i) => (
        <div key={i} className="flex items-start gap-2">
          <span className="shrink-0 text-muted-foreground/60">{line.p}</span>
          <span className={line.tone === 'cmd' ? 'text-foreground' : 'text-success'}>{line.t}</span>
        </div>
      ))}
      <span aria-hidden className="mt-1 inline-block h-3 w-1.5 animate-pulse bg-primary/60" />
    </div>
  );
}

function TabButton({
  label,
  icon: Icon,
  badge,
  active,
  onClick,
}: {
  label: string;
  icon: typeof IconTarget;
  badge: number | null;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition-colors',
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

/* ---------------------------- GitHub panel (unified) ---------------- */

/* Single coherent screen mirroring features/github/components/Panel: the PR
   header for the session (state, branch, diff stats, CI), then the review
   thread with line-anchored comments from human teammates, the locally-run
   claude reviewer, and you. Each comment exposes a one-click resolve that
   spawns a resolver agent in the worktree. Replaces the older two-snapshot
   split (overview list + review list) which read as two different products. */
const REVIEW_COMMENTS = [
  {
    author: 'sara.h',
    avatar: 'oklch(0.72 0.16 150)',
    file: 'src/auth/reset/handler.ts',
    line: 28,
    body: 'Wrap the token insert + audit log in `transaction()` so a flaky mailer never leaves a token without a paired log row.',
    status: 'open' as const,
  },
  {
    author: 'claude-reviewer',
    avatar: 'oklch(0.74 0.15 55)',
    file: 'src/auth/reset/token.ts',
    line: 42,
    body: 'Hash with `argon2id` instead of sha256. Tokens are short-lived but the table will still get scraped if the DB leaks.',
    status: 'open' as const,
  },
  {
    author: 'you',
    avatar: 'oklch(0.78 0.13 200)',
    file: 'src/mail/templates/reset.tsx',
    line: 11,
    body: 'Link text reads "Reset password" but the button below already says that. Make the body line a sentence.',
    status: 'resolved' as const,
    resolvedBy: 'resolver-c3b7',
  },
];

export function GithubPanelSnapshot() {
  const unresolved = REVIEW_COMMENTS.filter((c) => c.status === 'open').length;
  return (
    <SnapshotFrame className="max-w-[540px]">
      <FrameHeader
        label="GitHub"
        right={
          <span className="font-mono text-[10px] text-muted-foreground/70">last sync 12s ago</span>
        }
      />

      {/* PR header */}
      <div className="border-b border-border-soft/60 px-3 py-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-muted-foreground">#214</span>
          <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-foreground">
            feat(auth): password reset via email link
          </span>
          <span className="chip chip-success">open</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10.5px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <IconBranch size={10} />
            <span className="truncate">ak/password-reset</span>
          </span>
          <span className="inline-flex items-center gap-0.5 text-success">
            <IconArrowUp size={9} />
            180
          </span>
          <span className="inline-flex items-center gap-0.5 text-danger">
            <IconArrowDown size={9} />2
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-success" />6 / 6 checks
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-warning" />
            {unresolved} unresolved
          </span>
        </div>
      </div>

      {/* Review thread */}
      <ul className="flex flex-col divide-y divide-border-soft/40">
        {REVIEW_COMMENTS.map((c, i) => (
          <li key={i} className="px-3 py-2.5">
            <ReviewCommentRow comment={c} />
          </li>
        ))}
      </ul>

      {/* Footer: batch resolve */}
      <div className="flex items-center justify-between gap-2 border-t border-border-soft bg-warning/5 px-3 py-2 text-[11px]">
        <span className="inline-flex items-center gap-1.5 text-warning">
          <IconSparkles size={11} />
          Resolve all {unresolved} with one agent batch
        </span>
        <span aria-hidden className="text-warning opacity-60">
          →
        </span>
      </div>
    </SnapshotFrame>
  );
}

function ReviewCommentRow({ comment }: { comment: (typeof REVIEW_COMMENTS)[number] }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <span
          aria-hidden
          className="inline-flex size-4 items-center justify-center rounded-full font-mono text-[8.5px] font-semibold text-zinc-950"
          style={{ background: comment.avatar }}
        >
          {comment.author[0]!.toUpperCase()}
        </span>
        <span className="font-medium text-foreground/80">{comment.author}</span>
        <span>on</span>
        <code className="font-mono text-primary">
          {comment.file.split('/').pop()}:{comment.line}
        </code>
      </div>
      <p className="text-[11.5px] leading-relaxed text-foreground/85">{comment.body}</p>
      <div className="flex items-center gap-2">
        {comment.status === 'resolved' ? (
          <span className="inline-flex items-center gap-1 rounded-md border border-success/30 bg-success/10 px-1.5 py-0.5 text-[10px] font-medium text-success">
            <IconCheck size={10} />
            resolved by {comment.resolvedBy}
          </span>
        ) : (
          <>
            <span className="inline-flex items-center gap-1 rounded-md border border-accent/40 bg-accent/5 px-1.5 py-0.5 text-[10px] font-medium text-accent">
              <IconSparkles size={10} />
              resolve
            </span>
            <span className="text-[10px] text-muted-foreground/60">
              spawns a resolver agent on this comment
            </span>
          </>
        )}
      </div>
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
    body: 'Add a password reset via email link. Keep the login UI untouched.',
    cost: null,
  },
  {
    who: 'Plan',
    model: 'claude-opus-4-7',
    kind: 'plan' as const,
    body: '4 steps drafted: token model, request handler, email template, frontend form.',
    cost: 0.071,
  },
  {
    who: 'Implement',
    model: 'claude-sonnet-4-5',
    kind: 'imple' as const,
    body: 'POST /auth/reset-request live. Tokens hashed at 60min TTL.',
    cost: 0.142,
  },
  {
    who: 'Review',
    model: 'gpt-5-codex',
    kind: 'review' as const,
    body: 'Argon2 over sha256 suggested. PR #214 opened.',
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
   role-on-the-right. Labels are kept tight so the strip stays on a single
   line at the snapshot's natural width: anything longer would wrap and the
   composition stops reading as a header. */
export function ChatHeaderSnapshot() {
  return (
    <SnapshotFrame className="max-w-[520px]">
      <div className="flex h-9 items-center gap-1.5 whitespace-nowrap border-b border-border-soft bg-[oklch(0.27_0.008_255)] px-3 text-[11px]">
        <span className="font-medium text-muted-foreground">web</span>
        <Chevron />
        <span className="font-medium text-muted-foreground">Reset flow</span>
        <Chevron />
        <span className="inline-flex shrink-0 items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
          <IconBranch size={9} />
          <span>Rollout</span>
          <span aria-hidden className="opacity-60">
            ·
          </span>
          <span className="font-mono tabular-nums">3/4</span>
        </span>
        <Chevron />
        <span className="font-medium text-foreground/90">build endpoint</span>
        <div className="flex-1" />
        <AgentAvatar kind="implementer" size={20} />
      </div>
      <div className="flex items-center justify-center px-6 py-12 text-center">
        <p className="max-w-[26ch] text-[12px] leading-relaxed text-muted-foreground">
          Where you are on the left.
          <br />
          Who is driving this turn on the right.
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
  { name: 'locate auth surface', status: 'completed', kind: 'scout' },
  { name: 'one-off: check mailer', status: 'running', kind: 'generic' },
  { name: 'design reset flow', status: 'completed', kind: 'planner' },
  { name: 'build endpoint + email', status: 'running', kind: 'implementer' },
  { name: 'review PR #214', status: 'pending', kind: 'reviewer' },
  { name: 'document reset endpoint', status: 'pending', kind: 'docs' },
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
              AUTH-142
            </span>
            <span className="min-w-0 flex-1 truncate text-foreground/90">
              Password reset via email link
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
            Add password reset via email link. Reuse existing transactional mailer. Keep the login
            UI untouched.
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
              <span>password-reset</span>
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
    name: 'Password reset rollout',
    progress: '2/4',
    custom: false,
    steps: [
      {
        kind: 'scout' as const,
        name: 'Locate auth surface',
        state: 'done' as const,
        model: 'haiku-4-5',
      },
      {
        kind: 'scout' as const,
        name: 'Deep-scan token + mailer flow',
        state: 'done' as const,
        model: 'opus-4-7',
      },
      {
        kind: 'imple' as const,
        name: 'Build endpoint + email',
        state: 'active' as const,
        model: 'sonnet-4-5',
      },
      {
        kind: 'review' as const,
        name: 'Open PR for review',
        state: 'pending' as const,
        model: 'sonnet-4-5',
      },
    ],
  },
  {
    name: 'Rate-limit follow-up',
    progress: '0/3',
    custom: true,
    steps: [
      {
        kind: 'debug' as const,
        name: 'Locate & analyze rate-limit gaps',
        state: 'pending' as const,
        model: 'haiku-4-5',
      },
      {
        kind: 'plan' as const,
        name: 'Pick a backoff strategy',
        state: 'pending' as const,
        model: 'opus-4-7',
      },
      {
        kind: 'imple' as const,
        name: 'Wrap mailer in limiter',
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
        label="Add password reset"
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

/* ---------------------------- App layout (hero) ---------------------- */

/* Abstract three-column hero. Reads as the app silhouette, not as a literal
   screenshot. The deep-dive sections below carry the real detail. Each
   column gets a label + bracketed hint of what lives there in the product:
   sessions/agents/scripts on the left, conversation in the middle, the
   context tabs on the right. No real names, no real prices. */
export function AppOverviewSnapshot() {
  return (
    <SnapshotFrame className="w-full">
      <div className="flex h-7 items-center gap-1.5 border-b border-border-soft bg-[oklch(0.22_0.006_255)] px-3">
        <span className="h-2.5 w-2.5 rounded-full bg-danger/70" aria-hidden />
        <span className="h-2.5 w-2.5 rounded-full bg-warning/70" aria-hidden />
        <span className="h-2.5 w-2.5 rounded-full bg-success/70" aria-hidden />
        <span className="ml-auto text-[10px] text-muted-foreground/60">Goodboy</span>
      </div>
      <div className="grid h-[420px] grid-cols-1 sm:grid-cols-[1fr_1.4fr_1fr]">
        <LayoutColumn
          eyebrow="Sessions"
          tag="rail + detail"
          hint="Linked tickets, agents, scripts, PR state, branch + cost — collapsed into one rail."
          body={<SessionsAbstract />}
          tone="primary"
        />
        <LayoutColumn
          eyebrow="Conversation"
          tag="chat + composer"
          hint="The transcript with the agent currently driving the turn. Switch role mid-flight."
          body={<ConversationAbstract />}
          tone="emerald"
          accent
        />
        <LayoutColumn
          eyebrow="Context"
          tag="five tabs"
          hint="Goal, plans, files, GitHub, terminal — one click each. Open questions pinned below."
          body={<ContextAbstract />}
          tone="info"
        />
      </div>
    </SnapshotFrame>
  );
}

const COLUMN_TONE = {
  primary: { eyebrow: 'text-primary', dot: 'bg-primary' },
  emerald: { eyebrow: 'text-success', dot: 'bg-success' },
  info: { eyebrow: 'text-info', dot: 'bg-info' },
} as const;

function LayoutColumn({
  eyebrow,
  tag,
  hint,
  body,
  tone,
  accent,
}: {
  eyebrow: string;
  tag: string;
  hint: string;
  body: ReactNode;
  tone: keyof typeof COLUMN_TONE;
  accent?: boolean;
}) {
  const t = COLUMN_TONE[tone];
  return (
    <div
      className={[
        'flex min-h-0 flex-col gap-3 border-r border-border-soft/60 px-4 py-4 last:border-r-0',
        accent ? 'bg-[oklch(0.26_0.006_255)]' : 'bg-[oklch(0.24_0.006_255)]',
      ].join(' ')}
    >
      <div className="flex items-center gap-1.5">
        <span aria-hidden className={['size-1.5 rounded-full', t.dot].join(' ')} />
        <span
          className={['text-[10px] font-semibold uppercase tracking-[0.10em]', t.eyebrow].join(' ')}
        >
          {eyebrow}
        </span>
        <span className="ml-auto font-mono text-[9.5px] text-muted-foreground/60">{tag}</span>
      </div>
      <p className="max-w-[28ch] text-[11.5px] leading-relaxed text-muted-foreground">{hint}</p>
      <div className="mt-1 flex-1">{body}</div>
    </div>
  );
}

function AbstractBar({
  width = 'w-3/4',
  tone = 'bg-muted-foreground/30',
  className,
}: {
  width?: string;
  tone?: string;
  className?: string;
}) {
  return <span className={['block h-1.5 rounded-full', width, tone, className].join(' ')} />;
}

const SESSIONS_ABSTRACT: ReadonlyArray<{ readonly dot: string; readonly glow: boolean }> = [
  { dot: 'bg-sky-400/80', glow: true },
  { dot: 'bg-violet-400/80', glow: false },
  { dot: 'bg-orange-400/80', glow: false },
  { dot: 'bg-emerald-400/80', glow: false },
];

function SessionsAbstract() {
  return (
    <div className="flex flex-col gap-2.5">
      {SESSIONS_ABSTRACT.map((card, i) => (
        <div
          key={i}
          className={[
            'flex items-center gap-2.5 rounded-md border px-2.5 py-2',
            card.glow ? 'border-primary/40 bg-primary/5' : 'border-border-soft/60 bg-subtle/60',
          ].join(' ')}
        >
          <span className={['size-3 shrink-0 rounded-full', card.dot].join(' ')} aria-hidden />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <AbstractBar width="w-full" tone="bg-muted-foreground/40" />
            <AbstractBar width="w-2/3" tone="bg-muted-foreground/20" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ConversationAbstract() {
  return (
    <div className="flex flex-col gap-4">
      {/* user bubble right */}
      <div className="ml-auto w-3/4 rounded-2xl rounded-br-md bg-primary/15 px-3 py-2">
        <AbstractBar width="w-full" tone="bg-foreground/30" />
        <span className="mt-1.5 block">
          <AbstractBar width="w-2/3" tone="bg-foreground/20" />
        </span>
      </div>
      {/* agent reply left */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          <span className="size-2.5 shrink-0 rounded-full bg-emerald-400/80" aria-hidden />
          <AbstractBar width="w-20" tone="bg-foreground/30" />
        </div>
        <AbstractBar width="w-full" tone="bg-foreground/25" />
        <AbstractBar width="w-11/12" tone="bg-foreground/25" />
        <AbstractBar width="w-3/4" tone="bg-foreground/25" />
      </div>
      {/* composer chip */}
      <div className="mt-auto rounded-xl border border-border-soft bg-[oklch(0.22_0.006_255)] px-3 py-2.5">
        <p className="text-[10.5px] text-muted-foreground/60">$ ~ @ /</p>
      </div>
    </div>
  );
}

function ContextAbstract() {
  return (
    <div className="flex flex-col gap-2">
      {/* tab strip */}
      <div className="flex items-center gap-1">
        {['Ctx', 'Plans', 'Files', 'GH', 'Term'].map((t, i) => (
          <span
            key={t}
            className={[
              'rounded px-1.5 py-1 text-[9px] font-medium',
              i === 0 ? 'bg-muted text-foreground' : 'text-muted-foreground/60',
            ].join(' ')}
          >
            {t}
          </span>
        ))}
      </div>
      {/* slot cards abstract */}
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-md border border-border-soft bg-subtle p-2">
          <AbstractBar width="w-12" tone="bg-muted-foreground/40" className="mb-1.5" />
          <AbstractBar width="w-full" tone="bg-foreground/25" className="mb-1" />
          <AbstractBar width="w-3/4" tone="bg-foreground/20" />
        </div>
      ))}
      {/* open questions pin */}
      <div className="mt-auto flex items-center gap-1.5 rounded-md border border-warning/30 bg-warning/5 px-2 py-1.5 text-[10px] text-warning">
        <IconHelp size={10} />
        <span>1 open question</span>
      </div>
    </div>
  );
}
