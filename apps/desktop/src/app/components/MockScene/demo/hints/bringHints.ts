import { STORY_SESSION_ID } from '../../scenes/story/storyWorld';
import type { AppStore } from '../../../../../store/store';
import type { BlockParams, DemoHint, HintProbe } from './demoHintTypes';
import { hasElement } from './hasElement';
import { isAnyControl } from './isAnyControl';
import { KEY_FIELD, pasteExampleKey } from './pasteExampleKey';

type StateParams = {
  readonly state: AppStore;
};

type RootParams = {
  readonly root: Document;
};

const ISSUE = 'HBL-412';
const LINEAR_STEPS = '[aria-label="Connect Linear"]';
const RAIL_TASKS = '[data-shell-rail-item="inbox"]';
const TASK_ROW = `[role="option"][aria-label^="${ISSUE} "]`;
const START_SESSION = '[data-demo-anchor="task-start"]';
const START = '[data-demo-anchor="draft-start"]';
const OPTION = '[role="option"]';

const hasLinear = ({ state }: StateParams): boolean =>
  Object.values(state.workspaceIntegrations)
    .flat()
    .some((binding) => binding.provider === 'linear');

const sessionIdsOf = ({ state }: StateParams): ReadonlySet<string> =>
  new Set(state.sessions.map((session) => session.id));

const hasNewIssueSession = ({ state, start }: HintProbe): boolean => {
  const known = sessionIdsOf({ state: start });
  return state.sessions.some(
    (session) =>
      !known.has(session.id) &&
      (state.sessionExternalTasks[session.id] ?? []).some((task) => task.identifier === ISSUE),
  );
};

const hasStoryQuestion = ({ state }: StateParams): boolean =>
  (state.sessionOpenQuestions[STORY_SESSION_ID] ?? []).length > 0;

const hasStartedAndAsked = ({ state, start, root, isAnchorClicked }: HintProbe): boolean =>
  hasNewIssueSession({ state, start, root, isAnchorClicked }) && hasStoryQuestion({ state });

const isTaskRowSelected = ({ root }: RootParams): boolean =>
  root.querySelector(TASK_ROW)?.getAttribute('aria-selected') === 'true';

const isOffPath = ({ target }: BlockParams): boolean =>
  isAnyControl({ target }) || target.closest(OPTION) !== null;

const REOPEN = {
  copy: 'Reopen HBL-412',
  instruction: 'Press HBL-412 to open it again and go on.',
  side: 'right',
} as const satisfies DemoHint['recovery'];

const startSessionAnchorOf = ({ root }: RootParams): string | null =>
  isTaskRowSelected({ root }) && hasElement({ root, selector: START_SESSION })
    ? START_SESSION
    : null;

export const BRING_HINTS: ReadonlyArray<DemoHint> = [
  {
    id: 'bring-connect',
    label: 'Connect Linear',
    copy: 'Connect Linear',
    instruction: 'Press **Paste example key** to connect Linear with a demo key.',
    result:
      "Linear is **Connected** as dana@harborline.dev, so Harborline's issues can be read here.",
    beat: 0,
    anchor: KEY_FIELD,
    focus: LINEAR_STEPS,
    side: 'right',
    isBlocked: isOffPath,
    offer: {
      eyebrow: 'Demo',
      title: 'Paste the example key',
      note: 'A demo key, it only works here',
      label: 'Paste example key',
      run: pasteExampleKey,
    },
    revealWhen: ({ root }) => hasElement({ root, selector: KEY_FIELD }),
    doneWhen: ({ state, start }) => hasLinear({ state }) && !hasLinear({ state: start }),
  },
  {
    id: 'bring-tasks',
    label: 'Open your tasks',
    copy: 'Open your tasks',
    instruction: "Press **Tasks** to see everything Harborline's tools sent.",
    result: 'Tasks lists 11 items from five tools. The new ones are marked.',
    beat: 0,
    anchor: RAIL_TASKS,
    side: 'right',
    isBlocked: isOffPath,
    revealWhen: ({ root, state }) =>
      hasLinear({ state }) && hasElement({ root, selector: RAIL_TASKS }),
    doneWhen: ({ root }) => hasElement({ root, selector: TASK_ROW }),
  },
  {
    id: 'bring-open',
    label: 'Open HBL-412',
    copy: 'Open the duplicate credit bug',
    instruction: 'Press **HBL-412** to read the duplicate credit bug.',
    result: 'HBL-412 is open, with the description of the duplicate credit.',
    beat: 0,
    anchor: TASK_ROW,
    side: 'right',
    isBlocked: isOffPath,
    revealWhen: ({ root }) => hasElement({ root, selector: TASK_ROW }),
    doneWhen: ({ root }) => isTaskRowSelected({ root }),
  },
  {
    id: 'bring-session',
    label: 'Start session',
    copy: 'Hand it to your agents',
    instruction: 'Press **Start session** to hand HBL-412 to your agents.',
    result: 'A new session opens, and the brief is written from HBL-412.',
    beat: 0,
    anchor: ({ root }) => startSessionAnchorOf({ root }),
    recoveryAnchor: TASK_ROW,
    recovery: REOPEN,
    isBlocked: isOffPath,
    revealWhen: ({ root }) =>
      hasElement({ root, selector: START_SESSION }) || hasElement({ root, selector: TASK_ROW }),
    doneWhen: ({ state }) => state.openSessionDraftWorkspaceId !== null,
  },
  {
    id: 'bring-start',
    label: 'Start work',
    copy: 'Start work on this issue',
    instruction: 'Press **Start** to begin work on HBL-412.',
    progressCopy: 'The Lead is handing it to a planner',
    progress: 'The Lead reads HBL-412, hands it to a planner, and the planner reads the code.',
    result: 'Work started. The Lead hands it to a planner, which has one question first.',
    beat: 0,
    isDimmed: false,
    anchor: START,
    side: 'top',
    isBlocked: isOffPath,
    revealWhen: ({ root }) => hasElement({ root, selector: START }),
    doneWhen: hasStartedAndAsked,
  },
];
