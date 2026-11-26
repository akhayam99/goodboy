import type { AppStore } from '../../../../../store/store';
import { STORY_SESSION_ID } from '../../scenes/story/storyWorld';
import type { DemoHint } from './demoHintTypes';
import { hasElement } from './hasElement';
import { isOtherControl } from './isOtherControl';

type RootParams = {
  readonly root: Document;
};

type StateParams = {
  readonly state: AppStore;
};

const OPTION = '[data-oq-anchor] button[role="radio"][aria-label="Return the original credit"]';
const ANSWER = '[data-oq-anchor] [data-demo-anchor="question-answer"]';

const hasAnswered = ({ state }: StateParams): boolean =>
  (state.sessionAnsweredQuestions[STORY_SESSION_ID] ?? []).some(
    (question) => question.status === 'answered',
  );

const hasPlan = ({ state }: StateParams): boolean =>
  (state.sessionPlans[STORY_SESSION_ID] ?? []).length > 0;

const isOptionChecked = ({ root }: RootParams): boolean =>
  root.querySelector(OPTION)?.getAttribute('aria-checked') === 'true';

export const DIRECTION_HINTS: ReadonlyArray<DemoHint> = [
  {
    id: 'story-choose',
    label: 'Choose retry behavior',
    copy: 'Pick the recommended answer',
    instruction:
      'Select **Return the original credit** so a retry succeeds without another credit.',
    result: 'Your answer is picked. The planner waits until you send it.',
    beat: 0,
    isDimmed: false,
    isBlocked: isOtherControl,
    anchor: OPTION,
    side: 'top',
    isSideLocked: true,
    align: 'end',
    revealWhen: ({ root, state }) =>
      hasElement({ root, selector: OPTION }) || hasAnswered({ state }),
    doneWhen: ({ root, state }) => isOptionChecked({ root }) || hasAnswered({ state }),
  },
  {
    id: 'story-answer',
    label: 'Answer the agent',
    copy: 'Send your answer',
    progressCopy: 'Codex is taking over',
    instruction: 'Press **Answer** to let the planner continue with that decision.',
    progress: 'Claude hit its limit. Codex is carrying on with the same task and writing the plan.',
    result: 'Claude hit its limit, so Codex picked up the same task and wrote the plan.',
    beat: 0,
    isDimmed: false,
    isBlocked: isOtherControl,
    anchor: ANSWER,
    side: 'top',
    revealWhen: ({ root, state }) =>
      (hasElement({ root, selector: ANSWER }) && isOptionChecked({ root })) ||
      hasAnswered({ state }),
    doneWhen: ({ state }) => hasAnswered({ state }) && hasPlan({ state }),
  },
];
