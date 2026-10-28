import type { AppStore } from '../../../../../store/store';
import type { DemoHint, HintProbe } from './demoHintTypes';
import { hasElement } from './hasElement';
import { isOtherControl } from './isOtherControl';

type RootParams = {
  readonly root: Document;
};

type StateParams = {
  readonly state: AppStore;
};

const isOnFirstSession = ({ root }: RootParams): boolean =>
  root.querySelector('[aria-label="Goodboy setup"]')?.getAttribute('data-step') === 'first-session';

const ISSUE = 'HBL-412';
const OPTION = '[data-oq-anchor] button[role="radio"][aria-label="Return the original credit"]';
const ANSWER = '[data-oq-anchor] [data-demo-anchor="question-answer"]';
const DRAFT = '[data-step="first-session"] [data-demo-anchor="setup-first-start"]';
const START = '[data-demo-anchor="draft-start"]';

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

const answeredOf = ({ state }: StateParams): number =>
  Object.values(state.sessionAnsweredQuestions)
    .flat()
    .filter((question) => question.status === 'answered').length;

const hasPlan = ({ state }: StateParams): boolean =>
  Object.values(state.sessionPlans).flat().length > 0;

export const DIRECTION_HINTS: ReadonlyArray<DemoHint> = [
  {
    id: 'story-draft',
    label: 'Draft issue brief',
    copy: 'Draft the issue brief',
    instruction: 'Press **Draft the brief** to use HBL-412 as the task.',
    result:
      'New session opens with HBL-412 linked, its goal filled in and the prepared **Orchestrated** workflow selected.',
    beat: 0,
    anchor: DRAFT,
    focus: '[data-testid="wizard-column"]',
    isBlocked: isOtherControl,
    revealWhen: ({ root }) => isOnFirstSession({ root }) && hasElement({ root, selector: DRAFT }),
    doneWhen: ({ state }) => state.openSessionDraftWorkspaceId !== null,
  },
  {
    id: 'story-start',
    label: 'Start issue work',
    copy: 'Start work on this issue',
    instruction: 'Press **Start workflow** to begin work on HBL-412.',
    result:
      'One issue-linked session starts; Claude\'s planner asks, "What should a repeated webhook return?"',
    beat: 0,
    isDimmed: false,
    isBlocked: isOtherControl,
    anchor: START,
    side: 'top',
    revealWhen: ({ root }) => hasElement({ root, selector: START }),
    doneWhen: hasNewIssueSession,
  },
  {
    id: 'story-choose',
    label: 'Choose retry behavior',
    copy: 'Choose the recommended answer',
    instruction:
      'Select **Return the original credit** so a retry succeeds without another credit.',
    result: 'That answer is selected; the question still waits for submission.',
    beat: 0,
    isDimmed: false,
    isBlocked: isOtherControl,
    anchor: OPTION,
    side: 'left',
    revealWhen: ({ root }) => hasElement({ root, selector: OPTION }),
    doneWhen: ({ root }) => root.querySelector(OPTION)?.getAttribute('aria-checked') === 'true',
  },
  {
    id: 'story-answer',
    label: 'Answer the agent',
    copy: 'Send your answer',
    progressCopy: 'Codex is taking over',
    instruction: 'Press **Answer** to let the planner continue with that decision.',
    progress: 'Claude reached its limit. Codex carries on with the same task and writes the plan.',
    result:
      'Claude hits its limit on continuation; the chat records the move to Codex, which carries on planning the same task and returns the plan.',
    beat: 0,
    dwellMs: 4500,
    isDimmed: false,
    isBlocked: isOtherControl,
    anchor: ANSWER,
    side: 'top',
    revealWhen: ({ root }) =>
      hasElement({ root, selector: ANSWER }) &&
      root.querySelector(OPTION)?.getAttribute('aria-checked') === 'true',
    doneWhen: ({ state, start }) =>
      answeredOf({ state }) > answeredOf({ state: start }) && hasPlan({ state }),
  },
];
