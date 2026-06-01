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

import { Fragment, forwardRef, type ReactNode } from 'react';
import {
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
import { KIND, KindBadge, SnapshotFrame, FrameHeader, type KindKey } from './primitives';
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
  clusters: StepStatus[];
  autoRun: boolean;
  prOpen: boolean;
  cost: number;
}

const SESSION_CLUSTERS = ['token model', 'request handler', 'email template'];

type SessionAction =
  | { type: 'start'; i: number }
  | { type: 'cluster'; i: number }
  | { type: 'finish'; i: number }
  | { type: 'auto' };

const SESSION_COST_AT = [0.04, 0.16, 0.3, 0.34];

const SESSION_INITIAL: SessionRun = {
  steps: ['actionable', 'future', 'future', 'future'],
  clusters: ['future', 'future', 'future'],
  autoRun: false,
  prOpen: false,
  cost: 0,
};

const SESSION_STATIC: SessionRun = {
  steps: ['done', 'done', 'running', 'actionable'],
  clusters: ['done', 'running', 'running'],
  autoRun: true,
  prOpen: false,
  cost: 0.3,
};

function sessionRunReducer(state: SessionRun, action: SessionAction): SessionRun {
  switch (action.type) {
    case 'start':
      return {
        ...state,
        steps: state.steps.map((v, i) => (i === action.i ? 'running' : v)),
        clusters: action.i === 2 ? ['running', 'running', 'running'] : state.clusters,
      };
    case 'cluster':
      return {
        ...state,
        clusters: state.clusters.map((v, i) => (i === action.i ? 'done' : v)),
      };
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
  { d: 820, kind: 'act', act: { type: 'cluster', i: 0 } },
  { d: 640, kind: 'act', act: { type: 'cluster', i: 1 } },
  { d: 700, kind: 'act', act: { type: 'cluster', i: 2 } },
  { d: 640, kind: 'act', act: { type: 'finish', i: 2 } },
  { d: 560, kind: 'act', act: { type: 'start', i: 3 } },
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
                <Fragment key={i}>
                  <RunStepRow
                    ref={registerTarget(`step-${i}`)}
                    index={i + 1}
                    step={s}
                    status={state.steps[i]}
                  />
                  {i === 2 ? (
                    <div className="ml-7 flex flex-col gap-1 border-l border-border-soft/60 pl-2.5">
                      {SESSION_CLUSTERS.map((c, ci) => (
                        <ClusterRow key={c} name={c} status={state.clusters[ci]} />
                      ))}
                    </div>
                  ) : null}
                </Fragment>
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

function ClusterRow({ name, status }: { name: string; status: StepStatus }) {
  const done = status === 'done';
  const running = status === 'running';
  return (
    <div className="flex items-center gap-1.5 text-[10px]">
      <span className="flex size-3 shrink-0 items-center justify-center">
        {done ? (
          <span className="flex size-3 items-center justify-center rounded-full bg-success/20">
            <IconCheck size={7} className="text-success" />
          </span>
        ) : running ? (
          <RunSpinner size={9} className="text-info" />
        ) : (
          <span aria-hidden className="size-1.5 rounded-full bg-muted-foreground/30" />
        )}
      </span>
      <span
        className={
          done ? 'text-foreground/55' : running ? 'text-foreground/85' : 'text-muted-foreground/45'
        }
      >
        {name}
      </span>
      <span className="text-[8.5px] uppercase tracking-wide text-muted-foreground/40">
        subagent
      </span>
    </div>
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
interface StudioStep {
  kind: KindKey;
  name: string;
  role: string;
  model: string;
  prompt: string;
}

const STUDIO_STEPS: ReadonlyArray<StudioStep> = [
  {
    kind: 'scout',
    name: 'Scout',
    role: 'Scout',
    model: 'haiku-4-5',
    prompt: 'Survey the code in scope. List the files, key abstractions, callers and tests.',
  },
  {
    kind: 'plan',
    name: 'Plan',
    role: 'Planner',
    model: 'opus-4-7',
    prompt: 'Propose a refactor plan. Order changes by risk. Say what stays, moves, gets deleted.',
  },
  {
    kind: 'imple',
    name: 'Refactor',
    role: 'Implementer',
    model: 'sonnet-4-5',
    prompt:
      'Apply the refactor in small commits. Keep behavior unchanged. Update tests in lock-step.',
  },
  {
    kind: 'review',
    name: 'Verify',
    role: 'Reviewer',
    model: 'sonnet-4-5',
    prompt: 'Run the suite and review the diff against the plan. Flag anything that drifted.',
  },
];

const STUDIO_LIBRARY: ReadonlyArray<{ kind: KindKey; name: string; prompt: string }> = [
  { kind: 'scout', name: 'Scout', prompt: 'Survey the code in scope.' },
  { kind: 'plan', name: 'Plan', prompt: 'Draft an ordered plan.' },
  { kind: 'imple', name: 'Refactor', prompt: 'Apply changes in small commits.' },
  { kind: 'review', name: 'Verify', prompt: 'Review the diff against the plan.' },
  { kind: 'test', name: 'Test', prompt: 'Write and run tests.' },
  { kind: 'debug', name: 'Diagnose', prompt: 'Reproduce and isolate a bug.' },
];

interface StudioState {
  placed: number;
  dragging: number | null;
}

type StudioAction = { type: 'grab'; i: number } | { type: 'drop' };

const STUDIO_INITIAL: StudioState = { placed: 0, dragging: null };
const STUDIO_STATIC: StudioState = { placed: 2, dragging: null };

function studioReducer(state: StudioState, action: StudioAction): StudioState {
  switch (action.type) {
    case 'grab':
      return { ...state, dragging: action.i };
    case 'drop':
      return { placed: Math.min(state.placed + 1, STUDIO_STEPS.length), dragging: null };
    default:
      return state;
  }
}

const STUDIO_SCRIPT: ReadonlyArray<Beat<StudioAction>> = [0, 1, 2, 3].flatMap((i) => [
  { d: i === 0 ? 800 : 560, kind: 'move' as const, to: `lib-${i}` },
  { d: 460, kind: 'press' as const },
  { d: 200, kind: 'act' as const, act: { type: 'grab' as const, i } },
  { d: 620, kind: 'move' as const, to: 'dropzone' },
  { d: 360, kind: 'act' as const, act: { type: 'drop' as const } },
]);
const STUDIO_FULL_SCRIPT: ReadonlyArray<Beat<StudioAction>> = [
  ...STUDIO_SCRIPT,
  { d: 700, kind: 'move', to: 'save' },
  { d: 520, kind: 'press' },
  { d: 1900, kind: 'move', to: null },
  { d: 600, kind: 'reset' },
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
  const { state, cursor, stageRef, registerTarget } = useAutoplay({
    initial: STUDIO_INITIAL,
    reducer: studioReducer,
    script: STUDIO_FULL_SCRIPT,
    staticState: STUDIO_STATIC,
  });
  const full = state.placed >= STUDIO_STEPS.length;

  return (
    <SnapshotFrame className="max-w-[520px]">
      <FrameHeader
        label="Workflow Studio"
        right={
          <span className="rounded bg-warning/20 px-1 py-px text-[8px] font-semibold uppercase tracking-wide text-warning">
            beta
          </span>
        }
      />
      <div ref={stageRef} className="relative flex">
        <div className="flex min-w-0 flex-1 flex-col p-3">
          <div className="flex items-center gap-2 pb-2">
            <span className="text-[11px] font-semibold text-foreground">Refactor</span>
            <span className="text-[10px] tabular-nums text-muted-foreground/50">
              {state.placed} {state.placed === 1 ? 'step' : 'steps'}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            {STUDIO_STEPS.slice(0, state.placed).map((s, i) => (
              <StudioStepCard key={s.kind} step={s} index={i + 1} />
            ))}
            <div
              ref={registerTarget('dropzone')}
              className={[
                'mt-0.5 flex items-center gap-1.5 rounded-md border border-dashed px-2 py-1.5 text-[10px] font-medium transition-colors',
                state.dragging != null
                  ? 'border-primary bg-primary/15 text-primary'
                  : 'border-border-soft/70 bg-transparent text-muted-foreground/50',
              ].join(' ')}
            >
              <IconPlus size={11} /> {state.dragging != null ? 'drop here' : 'drag a step here'}
            </div>
            {full ? (
              <div className="mt-1.5 flex justify-end">
                <span
                  ref={registerTarget('save')}
                  className={[
                    'inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[10px] font-semibold transition-colors',
                    'bg-primary text-primary-foreground',
                  ].join(' ')}
                >
                  Save workflow
                </span>
              </div>
            ) : null}
          </div>
        </div>

        <div className="w-[164px] shrink-0 border-l border-border-soft bg-[oklch(0.23_0.006_255)] p-2.5">
          <div className="pb-1.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Step library
          </div>
          <div className="flex flex-col gap-1">
            {STUDIO_LIBRARY.map((s, i) => (
              <div
                key={s.kind}
                ref={i < 4 ? registerTarget(`lib-${i}`) : undefined}
                className={[
                  'flex items-start gap-1.5 rounded-md border border-border-soft bg-subtle px-1.5 py-1.5 transition-opacity',
                  state.dragging === i ? 'opacity-40' : 'opacity-100',
                ].join(' ')}
              >
                <span className="pt-0.5">
                  <GripDots />
                </span>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <KindBadge kind={s.kind} />
                  <span className="line-clamp-2 text-[9px] leading-tight text-muted-foreground/70">
                    {s.prompt}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {state.dragging != null ? (
          <div
            aria-hidden
            className="pointer-events-none absolute left-0 top-0 z-30 transition-transform duration-[450ms] ease-[cubic-bezier(.4,0,.2,1)]"
            style={{ transform: `translate(${cursor.x + 10}px, ${cursor.y + 8}px)` }}
          >
            <span className="inline-flex items-center gap-1 rounded-md border border-primary/50 bg-background px-1.5 py-1 text-[10px] font-medium text-foreground shadow-lg">
              <IconPlus size={10} className="text-primary" />
              {STUDIO_LIBRARY[state.dragging].name}
            </span>
          </div>
        ) : null}

        <SimCursor cursor={cursor} />
      </div>
    </SnapshotFrame>
  );
}

function StudioStepCard({ step, index }: { step: StudioStep; index: number }) {
  return (
    <div className="flex items-stretch gap-2 rounded-md border border-border-soft bg-subtle py-1.5 pl-1.5 pr-2">
      <span
        className={['w-0.5 shrink-0 self-stretch rounded-full', KIND[step.kind].bg].join(' ')}
      />
      <span className="w-3 shrink-0 pt-0.5 text-right font-mono text-[10px] text-muted-foreground/40">
        {index}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-1.5">
          <KindBadge kind={step.kind} />
          <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-foreground/90">
            {step.name}
          </span>
          <span className="shrink-0 font-mono text-[10px] text-muted-foreground/60">
            {step.model}
          </span>
        </div>
        <span className="line-clamp-1 pl-0.5 text-[10px] leading-tight text-muted-foreground/65">
          {step.prompt}
        </span>
      </div>
    </div>
  );
}

/* ---------------------------- Context --------------------------------- */

type CtxTab = 'context' | 'plans' | 'questions' | 'terminal';
type TargetRef = (node: HTMLElement | null) => void;

const CTX_TABS: ReadonlyArray<{ key: CtxTab; label: string; icon: typeof IconTarget }> = [
  { key: 'context', label: 'Context', icon: IconList },
  { key: 'plans', label: 'Plans', icon: IconClipboard },
  { key: 'questions', label: 'Questions', icon: IconHelp },
  { key: 'terminal', label: 'Terminal', icon: IconTerminal },
];

const CTX_GOAL =
  'Add password reset via email link. Reuse the existing mailer. Keep the login UI untouched.';
const CTX_DECISIONS = [
  'Token TTL 60 minutes, single-use.',
  'Rate-limit requests per email at 3 per hour.',
];
const CTX_DECISION_ADDED = 'Hash tokens with argon2id, not sha256.';
const CTX_LAST_OUTPUT =
  'POST /auth/reset-request is live. Email template wired. Endpoint and handler tests green.';
const CTX_QUESTION = 'Cap reset tokens at one active per account, or allow several in flight?';
const CTX_SUGGESTIONS = ['One active at a time', 'Allow up to three'];

interface ContextState {
  tab: CtxTab;
  decisionsOpen: boolean;
  decisionEditing: boolean;
  decisionAdded: boolean;
  questionOpen: boolean;
  picked: number | null;
  sent: boolean;
}

type ContextAction =
  | { type: 'tab'; tab: CtxTab }
  | { type: 'openDecisions' }
  | { type: 'editDecision' }
  | { type: 'commitDecision' }
  | { type: 'raiseQuestion' }
  | { type: 'pick'; i: number }
  | { type: 'send' };

const CTX_INITIAL: ContextState = {
  tab: 'context',
  decisionsOpen: false,
  decisionEditing: false,
  decisionAdded: false,
  questionOpen: false,
  picked: null,
  sent: false,
};

const CTX_STATIC: ContextState = {
  tab: 'context',
  decisionsOpen: true,
  decisionEditing: false,
  decisionAdded: true,
  questionOpen: true,
  picked: null,
  sent: false,
};

function contextReducer(state: ContextState, action: ContextAction): ContextState {
  switch (action.type) {
    case 'tab':
      return { ...state, tab: action.tab };
    case 'openDecisions':
      return { ...state, decisionsOpen: true };
    case 'editDecision':
      return { ...state, decisionsOpen: true, decisionEditing: true };
    case 'commitDecision':
      return { ...state, decisionEditing: false, decisionAdded: true };
    case 'raiseQuestion':
      return { ...state, questionOpen: true };
    case 'pick':
      return { ...state, picked: action.i };
    case 'send':
      return { ...state, sent: true, questionOpen: false, tab: 'context' };
    default:
      return state;
  }
}

const CTX_SCRIPT: ReadonlyArray<Beat<ContextAction>> = [
  { d: 900, kind: 'move', to: 'decisions-head' },
  { d: 560, kind: 'press' },
  { d: 220, kind: 'act', act: { type: 'openDecisions' } },
  { d: 880, kind: 'move', to: 'decisions-body' },
  { d: 540, kind: 'press' },
  { d: 220, kind: 'act', act: { type: 'editDecision' } },
  { d: 1800, kind: 'act', act: { type: 'commitDecision' } },
  { d: 760, kind: 'move', to: 'tab-plans' },
  { d: 480, kind: 'press' },
  { d: 220, kind: 'act', act: { type: 'tab', tab: 'plans' } },
  { d: 1900, kind: 'move', to: 'tab-context' },
  { d: 480, kind: 'press' },
  { d: 220, kind: 'act', act: { type: 'tab', tab: 'context' } },
  { d: 820, kind: 'move', to: null },
  { d: 500, kind: 'act', act: { type: 'raiseQuestion' } },
  { d: 720, kind: 'move', to: 'footer' },
  { d: 540, kind: 'press' },
  { d: 220, kind: 'act', act: { type: 'tab', tab: 'questions' } },
  { d: 900, kind: 'move', to: 'suggestion' },
  { d: 540, kind: 'press' },
  { d: 220, kind: 'act', act: { type: 'pick', i: 0 } },
  { d: 820, kind: 'move', to: 'send' },
  { d: 540, kind: 'press' },
  { d: 220, kind: 'act', act: { type: 'send' } },
  { d: 2200, kind: 'reset' },
];

export function ContextSnapshot() {
  const { state, cursor, stageRef, registerTarget } = useAutoplay({
    initial: CTX_INITIAL,
    reducer: contextReducer,
    script: CTX_SCRIPT,
    staticState: CTX_STATIC,
  });
  const questionCount = state.questionOpen && !state.sent ? 1 : 0;

  return (
    <SnapshotFrame className="max-w-[460px]">
      <div className="flex h-9 items-center gap-0.5 border-b border-border-soft bg-[oklch(0.27_0.008_255)] px-2">
        {CTX_TABS.map((t) => (
          <CtxTabButton
            key={t.key}
            label={t.label}
            icon={t.icon}
            badge={t.key === 'plans' ? 2 : t.key === 'questions' ? questionCount || null : null}
            active={state.tab === t.key}
            tabRef={
              t.key === 'plans'
                ? registerTarget('tab-plans')
                : t.key === 'context'
                  ? registerTarget('tab-context')
                  : undefined
            }
          />
        ))}
      </div>

      <div ref={stageRef} className="relative">
        <div className="h-[320px] overflow-hidden">
          {state.tab === 'context' ? (
            <ContextTabBody state={state} registerTarget={registerTarget} />
          ) : null}
          {state.tab === 'plans' ? <PlansTabBody /> : null}
          {state.tab === 'questions' ? (
            <QuestionsTabBody state={state} registerTarget={registerTarget} />
          ) : null}
          {state.tab === 'terminal' ? <TerminalTabBody /> : null}
        </div>

        <div className="h-[37px]">
          {state.tab === 'context' && questionCount > 0 ? (
            <div
              ref={registerTarget('footer')}
              className="flex h-full w-full items-center justify-between gap-2 border-t border-border-soft bg-warning/5 px-3 py-2 text-left text-[11px] text-warning"
            >
              <span className="inline-flex items-center gap-1.5 font-medium">
                <IconHelp size={11} />1 open question
              </span>
              <span aria-hidden className="opacity-60">
                →
              </span>
            </div>
          ) : null}
        </div>

        <SimCursor cursor={cursor} />
      </div>
    </SnapshotFrame>
  );
}

function CtxTabButton({
  label,
  icon: Icon,
  badge,
  active,
  tabRef,
}: {
  label: string;
  icon: typeof IconTarget;
  badge: number | null;
  active: boolean;
  tabRef?: TargetRef;
}) {
  return (
    <span
      ref={tabRef}
      className={[
        'flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition-colors',
        active ? 'bg-muted text-foreground shadow-sm' : 'text-muted-foreground',
      ].join(' ')}
    >
      <Icon size={11} aria-hidden />
      <span className={active ? '' : 'sr-only'}>{label}</span>
      {badge ? (
        <span className="ml-0.5 inline-flex min-w-[1rem] items-center justify-center rounded-full bg-muted px-1 text-[9px] font-medium text-muted-foreground">
          {badge}
        </span>
      ) : null}
    </span>
  );
}

function ContextTabBody({
  state,
  registerTarget,
}: {
  state: ContextState;
  registerTarget: (key: string) => TargetRef;
}) {
  const decisions = state.decisionAdded ? [...CTX_DECISIONS, CTX_DECISION_ADDED] : CTX_DECISIONS;
  return (
    <div className="flex flex-col gap-2 p-3">
      <SlotCard tone="primary" label="goal" icon={<IconTarget size={11} />}>
        <p className="text-[11.5px] font-medium leading-relaxed text-foreground/90">{CTX_GOAL}</p>
      </SlotCard>

      <SlotCard
        tone="success"
        label="decisions"
        icon={<IconCheck size={11} />}
        count={decisions.length}
        open={state.decisionsOpen}
        headRef={registerTarget('decisions-head')}
      >
        {!state.decisionsOpen ? (
          <p className="truncate text-[11px] text-foreground/70">{CTX_DECISIONS[0]}</p>
        ) : state.decisionEditing ? (
          <div
            ref={registerTarget('decisions-body')}
            className="rounded border border-primary/40 bg-background/50 p-2 font-mono text-[10.5px] leading-relaxed text-foreground/85"
          >
            {CTX_DECISIONS.map((d) => (
              <div key={d}>- {d}</div>
            ))}
            <div className="flex text-foreground">
              <span className="shrink-0">-&nbsp;</span>
              <span className="typewriter">{CTX_DECISION_ADDED}</span>
              <span
                aria-hidden
                className="ml-px inline-block h-3 w-1 shrink-0 translate-y-0.5 animate-pulse bg-primary/70"
              />
            </div>
          </div>
        ) : (
          <ul
            ref={registerTarget('decisions-body')}
            className="flex flex-col gap-1 text-[11px] leading-relaxed text-foreground/85"
          >
            {decisions.map((d) => (
              <li key={d} className="flex gap-1.5">
                <span aria-hidden className="text-success/60">
                  ·
                </span>
                <span>{d}</span>
              </li>
            ))}
          </ul>
        )}
      </SlotCard>

      <SlotCard tone="info" label="last output summary" icon={<ActivityMark />}>
        <p className="line-clamp-2 text-[11px] leading-relaxed text-foreground/70">
          {CTX_LAST_OUTPUT}
        </p>
      </SlotCard>

      <div className="mt-0.5 flex flex-col gap-1.5">
        <div className="flex items-center gap-2 rounded-md bg-success/5 px-2 py-1.5 text-[10.5px] ring-1 ring-success/15">
          <IconPullRequest size={11} className="shrink-0 text-success" />
          <span className="font-mono text-success">#214</span>
          <span className="text-muted-foreground">open</span>
          <span className="inline-flex items-center gap-1 text-success">
            <span className="size-1.5 rounded-full bg-success" aria-hidden />6 / 6 checks
          </span>
          <span aria-hidden className="ml-auto text-muted-foreground/50">
            ↗
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-md bg-info/5 px-2 py-1.5 text-[10.5px] ring-1 ring-info/15">
          <IconFolder size={11} className="shrink-0 text-info" />
          <span className="text-foreground/80">4 files touched</span>
          <span className="font-mono text-success">+180</span>
          <span className="font-mono text-danger">−2</span>
          <span aria-hidden className="ml-auto text-muted-foreground/50">
            ↗
          </span>
        </div>
      </div>
    </div>
  );
}

function QuestionsTabBody({
  state,
  registerTarget,
}: {
  state: ContextState;
  registerTarget: (key: string) => TargetRef;
}) {
  return (
    <div className="flex flex-col gap-2 p-3">
      <div className="flex items-center gap-1.5 pb-0.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.10em] text-muted-foreground">
          open questions
        </span>
        <span
          className={[
            'rounded-full px-1.5 text-[9px] font-semibold',
            state.sent ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
          ].join(' ')}
        >
          {state.sent ? '1 / 1' : '0 / 1'}
        </span>
      </div>
      <div
        className={[
          'rounded-md border bg-muted/20 p-2.5 transition-colors',
          state.sent ? 'border-primary/40 bg-primary/5' : 'border-border/30',
        ].join(' ')}
      >
        <div className="flex items-center gap-1.5 pb-1.5 text-[10px] text-muted-foreground">
          <span className="uppercase tracking-wide text-muted-foreground/60">will be sent to</span>
          <KindBadge kind="review" />
        </div>
        <p className="pb-2 text-[11.5px] leading-relaxed text-foreground/85">{CTX_QUESTION}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          {CTX_SUGGESTIONS.map((s, i) => (
            <span
              key={s}
              ref={i === 0 ? registerTarget('suggestion') : undefined}
              className={[
                'rounded-full border px-2.5 py-0.5 text-[10.5px] transition-colors',
                state.picked === i
                  ? 'border-primary/40 bg-primary/10 text-primary ring-1 ring-primary/30'
                  : 'border-border/40 bg-muted/40 text-muted-foreground',
              ].join(' ')}
            >
              {s}
            </span>
          ))}
          <span className="inline-flex items-center gap-0.5 rounded-full border border-border/40 bg-muted/40 px-2 py-0.5 text-[10.5px] text-muted-foreground/70">
            <IconPlus size={9} /> other
          </span>
        </div>
        {state.picked != null ? (
          <div className="mt-2.5 flex justify-end">
            <span
              ref={registerTarget('send')}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[10px] font-semibold text-primary-foreground"
            >
              send 1 answer → reviewer
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ActivityMark() {
  return (
    <svg
      width={11}
      height={11}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 12h4l3 8 4-16 3 8h4" />
    </svg>
  );
}

function SlotCard({
  tone,
  label,
  icon,
  count,
  open,
  headRef,
  children,
}: {
  tone: 'primary' | 'success' | 'info';
  label: string;
  icon: ReactNode;
  count?: number;
  open?: boolean;
  headRef?: TargetRef;
  children: ReactNode;
}) {
  const ring =
    tone === 'primary'
      ? 'ring-primary/15'
      : tone === 'success'
        ? 'ring-success/15'
        : 'ring-info/15';
  const chip =
    tone === 'primary'
      ? 'bg-primary/10 text-primary'
      : tone === 'success'
        ? 'bg-success/10 text-success'
        : 'bg-info/10 text-info';
  return (
    <div className={['rounded-lg bg-muted/30 p-2.5 ring-1', ring].join(' ')}>
      <div ref={headRef} className="flex items-center gap-1.5 pb-1.5">
        <span
          className={['inline-flex size-4 items-center justify-center rounded', chip].join(' ')}
        >
          {icon}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.10em] text-foreground/80">
          {label}
        </span>
        {count != null ? (
          <span className="text-[10px] text-muted-foreground/60">· {count} items</span>
        ) : null}
        {open != null ? (
          <span aria-hidden className="ml-auto text-[11px] text-muted-foreground/50">
            {open ? '⌄' : '›'}
          </span>
        ) : null}
      </div>
      {children}
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
    body: 'Consumed by the Implement step. Folded into the endpoint + email work.',
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

const PR_TONE: Record<'open' | 'approved' | 'draft' | 'merged', string> = {
  open: 'text-success',
  approved: 'text-success',
  draft: 'text-muted-foreground/60',
  merged: 'text-merged',
};

type GhTab = 'overview' | 'conversation' | 'checks';
type GhPhase = 'open' | 'resolving' | 'committed' | 'resolved' | 'merged';
const GH_SHA = 'a1b2c3d';

interface GithubState {
  tab: GhTab;
  phase: GhPhase;
}

type GithubAction =
  | { type: 'tab'; tab: GhTab }
  | { type: 'resolve' }
  | { type: 'commit' }
  | { type: 'solved' }
  | { type: 'merge' };

const GH_INITIAL: GithubState = { tab: 'overview', phase: 'open' };
const GH_STATIC: GithubState = { tab: 'conversation', phase: 'resolved' };

function githubReducer(state: GithubState, action: GithubAction): GithubState {
  switch (action.type) {
    case 'tab':
      return { ...state, tab: action.tab };
    case 'resolve':
      return { ...state, phase: 'resolving' };
    case 'commit':
      return { ...state, phase: 'committed' };
    case 'solved':
      return { ...state, phase: 'resolved' };
    case 'merge':
      return { ...state, phase: 'merged' };
    default:
      return state;
  }
}

const GH_SCRIPT: ReadonlyArray<Beat<GithubAction>> = [
  { d: 800, kind: 'move', to: 'pr-row' },
  { d: 500, kind: 'press' },
  { d: 700, kind: 'move', to: 'tab-conversation' },
  { d: 480, kind: 'press' },
  { d: 220, kind: 'act', act: { type: 'tab', tab: 'conversation' } },
  { d: 900, kind: 'move', to: 'resolve-btn' },
  { d: 520, kind: 'press' },
  { d: 220, kind: 'act', act: { type: 'resolve' } },
  { d: 900, kind: 'move', to: null },
  { d: 1500, kind: 'act', act: { type: 'commit' } },
  { d: 700, kind: 'move', to: 'mark-solved' },
  { d: 540, kind: 'press' },
  { d: 220, kind: 'act', act: { type: 'solved' } },
  { d: 800, kind: 'move', to: 'merge-btn' },
  { d: 560, kind: 'press' },
  { d: 220, kind: 'act', act: { type: 'merge' } },
  { d: 2200, kind: 'reset' },
];

const GH_CHECKS = ['build', 'unit tests', 'typecheck', 'lint'];

export function GithubStudioSnapshot() {
  const { state, cursor, stageRef, registerTarget } = useAutoplay({
    initial: GH_INITIAL,
    reducer: githubReducer,
    script: GH_SCRIPT,
    staticState: GH_STATIC,
  });
  const merged = state.phase === 'merged';
  const resolved = state.phase === 'resolved' || merged;
  const canMerge = state.phase === 'resolved';

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
      <div ref={stageRef} className="relative flex">
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
                  ref={r.active ? registerTarget('pr-row') : undefined}
                  className={[
                    'flex items-center gap-1.5 rounded-md px-1.5 py-1',
                    r.active ? 'bg-primary/10 ring-1 ring-primary/30' : '',
                  ].join(' ')}
                >
                  <IconPullRequest
                    size={11}
                    className={[
                      'shrink-0',
                      r.active && merged ? PR_TONE.merged : PR_TONE[r.tone],
                    ].join(' ')}
                  />
                  <span className="min-w-0 flex-1 truncate text-[10.5px] text-foreground/85">
                    {r.goal}
                  </span>
                  <span className="shrink-0 font-mono text-[9px] text-muted-foreground/50">
                    #{r.num}
                  </span>
                  {r.attention && !(r.active && resolved) ? (
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

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2 px-3 pt-3 pb-2">
            <span className="font-mono text-[10px] text-muted-foreground">#214</span>
            <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-foreground">
              feat(auth): password reset
            </span>
            <span
              className={['shrink-0', merged ? 'chip chip-merged' : 'chip chip-success'].join(' ')}
            >
              {merged ? 'merged' : 'open'}
            </span>
          </div>

          <div className="flex items-center gap-1 px-3 pb-2 text-[10px]">
            <GhTabPill label="Overview" active={state.tab === 'overview'} />
            <GhTabPill
              label="Conversation"
              active={state.tab === 'conversation'}
              tabRef={registerTarget('tab-conversation')}
              badge={
                resolved ? (
                  <IconCheck size={9} className="text-success" />
                ) : (
                  <span className="rounded-full bg-warning/20 px-1 text-[8px] font-semibold text-warning">
                    1
                  </span>
                )
              }
            />
            <GhTabPill
              label="Checks"
              active={state.tab === 'checks'}
              badge={<span aria-hidden className="size-1.5 rounded-full bg-success" />}
            />
          </div>

          <div className="flex items-center gap-1.5 border-y border-border-soft/60 px-3 py-2">
            {merged ? (
              <span className="inline-flex items-center gap-1 rounded-md border border-merged/40 bg-merged/10 px-2 py-1 text-[10px] font-semibold text-merged">
                <IconCheck size={10} /> Merged
              </span>
            ) : (
              <>
                <span
                  ref={registerTarget('merge-btn')}
                  title={canMerge ? 'squash merge' : 'resolve the open comment first'}
                  className={
                    canMerge
                      ? 'inline-flex items-center gap-1 rounded-md border border-success bg-success px-2 py-1 text-[10px] font-semibold text-zinc-950'
                      : 'inline-flex items-center gap-1 rounded-md border border-border-soft px-2 py-1 text-[10px] font-semibold text-muted-foreground/40'
                  }
                >
                  <IconCheck size={10} /> Merge
                </span>
                <span className="inline-flex items-center gap-1 rounded-md border border-border-soft px-2 py-1 text-[10px] font-medium text-muted-foreground">
                  Close
                </span>
              </>
            )}
            <span className="ml-auto inline-flex items-center gap-1 font-mono text-[9.5px] text-muted-foreground/60">
              <IconBranch size={9} /> ak/password-reset → main
            </span>
          </div>

          <div className="h-[188px] overflow-hidden">
            {state.tab === 'overview' ? (
              <div className="px-3 py-3 text-[11px] leading-relaxed text-foreground/80">
                <p>
                  Adds a password reset flow: a hashed single-use token, the request endpoint, an
                  email template and the reset form. Login UI untouched.
                </p>
              </div>
            ) : null}

            {state.tab === 'checks' ? (
              <div className="flex flex-col divide-y divide-border-soft/40 px-3">
                {GH_CHECKS.map((c) => (
                  <div key={c} className="flex items-center gap-2 py-1.5 text-[10.5px]">
                    <span className="flex size-3.5 items-center justify-center rounded-full bg-success/20">
                      <IconCheck size={8} className="text-success" />
                    </span>
                    <span className="flex-1 text-foreground/80">{c}</span>
                    <span className="font-mono text-[9.5px] text-muted-foreground/50">passed</span>
                  </div>
                ))}
              </div>
            ) : null}

            {state.tab === 'conversation' ? (
              <div className="flex flex-col gap-2 px-3 py-2.5">
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
                  <span
                    className={[
                      'ml-auto rounded-full px-1.5 py-px text-[8.5px] font-semibold',
                      resolved ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning',
                    ].join(' ')}
                  >
                    {resolved ? 'resolved' : 'open'}
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed text-foreground/85">
                  Hash with <code className="font-mono text-foreground/70">argon2id</code> instead
                  of sha256.
                </p>

                {state.phase === 'open' ? (
                  <div className="flex items-center gap-2">
                    <span
                      ref={registerTarget('resolve-btn')}
                      className="inline-flex items-center gap-1 rounded-md border border-accent/40 bg-accent/5 px-1.5 py-0.5 text-[10px] font-medium text-accent"
                    >
                      <IconSparkles size={10} /> resolve
                    </span>
                    <span className="text-[10px] text-muted-foreground/60">
                      hands the fix to an agent, replies on the thread
                    </span>
                  </div>
                ) : null}

                {state.phase === 'resolving' ? (
                  <div className="flex items-center gap-2 rounded-md border border-accent/30 bg-accent/5 px-2 py-1.5 text-[10px]">
                    <span className="inline-flex items-center gap-1 font-semibold text-accent">
                      <span className="size-2 rounded-sm bg-lime-400" aria-hidden /> Resolve
                    </span>
                    <RunSpinner size={10} className="text-accent" />
                    <span className="text-muted-foreground/70">
                      reading token.ts, editing, running tests
                    </span>
                  </div>
                ) : null}

                {state.phase === 'committed' || resolved ? (
                  <div className="flex flex-col gap-1.5 rounded-md border border-success/30 bg-success/5 px-2.5 py-2">
                    <div className="flex items-center gap-1.5 text-[10.5px] font-medium text-success">
                      <IconCheck size={11} /> fix committed locally
                      <span className="inline-flex items-center gap-1 rounded bg-background/60 px-1.5 py-px font-mono text-[9.5px] text-foreground/80">
                        <CommitMark /> {GH_SHA}
                      </span>
                    </div>
                    {resolved ? (
                      <span className="inline-flex w-fit items-center gap-1 rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
                        <IconCheck size={9} /> conversation resolved
                      </span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground/70">
                          mark this review conversation as solved on github?
                        </span>
                        <span
                          ref={registerTarget('mark-solved')}
                          className="ml-auto inline-flex items-center gap-1 rounded-md bg-success px-2 py-0.5 text-[10px] font-semibold text-zinc-950"
                        >
                          Mark as Solved
                        </span>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <SimCursor cursor={cursor} />
      </div>
    </SnapshotFrame>
  );
}

function GhTabPill({
  label,
  active,
  badge,
  tabRef,
}: {
  label: string;
  active: boolean;
  badge?: ReactNode;
  tabRef?: TargetRef;
}) {
  return (
    <span
      ref={tabRef}
      className={[
        'inline-flex items-center gap-1 rounded px-1.5 py-0.5',
        active ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground/70',
      ].join(' ')}
    >
      {label}
      {badge}
    </span>
  );
}

function CommitMark() {
  return (
    <svg
      width="9"
      height="9"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
      className="text-muted-foreground/70"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M1.05 12H8M16 12h6.95" strokeLinecap="round" />
    </svg>
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

type LinearStage = 'detail' | 'picker' | 'run';

interface LinearState {
  stage: LinearStage;
  preset: number | null;
  steps: StepStatus[];
}

type LinearAction =
  | { type: 'launch' }
  | { type: 'pick'; i: number }
  | { type: 'start' }
  | { type: 'advance'; i: number };

const LINEAR_PRESETS = [
  { name: 'plan → ship', count: 4 },
  { name: 'fix-it', count: 3 },
];

const LINEAR_RUN_STEPS = [
  { kind: 'scout' as const, name: 'Scout the surface', model: 'haiku-4-5' },
  { kind: 'plan' as const, name: 'Plan the change', model: 'opus-4-7' },
  { kind: 'imple' as const, name: 'Implement', model: 'sonnet-4-5' },
  { kind: 'review' as const, name: 'Open PR', model: 'sonnet-4-5' },
];

const LINEAR_INITIAL: LinearState = {
  stage: 'detail',
  preset: null,
  steps: ['future', 'future', 'future', 'future'],
};
const LINEAR_STATIC: LinearState = {
  stage: 'run',
  preset: 0,
  steps: ['done', 'running', 'future', 'future'],
};

function linearReducer(state: LinearState, action: LinearAction): LinearState {
  switch (action.type) {
    case 'launch':
      return { ...state, stage: 'picker' };
    case 'pick':
      return { ...state, preset: action.i };
    case 'start':
      return { ...state, stage: 'run', steps: ['running', 'future', 'future', 'future'] };
    case 'advance':
      return {
        ...state,
        steps: state.steps.map((v, idx) =>
          idx === action.i ? 'done' : idx === action.i + 1 ? 'running' : v,
        ),
      };
    default:
      return state;
  }
}

const LINEAR_SCRIPT: ReadonlyArray<Beat<LinearAction>> = [
  { d: 800, kind: 'move', to: 'issue-row' },
  { d: 480, kind: 'press' },
  { d: 700, kind: 'move', to: 'launch-btn' },
  { d: 520, kind: 'press' },
  { d: 220, kind: 'act', act: { type: 'launch' } },
  { d: 760, kind: 'move', to: 'preset-0' },
  { d: 480, kind: 'press' },
  { d: 200, kind: 'act', act: { type: 'pick', i: 0 } },
  { d: 760, kind: 'move', to: 'start-wf' },
  { d: 520, kind: 'press' },
  { d: 220, kind: 'act', act: { type: 'start' } },
  { d: 520, kind: 'move', to: null },
  { d: 1200, kind: 'act', act: { type: 'advance', i: 0 } },
  { d: 1300, kind: 'act', act: { type: 'advance', i: 1 } },
  { d: 1300, kind: 'act', act: { type: 'advance', i: 2 } },
  { d: 1300, kind: 'act', act: { type: 'advance', i: 3 } },
  { d: 2200, kind: 'reset' },
];

export function LinearStudioSnapshot() {
  const { state, cursor, stageRef, registerTarget } = useAutoplay({
    initial: LINEAR_INITIAL,
    reducer: linearReducer,
    script: LINEAR_SCRIPT,
    staticState: LINEAR_STATIC,
  });

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
      <div ref={stageRef} className="relative flex">
        <div className="w-[196px] shrink-0 border-r border-border-soft">
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
                    ref={r.active ? registerTarget('issue-row') : undefined}
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
                    {r.hasSession || (r.active && state.stage === 'run') ? (
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

        <div className="flex h-[320px] min-w-0 flex-1 flex-col overflow-hidden">
          {state.stage === 'detail' ? (
            <LinearDetail launchRef={registerTarget('launch-btn')} />
          ) : null}
          {state.stage === 'picker' ? (
            <LinearPicker
              picked={state.preset}
              presetRef={registerTarget('preset-0')}
              startRef={registerTarget('start-wf')}
            />
          ) : null}
          {state.stage === 'run' ? <LinearRun steps={state.steps} /> : null}
        </div>

        <SimCursor cursor={cursor} />
      </div>
    </SnapshotFrame>
  );
}

function LinearDetail({ launchRef }: { launchRef: TargetRef }) {
  return (
    <div className="flex h-full flex-col">
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
        Add a password reset flow: request endpoint, hashed token with TTL, email template, form on
        the marketing site. Keep the existing login UI untouched.
      </p>

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

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-border-soft bg-primary/5 px-3 py-2 text-[10.5px]">
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <span
            aria-hidden
            className="size-2.5 rounded-sm border border-primary/60 bg-primary/20"
          />
          Set up workflow next
        </span>
        <span
          ref={launchRef}
          className="inline-flex items-center gap-1 rounded-md border border-primary bg-primary px-2 py-1 text-[10px] font-semibold text-primary-foreground"
        >
          Launch session →
        </span>
      </div>
    </div>
  );
}

function LinearPicker({
  picked,
  presetRef,
  startRef,
}: {
  picked: number | null;
  presetRef: TargetRef;
  startRef: TargetRef;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-3 pt-3 pb-1">
        <IconLayers size={12} className="text-primary" aria-hidden />
        <span className="text-[12px] font-semibold text-foreground">Start a workflow</span>
      </div>
      <p className="px-3 pb-2 text-[10px] text-muted-foreground/70">
        Pick a saved preset. Each step spawns its own agent, in order.
      </p>
      <div className="flex flex-col gap-1.5 px-3">
        {LINEAR_PRESETS.map((p, i) => (
          <div
            key={p.name}
            ref={i === 0 ? presetRef : undefined}
            className={[
              'rounded-md border p-2 transition-colors',
              picked === i
                ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/30'
                : 'border-border-soft bg-subtle',
            ].join(' ')}
          >
            <div className="flex items-center gap-1.5 pb-1">
              <span className="text-[11px] font-semibold text-foreground">{p.name}</span>
              <span className="text-[9px] text-muted-foreground/50">{p.count} steps</span>
              {picked === i ? <IconCheck size={11} className="ml-auto text-primary" /> : null}
            </div>
            {i === 0 ? (
              <div className="flex flex-wrap gap-1">
                {LINEAR_RUN_STEPS.map((s) => (
                  <KindBadge key={s.kind} kind={s.kind} />
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
      <div className="mt-auto flex items-center justify-between gap-2 border-t border-border-soft bg-primary/5 px-3 py-2 text-[10.5px]">
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <span
            aria-hidden
            className="size-2.5 rounded-sm border border-primary/60 bg-primary/20"
          />
          Auto-run
        </span>
        <span
          ref={startRef}
          className={[
            'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold transition-colors',
            picked != null
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border-soft text-muted-foreground/50',
          ].join(' ')}
        >
          Start workflow
        </span>
      </div>
    </div>
  );
}

function LinearRun({ steps }: { steps: StepStatus[] }) {
  return (
    <div className="flex h-full flex-col px-3 py-3">
      <div className="flex items-center gap-2 pb-2">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          <IconLayers size={10} className="text-primary" /> Workflow
        </span>
        <span className="flex-1" />
        <span className="font-mono text-[10px] text-muted-foreground/70">plan → ship</span>
        <AutoRunPill on />
      </div>
      <div className="flex flex-col gap-1">
        {LINEAR_RUN_STEPS.map((s, i) => (
          <RunStepRow key={s.kind} index={i + 1} step={s} status={steps[i]} />
        ))}
      </div>
      <p className="pt-2 text-[10px] text-success/80">workflow started on GOOD-214</p>
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
