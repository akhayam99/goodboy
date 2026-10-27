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
const AUTO_LEDGER_HELPER =
  'ul[aria-label="Delegations"] > li[data-delegation="mock-auto-delegation-ledger"] > span > button[aria-label^="Open "]';

const RUN_MENU = 'button[aria-label$="run actions"]';
const SAVE_PRESET = 'button[role="menuitem"][data-menu-label="Save as preset"]';

const presetCountOf = ({ state }: StateParams): number =>
  Object.values(state.phaseTemplates)
    .flat()
    .filter((workflow) => workflow.isPreset === true).length;

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

type NewTurnParams = Pick<HintProbe, 'state' | 'start'> & {
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
      'Type a goal, for example "Make every webhook consumer idempotent across payments-api and ledger-core, with a replay test", and press Start.',
    result:
      'Auto is planning: a Planner reads payments-api and ledger-core before anything is written.',
    beat: 0,
    anchor: AUTO_START,
    focus: 'section[aria-label="Start a run"]',
    side: 'bottom',
    revealWhen: ({ state, root }) =>
      isAutoSession({ state }) && hasElement({ root, selector: AUTO_START }),
    doneWhen: ({ state, start }) => hasNewRootTurn({ state, start, isApproval: false }),
  },
  {
    id: 'auto-approve',
    label: 'Approve the plan',
    copy: 'Approve the plan',
    instruction: 'Press Approve plan: Auto then starts three helpers, each on its own branch.',
    result: 'Three helpers started: two on payments-api and one on ledger-core.',
    beat: 0,
    anchor: AUTO_APPROVE,
    revealWhen: ({ state, root }) =>
      isAutoSession({ state }) && hasElement({ root, selector: AUTO_APPROVE }),
    doneWhen: ({ state, start }) => hasNewRootTurn({ state, start, isApproval: true }),
  },
  {
    id: 'auto-child',
    label: 'Follow a helper',
    copy: 'Open the ledger-core helper',
    instruction:
      'Open a helper, for example the ledger-core one, to follow what it does on its branch.',
    result: 'The helper opened: its brief, its work and its checks are next to Auto.',
    beat: 0,
    dwellMs: 4500,
    anchor: AUTO_LEDGER_HELPER,
    revealWhen: ({ state, root }) =>
      isAutoSession({ state }) &&
      state.drawer?.kind !== 'auto-child' &&
      hasElement({ root, selector: AUTO_LEDGER_HELPER }),
    doneWhen: ({ state }) => state.drawer?.kind === 'auto-child',
  },
  {
    id: 'run-save',
    label: 'Save it as a workflow',
    copy: 'Save this run as a preset',
    progressCopy: 'Choose Save as preset',
    instruction:
      'The three helpers finished. Open the run menu and press Save as preset to start this run again later.',
    result: 'The run is saved as a preset and sits in the Workflows studio.',
    progress: 'Press Save as preset in the menu.',
    beat: 1,
    anchor: ({ root }) => (hasElement({ root, selector: SAVE_PRESET }) ? SAVE_PRESET : RUN_MENU),
    side: 'bottom',
    revealWhen: ({ root }) =>
      hasElement({ root, selector: RUN_MENU }) || hasElement({ root, selector: SAVE_PRESET }),
    doneWhen: ({ state, start }) => presetCountOf({ state }) > presetCountOf({ state: start }),
  },
];
