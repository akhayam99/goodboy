import type { Agent, Session, SessionAttentionReason, Workflow, WorkflowRun } from '@goodboy/types';
import { leadAsksOf } from '../../../../store/runtime/auto/asks/leadAsksOf';
import type { AppState } from '../../../../store/types';
import { autoFailedRootsOf } from '../../../../store/slices/session-view/autoRoots/autoFailedRootsOf';
import { autoLimitRootsOf } from '../../../../store/slices/session-view/autoRoots/autoLimitRootsOf';
import {
  autoWaitRootsOf,
  type AutoWaitState,
} from '../../../../store/slices/session-view/autoRoots/autoWaitRootsOf';
import {
  runWaitEntriesOf,
  type RunWaitState,
} from '../../../../store/slices/session-view/runWaitEntriesOf';
import { autoTreeWordOf } from '../../../auto/autoTreeWordOf';
import { runAwaitsPlanReview } from '../../../plans/runAwaitsPlanReview';
import { autoRunTitleOf } from '../../../session/autoRunTitleOf';
import type { RunWait } from '../../../workflows/runStateOf';
import { workflowKindName } from '../../../workflows/workflowKindName';
import { NAMES } from '../../../../shared/utils/names';
import { leadWaitWordsOf } from './leadWaitWordsOf';

export type WaitingRunState = AutoWaitState &
  RunWaitState &
  Pick<AppState, 'sessionPhaseRuns' | 'autoTreeViews' | 'transcripts' | 'settings'>;

export type WaitingRun = Readonly<{
  title: string;
  words: string;
  verb: string;
  more: number;
}>;

type Params = {
  readonly state: WaitingRunState;
  readonly session: Session;
  readonly reason: SessionAttentionReason | null;
};

type Named = Omit<WaitingRun, 'more'>;

const OPEN_RUN = 'Open run';

const PLAN_READY: Omit<Named, 'title'> = { words: NAMES.needsApproval, verb: 'Review plan' };

const RUN_WAIT_OF: Partial<Record<SessionAttentionReason, RunWait>> = {
  'run-stopped': 'stopped',
  'run-paused-at-limit': 'limit',
  'run-waits-for-go': 'go',
};

const NO_AGENTS: ReadonlyArray<Agent> = [];

type RootsParams = {
  readonly state: WaitingRunState;
  readonly session: Session;
  readonly roots: ReadonlyArray<Agent>;
  readonly fallback: string;
};

const leadRunsOf = ({ state, session, roots, fallback }: RootsParams): ReadonlyArray<Named> =>
  roots.flatMap((root) => {
    const view = state.autoTreeViews?.[session.id]?.find(
      (candidate) => candidate.tree.rootAgentId === root.id,
    );
    if (view === undefined) {
      return [];
    }
    const { lead } = autoTreeWordOf({ view, rootTurn: state.agentTurnState[root.id] ?? null });
    const wait = leadWaitWordsOf({ lead, askCount: leadAsksOf({ view }).length });
    const title = autoRunTitleOf({ state, sessionId: session.id, agentId: root.id });
    return title === null
      ? []
      : [{ title, words: wait?.words ?? fallback, verb: wait?.verb ?? OPEN_RUN }];
  });

type TitleParams = {
  readonly state: WaitingRunState;
  readonly session: Session;
  readonly run: WorkflowRun;
};

const runTitleOf = ({ state, session, run }: TitleParams): string | null => {
  if (run.title != null && run.title !== '') {
    return run.title;
  }
  const workflows: ReadonlyArray<Workflow> = [
    ...(state.sessionWorkflows?.[session.id] ?? []),
    ...(state.phaseTemplates?.[session.workspaceId] ?? []),
  ];
  const workflow = workflows.find((candidate) => candidate.id === run.workflowId);
  return workflow === undefined ? null : workflowKindName({ workflow });
};

type WaitingWorkflowRun = Omit<Named, 'title'> & {
  readonly run: WorkflowRun;
};

type RunsParams = {
  readonly state: WaitingRunState;
  readonly session: Session;
  readonly runs: ReadonlyArray<WaitingWorkflowRun>;
};

const workflowRunsOf = ({ state, session, runs }: RunsParams): ReadonlyArray<Named> =>
  runs.flatMap(({ run, words, verb }) => {
    const title = runTitleOf({ state, session, run });
    return title === null ? [] : [{ title, words, verb }];
  });

const waitingRunsOf = ({ state, session, reason }: Params): ReadonlyArray<Named> => {
  const agents = state.sessionPhaseRuns[session.id] ?? NO_AGENTS;
  if (reason === 'auto-needs-you') {
    const roots = autoWaitRootsOf({ state, session, agents });
    return leadRunsOf({ state, session, roots, fallback: 'Asks you' });
  }
  if (reason === 'agent-error') {
    const roots = autoFailedRootsOf({ state, session, agents });
    return leadRunsOf({ state, session, roots, fallback: 'Stopped on a failure' });
  }
  if (reason === 'plan-approval') {
    const held = session.workflowRuns
      .filter(
        (run) =>
          run.discardedAt == null && runAwaitsPlanReview({ state, sessionId: session.id, run }),
      )
      .map((run) => ({ run, ...PLAN_READY }));
    return workflowRunsOf({ state, session, runs: held });
  }
  const wait = reason === null ? undefined : RUN_WAIT_OF[reason];
  if (wait === undefined) {
    return [];
  }
  const entries = runWaitEntriesOf({ state, session, agents }).filter(
    (entry) => entry.wait === wait,
  );
  if (entries.length === 0 && wait === 'limit') {
    const roots = autoLimitRootsOf({ state, session, agents });
    return leadRunsOf({ state, session, roots, fallback: 'Paused at its limit' });
  }
  const runs = entries.flatMap((entry) => {
    const run = session.workflowRuns.find((candidate) => candidate.id === entry.runId);
    return run === undefined ? [] : [{ run, words: entry.word, verb: OPEN_RUN }];
  });
  return workflowRunsOf({ state, session, runs });
};

export const waitingRunOf = ({ state, session, reason }: Params): WaitingRun | null => {
  const [first, ...rest] = waitingRunsOf({ state, session, reason });
  return first === undefined ? null : { ...first, more: rest.length };
};
