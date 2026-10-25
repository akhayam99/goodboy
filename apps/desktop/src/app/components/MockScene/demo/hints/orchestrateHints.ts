import type { AppStore } from '../../../../../store/store';
import type { DemoHint, HintProbe } from './demoHintTypes';
import { hasElement } from './hasElement';

type StateParams = {
  readonly state: AppStore;
};

type TurnParams = StateParams & {
  readonly isApproval: boolean;
};

const APPROVAL_PREFIX = 'Approved plan';
const AUTO_START = 'textarea[aria-label="Start a run"]';
const AUTO_APPROVE = '[data-demo-anchor="auto-approve"]';
const AUTO_CHILD =
  'ul[aria-label="Delegations"] > li[data-delegation] > span > button[aria-label^="Open "]';
const RUN_APPROVE = '[data-demo-anchor="run-approve-plan"]';
const RUN_STEP = '[role="treeitem"][data-tree-id]';
const RUN_MODEL = 'button[aria-label^="Model routing"]';
const RUN_REPORT = 'button[data-testid="create-report-cta"]';

const isAutoSession = ({ state }: StateParams): boolean => {
  const sessionId = state.currentSessionId;
  return sessionId !== null && state.autoTreeViews[sessionId] !== undefined;
};

const isRunSession = ({ state }: StateParams): boolean => {
  const sessionId = state.currentSessionId;
  return sessionId !== null && (state.focusedWorkflowRunId[sessionId] ?? null) !== null;
};

const rootTurnsOf = ({ state, isApproval }: TurnParams): ReadonlySet<string> => {
  const roots = Object.values(state.autoTreeViews)
    .flat()
    .map((view) => view.tree.rootAgentId);
  return new Set(
    roots.flatMap((agentId) =>
      (state.transcripts[agentId] ?? []).flatMap((event) =>
        event.kind === 'user_text' && event.text.startsWith(APPROVAL_PREFIX) === isApproval
          ? [event.runId]
          : [],
      ),
    ),
  );
};

type NewTurnParams = HintProbe & {
  readonly isApproval: boolean;
};

const knownTurnsOf = ({ state }: StateParams): ReadonlySet<string> =>
  new Set(
    Object.values(state.transcripts).flatMap((events) =>
      events.flatMap((event) => (event.kind === 'user_text' ? [event.runId] : [])),
    ),
  );

const hasNewRootTurn = ({ state, start, isApproval }: NewTurnParams): boolean => {
  const known = knownTurnsOf({ state: start });
  return [...rootTurnsOf({ state, isApproval })].some((runId) => !known.has(runId));
};

const approvedRunsOf = ({ state }: StateParams): ReadonlySet<string> =>
  new Set(
    state.sessions.flatMap((session) =>
      session.workflowRuns.flatMap((run) =>
        run.rulesSnapshot?.planApproved === true ? [run.id] : [],
      ),
    ),
  );

const hasApprovedRun = ({ state, start }: HintProbe): boolean => {
  const before = approvedRunsOf({ state: start });
  return [...approvedRunsOf({ state })].some((runId) => !before.has(runId));
};

const routingOf = ({ state }: StateParams): string =>
  JSON.stringify([state.agentModelOverride, state.agentProviderOverride]);

const hasPickedModel = ({ state, start }: HintProbe): boolean =>
  routingOf({ state }) !== routingOf({ state: start });

export const ORCHESTRATE_HINTS: ReadonlyArray<DemoHint> = [
  {
    id: 'auto-start',
    copy: 'Describe a goal, then press Start',
    outcome: 'auto-started',
    anchor: AUTO_START,
    side: 'bottom',
    revealWhen: ({ state, root }) =>
      isAutoSession({ state }) && hasElement({ root, selector: AUTO_START }),
    doneWhen: (probe) => hasNewRootTurn({ ...probe, isApproval: false }),
  },
  {
    id: 'auto-approve',
    copy: 'Approve the plan to start the helpers',
    outcome: 'auto-approved',
    anchor: AUTO_APPROVE,
    revealWhen: ({ state, root }) =>
      isAutoSession({ state }) && hasElement({ root, selector: AUTO_APPROVE }),
    doneWhen: (probe) => hasNewRootTurn({ ...probe, isApproval: true }),
  },
  {
    id: 'auto-child',
    copy: 'Open a helper to follow its work',
    outcome: 'helper-opened',
    anchor: AUTO_CHILD,
    revealWhen: ({ state, root }) =>
      isAutoSession({ state }) &&
      state.drawer?.kind !== 'auto-child' &&
      hasElement({ root, selector: AUTO_CHILD }),
    doneWhen: ({ state }) => state.drawer?.kind === 'auto-child',
  },
  {
    id: 'run-approve',
    copy: 'Approve the plan to start the next step',
    outcome: 'run-approved',
    anchor: RUN_APPROVE,
    side: 'bottom',
    revealWhen: ({ state, root }) =>
      isRunSession({ state }) && hasElement({ root, selector: RUN_APPROVE }),
    doneWhen: hasApprovedRun,
  },
  {
    id: 'run-step',
    copy: 'Open a step to read its agent',
    outcome: 'step-opened',
    anchor: RUN_STEP,
    side: 'left',
    revealWhen: ({ state, root }) =>
      isRunSession({ state }) &&
      state.drawer?.kind !== 'run-step' &&
      hasElement({ root, selector: RUN_STEP }),
    doneWhen: ({ state }) => state.drawer?.kind === 'run-step',
  },
  {
    id: 'run-model',
    copy: 'Pick a model for this step',
    outcome: 'model-picked',
    anchor: RUN_MODEL,
    side: 'left',
    revealWhen: ({ state, root }) =>
      isRunSession({ state }) && hasElement({ root, selector: RUN_MODEL }),
    doneWhen: hasPickedModel,
  },
  {
    id: 'run-report',
    copy: 'Create a report of the run',
    outcome: null,
    anchor: RUN_REPORT,
    side: 'top',
    revealWhen: ({ state, root }) =>
      isRunSession({ state }) && hasElement({ root, selector: RUN_REPORT }),
    doneWhen: ({ isAnchorClicked }) => isAnchorClicked,
  },
];
