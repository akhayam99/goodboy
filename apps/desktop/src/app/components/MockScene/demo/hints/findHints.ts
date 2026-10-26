import { BOARD_STORY_SESSION } from '../../scenes/BoardScene';
import type { DemoHint } from './demoHintTypes';
import { hasElement } from './hasElement';

const STORY_CARD = `article[data-select-id="${BOARD_STORY_SESSION}"] button`;
const KIND_TABS = '[role="tablist"][aria-label="Artifact kind"]';
const REPORTS_TAB = `${KIND_TABS} > button[role="tab"]:nth-of-type(3)`;
const REPORT_ROW = 'button[data-artifact-row][aria-label^="Report Retried webhooks no longer"]';
const REPORT_DETAILS = 'button[data-testid="artifact-drawer-details"]';

export const FIND_HINTS: ReadonlyArray<DemoHint> = [
  {
    id: 'board-open',
    label: 'Open the waiting card',
    copy: 'This one needs you',
    instruction:
      'Open "Stop retried webhooks posting a second credit": Auto is done and it waits for you.',
    result: 'The session opened: its three branches wait for your review.',
    beat: 0,
    anchor: STORY_CARD,
    revealWhen: ({ state, root }) =>
      state.currentSessionId === null && hasElement({ root, selector: STORY_CARD }),
    doneWhen: ({ state }) => state.currentSessionId === BOARD_STORY_SESSION,
  },
  {
    id: 'library-reports',
    label: 'Open the reports',
    copy: 'Find the report',
    instruction: 'Open the Reports tab of the library: every agent writes its results there.',
    result: 'Two reports are listed, the newest first.',
    beat: 1,
    anchor: REPORTS_TAB,
    side: 'bottom',
    revealWhen: ({ root }) => hasElement({ root, selector: REPORTS_TAB }),
    doneWhen: ({ root }) =>
      root.querySelector(REPORTS_TAB)?.getAttribute('aria-selected') === 'true',
  },
  {
    id: 'report-open',
    label: 'Open the run report',
    copy: 'Read the report',
    instruction: 'Open "Retried webhooks no longer double credit": the report of this session.',
    result: 'The report opened: what was wrong, what changed and the evidence.',
    beat: 1,
    anchor: REPORT_ROW,
    side: 'bottom',
    revealWhen: ({ root }) => hasElement({ root, selector: REPORT_ROW }),
    doneWhen: ({ root }) => hasElement({ root, selector: REPORT_DETAILS }),
  },
  {
    id: 'report-details',
    label: 'Open the report details',
    copy: 'Where it comes from',
    instruction: 'Open Details to see which sessions and code the report is based on.',
    result: 'The report lists the sessions and the code it is based on.',
    beat: 1,
    anchor: REPORT_DETAILS,
    side: 'bottom',
    revealWhen: ({ root }) => hasElement({ root, selector: REPORT_DETAILS }),
    doneWhen: ({ isAnchorClicked }) => isAnchorClicked,
  },
];
