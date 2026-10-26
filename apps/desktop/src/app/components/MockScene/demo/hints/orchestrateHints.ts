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

const isAutoSession = ({ state }: StateParams): boolean => {
  const sessionId = state.currentSessionId;
  return sessionId !== null && state.autoTreeViews[sessionId] !== undefined;
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

export const ORCHESTRATE_HINTS: ReadonlyArray<DemoHint> = [
  {
    id: 'auto-start',
    label: 'Give Auto a goal',
    copy: 'Give Auto a goal',
    instruction:
      'Describe a goal and press Start: Auto plans it and splits the work between agents.',
    result: 'Auto is planning: a planner agent reads the code before anything is written.',
    beat: 0,
    anchor: AUTO_START,
    focus: 'section[aria-label="Start a run"]',
    side: 'bottom',
    revealWhen: ({ state, root }) =>
      isAutoSession({ state }) && hasElement({ root, selector: AUTO_START }),
    doneWhen: (probe) => hasNewRootTurn({ ...probe, isApproval: false }),
  },
  {
    id: 'auto-approve',
    label: 'Approve the plan',
    copy: 'Approve to go',
    instruction: 'Press Approve plan: Auto then starts the helper agents that run each part.',
    result: 'The plan is approved: Auto starts the helpers.',
    beat: 0,
    anchor: AUTO_APPROVE,
    revealWhen: ({ state, root }) =>
      isAutoSession({ state }) && hasElement({ root, selector: AUTO_APPROVE }),
    doneWhen: (probe) => hasNewRootTurn({ ...probe, isApproval: true }),
  },
  {
    id: 'auto-child',
    label: 'Follow a helper',
    copy: 'Follow a helper',
    instruction: 'Open a helper agent to follow what it is doing and what it has finished.',
    result: 'The helper opened: you read its work next to the plan.',
    beat: 0,
    anchor: AUTO_CHILD,
    revealWhen: ({ state, root }) =>
      isAutoSession({ state }) &&
      state.drawer?.kind !== 'auto-child' &&
      hasElement({ root, selector: AUTO_CHILD }),
    doneWhen: ({ state }) => state.drawer?.kind === 'auto-child',
  },
];
