import type { AppStore } from '../../../../../store/store';
import type { DemoHint, HintProbe } from './demoHintTypes';
import { hasElement } from './hasElement';

type StateParams = {
  readonly state: AppStore;
};

type RootParams = {
  readonly root: Document;
};

const PLAN_PROSE = '[data-testid="plan-prose-comments"]';
const CARD = 'article[data-select-id]';
const FILTER = '[data-page="board"] button[aria-label="Filter sessions"]';
const NEW_ARTIFACT = 'button[data-testid="artifact-new"]';
const REPORT_DETAILS = 'button[data-testid="artifact-drawer-details"]';
const PLAN_ROW = 'button[data-artifact-row][aria-label^="Plan "]';

const waitingCardOf = ({ state }: StateParams): string => {
  const waiting = Object.entries(state.sessionOpenQuestions).find(([, questions]) =>
    questions.some((question) => question.status === 'open'),
  );
  return waiting === undefined
    ? `${CARD} button`
    : `${CARD}[data-select-id="${CSS.escape(waiting[0])}"] button`;
};

const filtersOf = ({ state }: StateParams): string =>
  JSON.stringify([state.selectedProjectIds, state.sessionViewPrefs]);

const commentCountOf = ({ state }: StateParams): number =>
  Object.values(state.artifactComments).flat().length;

const isPlanOpen = ({ root }: RootParams): boolean => hasElement({ root, selector: PLAN_PROSE });

const hasCommented = ({ state, start }: HintProbe): boolean =>
  commentCountOf({ state }) > commentCountOf({ state: start });

export const FIND_HINTS: ReadonlyArray<DemoHint> = [
  {
    id: 'board-filter',
    copy: 'Narrow the board',
    instruction: 'Filter the board by folder to see only the sessions of one project.',
    outcome: 'board-filtered',
    anchor: FILTER,
    side: 'left',
    revealWhen: ({ root }) => hasElement({ root, selector: FILTER }),
    doneWhen: ({ state, start }) => filtersOf({ state }) !== filtersOf({ state: start }),
  },
  {
    id: 'board-open',
    copy: 'This one needs you',
    instruction: 'Open the card marked as waiting: its session cannot go on without you.',
    outcome: 'session-opened',
    anchor: ({ state }) => waitingCardOf({ state }),
    revealWhen: ({ state, root }) =>
      state.currentSessionId === null && hasElement({ root, selector: CARD }),
    doneWhen: ({ state }) => state.currentSessionId !== null,
  },
  {
    id: 'plan-open',
    copy: 'Read the plan',
    instruction: 'Open a plan from the library to read what an agent proposed before it acts.',
    outcome: null,
    anchor: PLAN_ROW,
    side: 'bottom',
    revealWhen: ({ root }) => hasElement({ root, selector: PLAN_ROW }) && !isPlanOpen({ root }),
    doneWhen: ({ root }) => isPlanOpen({ root }),
  },
  {
    id: 'plan-comment',
    copy: 'Comment on a line',
    instruction:
      'Click a line of the plan and leave a comment: the agent reads it on the next run.',
    outcome: 'plan-commented',
    anchor: PLAN_PROSE,
    revealWhen: isPlanOpen,
    doneWhen: hasCommented,
  },
  {
    id: 'library-new',
    copy: 'Start something new',
    instruction: 'Open New to create a plan or a report from the library.',
    outcome: null,
    anchor: NEW_ARTIFACT,
    side: 'bottom',
    revealWhen: ({ root }) => hasElement({ root, selector: NEW_ARTIFACT }),
    doneWhen: ({ root, isAnchorClicked }) =>
      isAnchorClicked || root.querySelector(`${NEW_ARTIFACT}[aria-expanded="true"]`) !== null,
  },
  {
    id: 'report-details',
    copy: 'Where it comes from',
    instruction: 'Open the report details to see which sessions and code the report is based on.',
    outcome: null,
    anchor: REPORT_DETAILS,
    side: 'bottom',
    revealWhen: ({ root }) => hasElement({ root, selector: REPORT_DETAILS }),
    doneWhen: ({ isAnchorClicked }) => isAnchorClicked,
  },
];
