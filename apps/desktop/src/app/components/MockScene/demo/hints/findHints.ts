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
    copy: 'Filter the board by folder',
    outcome: 'board-filtered',
    anchor: FILTER,
    side: 'left',
    revealWhen: ({ root }) => hasElement({ root, selector: FILTER }),
    doneWhen: ({ state, start }) => filtersOf({ state }) !== filtersOf({ state: start }),
  },
  {
    id: 'board-open',
    copy: 'Open the card that needs you',
    outcome: 'session-opened',
    anchor: ({ state }) => waitingCardOf({ state }),
    revealWhen: ({ state, root }) =>
      state.currentSessionId === null && hasElement({ root, selector: CARD }),
    doneWhen: ({ state }) => state.currentSessionId !== null,
  },
  {
    id: 'plan-open',
    copy: 'Open a plan from the library',
    outcome: null,
    anchor: PLAN_ROW,
    side: 'bottom',
    revealWhen: ({ root }) => hasElement({ root, selector: PLAN_ROW }) && !isPlanOpen({ root }),
    doneWhen: ({ root }) => isPlanOpen({ root }),
  },
  {
    id: 'plan-comment',
    copy: 'Point at a line, then comment on it',
    outcome: 'plan-commented',
    anchor: PLAN_PROSE,
    revealWhen: isPlanOpen,
    doneWhen: hasCommented,
  },
];
