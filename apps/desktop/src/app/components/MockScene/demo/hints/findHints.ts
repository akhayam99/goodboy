import type { AppStore } from '../../../../../store/store';
import type { DemoHint, HintProbe } from './demoHintTypes';
import { hasElement } from './hasElement';

type StateParams = {
  readonly state: AppStore;
};

const CARD = 'article[data-select-id]';
const FILTER = '[data-page="board"] button[aria-label="Filter sessions"]';
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

const isPlanOpen = ({ root }: Pick<HintProbe, 'root'>): boolean =>
  hasElement({ root, selector: '[data-testid="plan-prose-comments"]' });

export const FIND_HINTS: ReadonlyArray<DemoHint> = [
  {
    id: 'board-filter',
    label: 'Filter the board',
    copy: 'Narrow the board',
    instruction: 'Filter the board by folder to see only the sessions of one project.',
    result: 'The board now shows one project only.',
    beat: 0,
    anchor: FILTER,
    side: 'left',
    revealWhen: ({ root }) => hasElement({ root, selector: FILTER }),
    doneWhen: ({ state, start }) => filtersOf({ state }) !== filtersOf({ state: start }),
  },
  {
    id: 'board-open',
    label: 'Open the card that needs you',
    copy: 'This one needs you',
    instruction: 'Open the card marked as waiting: its session cannot go on without you.',
    result: 'The session opened: it is waiting on your answer.',
    beat: 0,
    anchor: ({ state }) => waitingCardOf({ state }),
    revealWhen: ({ state, root }) =>
      state.currentSessionId === null && hasElement({ root, selector: CARD }),
    doneWhen: ({ state }) => state.currentSessionId !== null,
  },
  {
    id: 'plan-open',
    label: 'Open a plan',
    copy: 'Read the plan',
    instruction: 'Open a plan from the library to read what an agent proposed before it acts.',
    result: 'The plan opened: read it before the agent acts.',
    beat: 1,
    anchor: PLAN_ROW,
    side: 'bottom',
    revealWhen: ({ root }) => hasElement({ root, selector: PLAN_ROW }) && !isPlanOpen({ root }),
    doneWhen: ({ root }) => isPlanOpen({ root }),
  },
  {
    id: 'report-details',
    label: 'Open the report details',
    copy: 'Where it comes from',
    instruction: 'Open the report details to see which sessions and code the report is based on.',
    result: 'The report lists the sessions and the code it is based on.',
    beat: 2,
    anchor: REPORT_DETAILS,
    side: 'bottom',
    revealWhen: ({ root }) => hasElement({ root, selector: REPORT_DETAILS }),
    doneWhen: ({ isAnchorClicked }) => isAnchorClicked,
  },
];
