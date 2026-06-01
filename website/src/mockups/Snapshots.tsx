/* Small, focused snapshots of real Goodboy desktop UI. Each one mirrors a
   single panel of apps/desktop/src/ at full fidelity: same Tailwind tokens,
   same font sizes (text-2xs = 11px, text-xs = 12px), same border radii, same
   density. Read as snapshots taken from a running session, not as marketing
   approximations.

   Source map:
   - SessionsSnapshot           <- features/workspace/components/SessionActivityBar
                                   + features/workspace/components/SessionDetailPanel
   - WorkflowRunSnapshot        <- WorkspacesSidebar AgentsSection (self-playing run)
   - WorkflowSnapshot           <- features/workflows/components/WorkflowsPanel +
                                   features/workflows/components/WorkflowNextStepCta
   - ContextSnapshot            <- features/context/components/ContextPanel
   - AgentRosterSnapshot        <- features/session/agent-kind.ts AGENT_KIND_META
   - NewSessionLinearSnapshot   <- features/session/components/NewSessionDialog
                                   with features/integrations/linear/IssuePicker
   - PRSnapshot                 <- features/github/components/* (PR row + diff comment)
*/

import { forwardRef, useState, type ReactNode } from 'react';
import {
  IconArrowDown,
  IconArrowUp,
  IconBranch,
  IconCheck,
  IconClipboard,
  IconFolder,
  IconHelp,
  IconLayers,
  IconList,
  IconPlus,
  IconPullRequest,
  IconSparkles,
  IconTarget,
  IconTerminal,
} from '../components/Icons';
import { AgentAvatar, KIND_LABEL } from '../components/AgentAvatar';
import { KIND, KindBadge, SnapshotFrame, FrameHeader } from './primitives';
import { useAutoplay, SimCursor, type Beat } from './autoplay';

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
   chip. No "ACTIVE SESSION / Status / Branch / PR / Spend" label-value list:
   that's marketing UI, not product UI.
*/
interface SessionRun {
  steps: StepStatus[];
  autoRun: boolean;
  prOpen: boolean;
  cost: number;
}

type SessionAction =
  | { type: 'start'; i: number }
  | { type: 'finish'; i: number }
  | { type: 'auto' };

const SESSION_COST_AT = [0.04, 0.16, 0.3, 0.34];

const SESSION_INITIAL: SessionRun = {
  steps: ['actionable', 'future', 'future', 'future'],
  autoRun: false,
  prOpen: false,
  cost: 0,
};

const SESSION_STATIC: SessionRun = {
  steps: ['done', 'done', 'running', 'actionable'],
  autoRun: true,
  prOpen: false,
  cost: 0.3,
};

function sessionRunReducer(state: SessionRun, action: SessionAction): SessionRun {
  switch (action.type) {
    case 'start':
      return { ...state, steps: state.steps.map((v, i) => (i === action.i ? 'running' : v)) };
    case 'finish':
      return {
        ...state,
        steps: state.steps.map((v, i) =>
          i === action.i ? 'done' : i === action.i + 1 && v === 'future' ? 'actionable' : v,
        ),
        cost: SESSION_COST_AT[action.i] ?? state.cost,
        prOpen: action.i >= 3 ? true : state.prOpen,
      };
    case 'auto':
      return { ...state, autoRun: true };
    default:
      return state;
  }
}

const SESSION_SCRIPT: ReadonlyArray<Beat<SessionAction>> = [
  { d: 800, kind: 'move', to: 'step-0' },
  { d: 560, kind: 'press' },
  { d: 240, kind: 'act', act: { type: 'start', i: 0 } },
  { d: 1500, kind: 'act', act: { type: 'finish', i: 0 } },
  { d: 660, kind: 'move', to: 'step-1' },
  { d: 520, kind: 'press' },
  { d: 240, kind: 'act', act: { type: 'start', i: 1 } },
  { d: 1500, kind: 'act', act: { type: 'finish', i: 1 } },
  { d: 680, kind: 'move', to: 'toggle' },
  { d: 520, kind: 'press' },
  { d: 240, kind: 'act', act: { type: 'auto' } },
  { d: 520, kind: 'move', to: null },
  { d: 460, kind: 'act', act: { type: 'start', i: 2 } },
  { d: 1400, kind: 'act', act: { type: 'finish', i: 2 } },
  { d: 540, kind: 'act', act: { type: 'start', i: 3 } },
  { d: 1400, kind: 'act', act: { type: 'finish', i: 3 } },
  { d: 2400, kind: 'reset' },
];

export function SessionsSnapshot() {
  const { state, cursor, stageRef, registerTarget } = useAutoplay({
    initial: SESSION_INITIAL,
    reducer: sessionRunReducer,
    script: SESSION_SCRIPT,
    staticState: SESSION_STATIC,
  });

  return (
    <SnapshotFrame className="max-w-[460px]">
      <div className="flex">
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

        <div
          aria-hidden
          className="my-1 ml-1.5 w-px shrink-0 bg-gradient-to-b from-transparent via-border-soft via-30% to-transparent"
        />

        <div className="flex min-w-0 flex-1 flex-col">
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
              className="inline-flex shrink-0 items-center rounded p-0.5 text-muted-foreground/80"
              title="session actions"
            >
              <DotsVerticalIcon size={13} />
            </span>
          </div>

          <div ref={stageRef} className="relative px-3 pb-1">
            <div className="flex items-center gap-2 pb-2">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                <IconLayers size={10} className="text-primary" />
                Workflow
              </span>
              <span className="flex-1" />
              <span className="max-w-[8rem] truncate font-mono text-[10px] text-muted-foreground/70">
                preset
              </span>
              <AutoRunPill ref={registerTarget('toggle')} on={state.autoRun} />
            </div>
            <div className="flex flex-col gap-1">
              {RUN_STEPS.map((s, i) => (
                <RunStepRow
                  key={i}
                  ref={registerTarget(`step-${i}`)}
                  index={i + 1}
                  step={s}
                  status={state.steps[i]}
                />
              ))}
            </div>
            <SimCursor cursor={cursor} />
          </div>

          <div className="mt-auto flex shrink-0 items-center gap-1.5 px-3 pt-2 pb-3">
            <span className="inline-flex min-w-0 items-center gap-1.5 truncate rounded-md border border-border-soft bg-muted/30 px-2 py-1 font-mono text-[10px] text-foreground/80">
              <IconBranch size={10} aria-hidden className="shrink-0 text-muted-foreground" />
              <span className="truncate">ak/password-reset</span>
            </span>
            {state.prOpen ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-success/30 bg-success/10 px-1.5 py-1 font-mono text-[10px] text-success">
                <span className="size-1.5 rounded-full bg-success" aria-hidden />
                PR #214
              </span>
            ) : (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border-soft/60 bg-muted/20 px-1.5 py-1 font-mono text-[10px] text-muted-foreground/60">
                no PR yet
              </span>
            )}
            <span className="ml-auto inline-flex shrink-0 items-center rounded-md border border-success/20 bg-success/10 px-2 py-1 font-mono text-[10px] tabular-nums text-success">
              ${state.cost.toFixed(2)}
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

/* ------------------------- Workflow Studio ---------------------------- */

/* The composer: a saved preset on the left, the reusable step library on the
   right. Mirrors apps/desktop WorkflowsPanel (preset rail + step library
   palette). Each composed step carries its own model. */
const STUDIO_STEPS = [
  { kind: 'scout' as const, name: 'Scout the area', model: 'haiku-4-5' },
  { kind: 'plan' as const, name: 'Plan the change', model: 'opus-4-7' },
  { kind: 'imple' as const, name: 'Refactor', model: 'sonnet-4-5' },
  { kind: 'review' as const, name: 'Verify', model: 'sonnet-4-5' },
];

const STUDIO_LIBRARY: ReadonlyArray<keyof typeof KIND> = [
  'scout',
  'plan',
  'imple',
  'review',
  'test',
  'debug',
];

function GripDots() {
  return (
    <svg
      width="6"
      height="12"
      viewBox="0 0 6 12"
      aria-hidden
      className="shrink-0 text-muted-foreground/40"
    >
      <g fill="currentColor">
        <circle cx="1.5" cy="2" r="1" />
        <circle cx="4.5" cy="2" r="1" />
        <circle cx="1.5" cy="6" r="1" />
        <circle cx="4.5" cy="6" r="1" />
        <circle cx="1.5" cy="10" r="1" />
        <circle cx="4.5" cy="10" r="1" />
      </g>
    </svg>
  );
}

export function StudioComposeSnapshot() {
  return (
    <SnapshotFrame className="max-w-[460px]">
      <FrameHeader
        label="Workflow Studio"
        right={
          <span className="rounded bg-warning/20 px-1 py-px text-[8px] font-semibold uppercase tracking-wide text-warning">
            beta
          </span>
        }
      />
      <div className="flex">
        {/* composer: the preset being assembled */}
        <div className="min-w-0 flex-1 p-3">
          <div className="flex items-center gap-2 pb-2">
            <span className="text-[11px] font-semibold text-foreground">Refactor</span>
            <span className="text-[10px] text-muted-foreground/50">4 steps</span>
          </div>
          <div className="flex flex-col gap-1">
            {STUDIO_STEPS.map((s, i) => (
              <div
                key={s.kind}
                className="flex items-center gap-2 rounded-md border border-border-soft bg-subtle px-2 py-1.5"
              >
                <span className="w-3 shrink-0 text-right font-mono text-[10px] text-muted-foreground/40">
                  {i + 1}
                </span>
                <KindBadge kind={s.kind} />
                <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-foreground/90">
                  {s.name}
                </span>
                <span className="shrink-0 font-mono text-[10px] text-muted-foreground/60">
                  {s.model}
                </span>
              </div>
            ))}
            <div className="mt-0.5 flex items-center gap-1.5 rounded-md border border-dashed border-primary/40 bg-primary/5 px-2 py-1.5 text-[10px] font-medium text-primary/80">
              <IconPlus size={11} /> drop a step here
            </div>
          </div>
        </div>

        {/* step library: drag a module in */}
        <div className="w-[124px] shrink-0 border-l border-border-soft bg-[oklch(0.23_0.006_255)] p-2.5">
          <div className="pb-1.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Step library
          </div>
          <div className="flex flex-col gap-1">
            {STUDIO_LIBRARY.map((k) => (
              <div
                key={k}
                className="flex items-center gap-1 rounded-md border border-border-soft bg-subtle px-1.5 py-1"
              >
                <GripDots />
                <KindBadge kind={k} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </SnapshotFrame>
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

/* ---------------------------- GitHub Studio --------------------------- */

/* Mirrors features/github/components/GitHubStudio: a full-screen PR command
   center. Left, the inbox: every session's PR bucketed by what it needs from
   you (draft, in review, approved...). Right, the focused PR with its
   lifecycle actions (mark ready, close, squash-merge) and a review comment
   you can hand straight to an agent. Compacted to two panes for the page. */
const INBOX_GROUPS: ReadonlyArray<{
  readonly label: string;
  readonly rows: ReadonlyArray<{
    readonly goal: string;
    readonly num: number;
    readonly tone: 'open' | 'approved' | 'draft';
    readonly attention?: boolean;
    readonly active?: boolean;
  }>;
}> = [
  {
    label: 'In review',
    rows: [
      { goal: 'Add password reset', num: 214, tone: 'open', attention: true, active: true },
      { goal: 'Rate limiter', num: 211, tone: 'open' },
    ],
  },
  {
    label: 'Approved',
    rows: [{ goal: 'Webhook retry backoff', num: 208, tone: 'approved' }],
  },
  {
    label: 'Draft',
    rows: [{ goal: 'Drop legacy cookies', num: 205, tone: 'draft' }],
  },
];

const PR_TONE: Record<'open' | 'approved' | 'draft', string> = {
  open: 'text-success',
  approved: 'text-success',
  draft: 'text-muted-foreground/60',
};

export function GithubStudioSnapshot() {
  return (
    <SnapshotFrame className="max-w-[560px]">
      <FrameHeader
        label="GitHub Studio"
        right={
          <span className="rounded bg-warning/20 px-1 py-px text-[8px] font-semibold uppercase tracking-wide text-warning">
            beta
          </span>
        }
      />
      <div className="flex">
        {/* inbox: every session's PR, bucketed by what it needs from you */}
        <div className="w-[176px] shrink-0 space-y-2.5 border-r border-border-soft p-2">
          {INBOX_GROUPS.map((g) => (
            <div key={g.label} className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1 px-1 pb-0.5">
                <span className="text-[9px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  {g.label}
                </span>
                <span className="text-[9px] tabular-nums text-muted-foreground/50">
                  {g.rows.length}
                </span>
                <span aria-hidden className="ml-1 h-px flex-1 bg-border-soft" />
              </div>
              {g.rows.map((r) => (
                <div
                  key={r.num}
                  className={[
                    'flex items-center gap-1.5 rounded-md px-1.5 py-1',
                    r.active ? 'bg-primary/10 ring-1 ring-primary/30' : '',
                  ].join(' ')}
                >
                  <IconPullRequest size={11} className={['shrink-0', PR_TONE[r.tone]].join(' ')} />
                  <span className="min-w-0 flex-1 truncate text-[10.5px] text-foreground/85">
                    {r.goal}
                  </span>
                  <span className="shrink-0 font-mono text-[9px] text-muted-foreground/50">
                    #{r.num}
                  </span>
                  {r.attention ? (
                    <span
                      aria-hidden
                      title="changes requested"
                      className="size-1.5 shrink-0 rounded-full bg-danger"
                    />
                  ) : null}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* detail: the focused PR, full lifecycle + a comment you can hand off */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2 px-3 pt-3 pb-2">
            <span className="font-mono text-[10px] text-muted-foreground">#214</span>
            <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-foreground">
              feat(auth): password reset via email link
            </span>
            <span className="chip chip-success shrink-0">open</span>
          </div>

          {/* section nav */}
          <div className="flex items-center gap-1 px-3 pb-2 text-[10px]">
            <span className="rounded px-1.5 py-0.5 text-muted-foreground/70">Overview</span>
            <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-medium text-foreground">
              Conversation
              <span className="rounded-full bg-warning/20 px-1 text-[8px] font-semibold text-warning">
                2
              </span>
            </span>
            <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-muted-foreground/70">
              Checks
              <span aria-hidden className="size-1.5 rounded-full bg-success" />
            </span>
          </div>

          {/* lifecycle action bar */}
          <div className="flex items-center gap-1.5 border-y border-border-soft/60 px-3 py-2">
            <span className="inline-flex items-center gap-1 rounded-md border border-success bg-success px-2 py-1 text-[10px] font-semibold text-zinc-950">
              <IconCheck size={10} /> Merge
            </span>
            <span className="inline-flex items-center gap-1 rounded-md border border-border-soft px-2 py-1 text-[10px] font-medium text-muted-foreground">
              Close
            </span>
            <span className="ml-auto inline-flex items-center gap-1 font-mono text-[9.5px] text-muted-foreground/60">
              <IconBranch size={9} /> ak/password-reset → main
            </span>
          </div>

          {/* one review comment, handed to an agent */}
          <div className="flex flex-col gap-1.5 px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <span
                aria-hidden
                className="inline-flex size-4 items-center justify-center rounded-full font-mono text-[8.5px] font-semibold text-zinc-950"
                style={{ background: 'oklch(0.74 0.15 55)' }}
              >
                C
              </span>
              <span className="font-medium text-foreground/80">claude-reviewer</span>
              <span>on</span>
              <code className="font-mono text-primary">token.ts:42</code>
            </div>
            <p className="text-[11px] leading-relaxed text-foreground/85">
              Hash with <code className="font-mono text-foreground/70">argon2id</code> instead of
              sha256, the table gets scraped if the DB ever leaks.
            </p>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-md border border-accent/40 bg-accent/5 px-1.5 py-0.5 text-[10px] font-medium text-accent">
                <IconSparkles size={10} /> resolve
              </span>
              <span className="text-[10px] text-muted-foreground/60">
                hands the fix to an agent, replies on the thread
              </span>
            </div>
          </div>

          <div className="mt-auto flex items-center justify-between gap-2 border-t border-border-soft bg-warning/5 px-3 py-2 text-[10.5px]">
            <span className="inline-flex items-center gap-1.5 text-warning">
              <IconSparkles size={11} /> Resolve all 2 with one agent
            </span>
            <span aria-hidden className="text-warning opacity-60">
              →
            </span>
          </div>
        </div>
      </div>
    </SnapshotFrame>
  );
}

/* ---------------------------- Linear Studio ------------------------- */

/* Mirrors apps/desktop/src/features/integrations/linear/LinearStudio:
   left rail = IssueInbox (search, issues grouped by Linear state, state dots,
   PR/session badges), right pane = IssueDetailPanel (identifier + state chip,
   open-in-linear, title, linked PR chip, description excerpt, Goal field,
   Branch mode tabs with PR adoption, launch button). Compressed to one screen;
   the real surface is taller. */
const LINEAR_INBOX: ReadonlyArray<{
  readonly label: string;
  readonly dot: string;
  readonly rows: ReadonlyArray<{
    readonly id: string;
    readonly title: string;
    readonly active?: boolean;
    readonly hasPr?: boolean;
    readonly hasSession?: boolean;
  }>;
}> = [
  {
    label: 'In progress',
    dot: 'bg-primary',
    rows: [
      { id: 'GOOD-214', title: 'Password reset via email link', active: true, hasPr: true },
      { id: 'GOOD-211', title: 'Rate limiter on /auth/*', hasSession: true },
    ],
  },
  {
    label: 'Todo',
    dot: 'bg-info',
    rows: [
      { id: 'GOOD-218', title: 'Workspace switcher in command bar' },
      { id: 'GOOD-220', title: 'Retry policy for webhook deliveries' },
    ],
  },
  {
    label: 'Backlog',
    dot: 'bg-muted-foreground/50',
    rows: [{ id: 'GOOD-231', title: 'Inline diffs in PR conversation' }],
  },
];

export function LinearStudioSnapshot() {
  return (
    <SnapshotFrame className="max-w-[560px]">
      <FrameHeader
        label="Linear · goodboy"
        right={
          <span className="rounded bg-warning/20 px-1 py-px text-[8px] font-semibold uppercase tracking-wide text-warning">
            beta
          </span>
        }
      />
      <div className="flex">
        {/* inbox: open issues assigned to you, grouped by state */}
        <div className="w-[196px] shrink-0 border-r border-border-soft">
          {/* search */}
          <div className="px-2 pt-2 pb-1.5">
            <div className="flex h-7 items-center gap-1.5 rounded-md border border-border-soft bg-background/40 px-2 text-[10px] text-muted-foreground/60">
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
                className="shrink-0"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <span>Search issues…</span>
            </div>
          </div>
          <div className="space-y-2.5 px-2 pb-2.5">
            {LINEAR_INBOX.map((g) => (
              <div key={g.label} className="flex flex-col gap-0.5">
                <div className="flex items-center gap-1 px-1 pb-0.5">
                  <span className="text-[9px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    {g.label}
                  </span>
                  <span className="text-[9px] tabular-nums text-muted-foreground/50">
                    {g.rows.length}
                  </span>
                  <span aria-hidden className="ml-1 h-px flex-1 bg-border-soft" />
                </div>
                {g.rows.map((r) => (
                  <div
                    key={r.id}
                    className={[
                      'flex items-center gap-1.5 rounded-md px-1.5 py-1',
                      r.active ? 'bg-primary/10 ring-1 ring-primary/30' : '',
                    ].join(' ')}
                  >
                    <span aria-hidden className={`size-1.5 shrink-0 rounded-full ${g.dot}`} />
                    <span className="shrink-0 font-mono text-[9px] text-muted-foreground/70">
                      {r.id}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[10.5px] text-foreground/85">
                      {r.title}
                    </span>
                    {r.hasPr ? (
                      <IconPullRequest size={9} className="shrink-0 text-muted-foreground/70" />
                    ) : null}
                    {r.hasSession ? (
                      <span
                        aria-hidden
                        title="session launched"
                        className="size-1.5 shrink-0 rounded-full bg-success"
                      />
                    ) : null}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* detail: focused issue, launch session right here */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2 px-3 pt-3 pb-1">
            <span className="font-mono text-[10px] text-muted-foreground">GOOD-214</span>
            <span className="chip bg-muted text-muted-foreground">In progress</span>
            <span className="flex-1" />
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/70">
              Open in Linear
              <svg
                width="9"
                height="9"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M15 3h6v6M10 14 21 3M21 14v7H3V3h7" />
              </svg>
            </span>
          </div>
          <p className="px-3 pb-2 text-[12px] font-semibold leading-snug text-foreground">
            Password reset via email link
          </p>
          <div className="flex items-center gap-1.5 px-3 pb-2">
            <span className="chip chip-success inline-flex items-center gap-1">
              <IconPullRequest size={9} aria-hidden /> #214 · open
            </span>
          </div>
          <p className="px-3 pb-3 text-[10.5px] leading-relaxed text-muted-foreground/80">
            Add a password reset flow: request endpoint, hashed token with TTL, email template, form
            on the marketing site. Keep the existing login UI untouched.
          </p>

          {/* launch panel: goal + branch + button */}
          <div className="space-y-2 border-t border-border-soft/60 bg-subtle/40 px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-foreground">
              <IconTarget size={10} aria-hidden className="text-primary" /> Goal
            </div>
            <div className="rounded-md border border-border-soft bg-background/40 px-2 py-1.5 text-[10.5px] leading-relaxed text-foreground/85">
              Password reset via email link. Add request endpoint, hashed token, email template.
            </div>

            <div className="flex items-center gap-1.5 pt-1 text-[10px] font-semibold text-foreground">
              <IconBranch size={10} aria-hidden className="text-success" /> Branch
            </div>
            <div className="inline-flex rounded-md border border-border-soft p-0.5 text-[9.5px]">
              <span className="rounded bg-muted px-1.5 py-0.5 font-medium text-foreground">
                Continue on PR #214
              </span>
              <span className="px-1.5 py-0.5 text-muted-foreground/70">Start fresh</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-md border border-border-soft bg-background/40 px-2 py-1 font-mono text-[10px] text-foreground/85">
              <IconBranch size={9} aria-hidden className="text-muted-foreground" />
              <span className="truncate">ak/password-reset</span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-border-soft bg-primary/5 px-3 py-2 text-[10.5px]">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <span aria-hidden className="size-2.5 rounded-sm border border-muted-foreground/40" />
              Set up workflow next
            </span>
            <span className="inline-flex items-center gap-1 rounded-md border border-primary bg-primary px-2 py-1 text-[10px] font-semibold text-primary-foreground">
              Launch session →
            </span>
          </div>
        </div>
      </div>
    </SnapshotFrame>
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

/* ---------------------------- Agent roster --------------------------- */

/* The seven default roles, lifted verbatim from apps/desktop AGENT_KIND_META
   (label + hint). Not a showcase of agents at work: a reference card you can
   scan in one pass. Each row is the role icon, its name, and the one line that
   says what it may (and may not) touch. Order follows the natural lifecycle of
   a task: scout -> plan -> implement -> debug -> test -> review -> docs. */
const ROSTER: ReadonlyArray<{
  readonly kind: keyof typeof KIND;
  readonly tile: string;
  readonly hint: string;
}> = [
  {
    kind: 'scout',
    tile: 'bg-sky-400/15',
    hint: 'Reads and searches the codebase. Never edits files',
  },
  {
    kind: 'plan',
    tile: 'bg-violet-400/15',
    hint: 'Turns a goal into an ordered plan. No code, no edits',
  },
  {
    kind: 'imple',
    tile: 'bg-emerald-400/15',
    hint: 'Writes code against the active plan. No re-planning',
  },
  { kind: 'debug', tile: 'bg-amber-400/15', hint: 'Reproduces and fixes bugs. No refactoring' },
  { kind: 'test', tile: 'bg-teal-400/15', hint: 'Writes tests. Never touches production code' },
  { kind: 'review', tile: 'bg-cyan-400/15', hint: 'Reviews diffs read-only. Suggests fixes' },
  { kind: 'docs', tile: 'bg-orange-400/15', hint: 'Writes documentation. Never touches logic' },
];

export function AgentRosterSnapshot() {
  return (
    <SnapshotFrame className="max-w-[520px]">
      <FrameHeader
        label="default roles"
        right={
          <span className="font-mono text-[10px] text-muted-foreground/70">7 ship by default</span>
        }
      />
      <ul className="divide-y divide-border-soft/40">
        {ROSTER.map((r) => (
          <li key={r.kind} className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40">
            <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${r.tile}`}>
              <AgentAvatar kind={KIND[r.kind].kind} size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <span className="text-[13px] font-semibold text-foreground">
                {KIND_LABEL[KIND[r.kind].kind]}
              </span>
              <p className="truncate text-[11.5px] leading-snug text-muted-foreground">{r.hint}</p>
            </div>
          </li>
        ))}
      </ul>
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

const RUN_STEPS = [
  { kind: 'scout' as const, name: 'Locate auth surface', model: 'haiku-4-5' },
  { kind: 'plan' as const, name: 'Draft reset flow + endpoints', model: 'opus-4-7' },
  { kind: 'imple' as const, name: 'Build endpoint + email', model: 'sonnet-4-5' },
  { kind: 'review' as const, name: 'Open PR for review', model: 'sonnet-4-5' },
];

/* Mirrors the desktop step statuses: a future step waits on its predecessors,
   the next step is `actionable` (lit, clickable), then `running`, then `done`. */
type StepStatus = 'future' | 'actionable' | 'running' | 'done';

const RunStepRow = forwardRef<
  HTMLDivElement,
  { index: number; step: (typeof RUN_STEPS)[number]; status: StepStatus }
>(function RunStepRow({ index, step, status }, ref) {
  const actionable = status === 'actionable';
  const running = status === 'running';
  const future = status === 'future';
  return (
    <div
      ref={ref}
      className={[
        'relative flex items-center gap-2 overflow-hidden rounded border px-2.5 py-1.5 text-[11px] transition-colors duration-300',
        running
          ? 'border-info/60 bg-muted/40 text-foreground/80'
          : actionable
            ? 'border-primary/40 bg-primary/10 text-primary shadow-sm'
            : future
              ? 'border-transparent text-muted-foreground/40'
              : 'border-border-soft/50 bg-muted/40 text-foreground/80',
      ].join(' ')}
    >
      <span
        className={[
          'w-3 shrink-0 text-right font-mono text-[9px] tabular-nums',
          future ? 'text-muted-foreground/40' : 'text-muted-foreground/60',
        ].join(' ')}
      >
        {index}.
      </span>
      <StepStatusIcon status={status} />
      <KindBadge kind={step.kind} muted={future} />
      <span
        className={[
          'min-w-0 flex-1 truncate font-semibold transition-colors duration-300',
          actionable ? 'text-primary' : future ? 'text-muted-foreground/45' : 'text-foreground/85',
        ].join(' ')}
      >
        {step.name}
      </span>
      <span
        className={[
          'shrink-0 font-mono text-[10px]',
          future ? 'text-muted-foreground/50' : 'text-muted-foreground/70',
        ].join(' ')}
      >
        {step.model}
      </span>
      {running && <span className="run-bar" />}
    </div>
  );
});

/* Per-status icon, mirroring the desktop WorkflowStepRow: a pinging play dot
   when the step is the lit next action, an info spinner while running, a green
   check when done, a clock while waiting on predecessors. */
function StepStatusIcon({ status }: { status: StepStatus }) {
  if (status === 'actionable') {
    return (
      <span className="relative inline-flex size-3.5 shrink-0">
        <span
          className="absolute inset-0 animate-ping rounded-full bg-primary/30 opacity-75"
          aria-hidden
        />
        <span className="relative flex size-3.5 items-center justify-center rounded-full bg-primary/20">
          <PlayIcon size={8} />
        </span>
      </span>
    );
  }
  if (status === 'running') return <RunSpinner size={11} className="text-info" />;
  if (status === 'done') {
    return (
      <span className="flex size-3.5 shrink-0 items-center justify-center rounded-full bg-success/20">
        <IconCheck size={9} className="text-success" />
      </span>
    );
  }
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 text-muted-foreground/50"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

/* The real per-session auto-run control: a compact icon toggle that lives in
   the workflow header's top-right. Off shows a slashed bolt in muted grey; on
   shows a filled bolt with the "auto" label sliding in, tinted danger. */
const AutoRunPill = forwardRef<HTMLButtonElement, { on: boolean }>(function AutoRunPill(
  { on },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      tabIndex={-1}
      role="switch"
      aria-checked={on}
      aria-label="Auto-run"
      title={on ? 'autorun on' : 'autorun off'}
      className={[
        'inline-flex h-6 shrink-0 items-center justify-end rounded-md px-1 transition-colors',
        on ? 'bg-danger/10 text-danger' : 'text-muted-foreground/60',
      ].join(' ')}
    >
      <span
        aria-hidden
        className={[
          'overflow-hidden whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide',
          'transition-[max-width,opacity,margin] duration-200 ease-out',
          on ? 'mr-1 max-w-[2.5rem] opacity-100' : 'mr-0 max-w-0 opacity-0',
        ].join(' ')}
      >
        auto
      </span>
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill={on ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        {!on && <line x1="3" y1="3" x2="21" y2="21" />}
      </svg>
    </button>
  );
});

function RunSpinner({ size = 10, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      className={['shrink-0 animate-spin', className ?? ''].join(' ')}
      aria-hidden
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function PlayIcon({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
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
          hint="Every task you've got running, with its branch, agents and PR, in one rail."
          body={<SessionsAbstract />}
          tone="primary"
        />
        <LayoutColumn
          eyebrow="Conversation"
          tag="chat + composer"
          hint="The chat, with whichever agent is talking right now. Hand the turn to another one without losing the thread."
          body={<ConversationAbstract />}
          tone="emerald"
          accent
        />
        <LayoutColumn
          eyebrow="Context"
          tag="five tabs"
          hint="Goal, plans, files, the PR, a click each. Your open questions stay pinned so nothing slips."
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
