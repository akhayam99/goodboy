import type { AppStore } from '../../../../../store/store';
import { IMPLEMENTER_ID } from '../../scenes/u24/autoSceneSeed';
import { STORY_ROOT_ID, STORY_SESSION_ID } from '../../scenes/story/storyWorld';
import type { DemoHint, HintProbe } from './demoHintTypes';
import { hasElement } from './hasElement';
import { isOtherControl } from './isOtherControl';
import { replayAnchorOf } from './replayAnchorOf';

type StateParams = {
  readonly state: AppStore;
};

const PLAN_OPEN = 'button[data-testid="plan-row-open"]';
const COMPOSER = '[data-testid="plan-comment-composer"]';
const ADD_COMMENT = `${COMPOSER} button[data-variant="primary"]`;
const SEND = '[data-testid="plan-bar-send"]';
const APPROVE = '[data-testid="auto-plan-toolbar"] button[data-variant="primary"]';

const commentsOf = ({ state }: StateParams) => state.artifactComments[STORY_SESSION_ID] ?? [];

const addressedOf = ({ state }: StateParams): number =>
  commentsOf({ state }).filter((comment) => comment.status === 'addressed').length;

const draftsOf = ({ state }: StateParams): number =>
  commentsOf({ state }).filter((comment) => comment.status === 'draft').length;

const hasCoordinated = ({ state, start }: HintProbe): boolean => {
  const approvals = (state.transcripts[STORY_ROOT_ID] ?? []).filter(
    (event) => event.kind === 'user_text' && event.text.startsWith('Approved plan v'),
  ).length;
  const before = (start.transcripts[STORY_ROOT_ID] ?? []).filter(
    (event) => event.kind === 'user_text' && event.text.startsWith('Approved plan v'),
  ).length;
  const delegations = (state.autoTreeViews[STORY_SESSION_ID] ?? []).flatMap(
    (view) => view.delegations,
  );
  return (
    approvals > before &&
    state.agentTurnState[STORY_ROOT_ID]?.kind === 'idle' &&
    delegations.some(
      (delegation) => delegation.childAgentId === IMPLEMENTER_ID && delegation.state === 'settled',
    )
  );
};

export const GUIDE_HINTS: ReadonlyArray<DemoHint> = [
  {
    id: 'plan-open',
    label: 'View plan',
    copy: 'Open the plan',
    instruction: "Press the plan's title to read its proposed changes before work begins.",
    result:
      'The plan opens beside the planner, covering the payments-api fix and verification against ledger-core.',
    beat: 0,
    isDimmed: false,
    isBlocked: isOtherControl,
    anchor: PLAN_OPEN,
    side: 'top',
    revealWhen: ({ root }) => hasElement({ root, selector: PLAN_OPEN }),
    doneWhen: ({ state }) => state.drawer?.kind === 'artifact-document',
  },
  {
    id: 'plan-mark',
    label: 'Mark the test',
    copy: 'Comment on the test line',
    instruction: 'Press **Comment** on the replay-test paragraph to point out a missing case.',
    result:
      'The comment editor opens on that paragraph with the prepared text, "Test two retries arriving together."',
    beat: 0,
    isDimmed: false,
    isBlocked: isOtherControl,
    anchor: ({ root }) => replayAnchorOf({ root }),
    side: 'bottom',
    revealWhen: ({ root }) => replayAnchorOf({ root }) !== null,
    doneWhen: ({ root }) => hasElement({ root, selector: COMPOSER }),
  },
  {
    id: 'plan-comment',
    label: 'Add concurrent retries',
    copy: 'Add the prepared comment',
    instruction: 'Press **Add comment** to save the request against that plan line.',
    result: 'One draft comment is attached to the replay-test paragraph.',
    beat: 0,
    isDimmed: false,
    isBlocked: isOtherControl,
    anchor: ADD_COMMENT,
    side: 'bottom',
    revealWhen: ({ root }) => hasElement({ root, selector: ADD_COMMENT }),
    doneWhen: ({ state }) => draftsOf({ state }) > 0,
  },
  {
    id: 'plan-send',
    label: 'Send to planner',
    copy: 'Send your comment',
    progressCopy: 'Codex is revising the plan',
    instruction: 'Press **Send to planner** to ask Codex to update the plan.',
    progress: 'Codex is updating the plan with the simultaneous-retry test.',
    result: 'Plan v2 adds the simultaneous-retry test, and the comment reads **Addressed**.',
    beat: 0,
    dwellMs: 4500,
    isDimmed: false,
    isBlocked: isOtherControl,
    anchor: SEND,
    side: 'top',
    revealWhen: ({ root }) => hasElement({ root, selector: SEND }),
    doneWhen: ({ state, start }) => addressedOf({ state }) > addressedOf({ state: start }),
  },
  {
    id: 'plan-approve',
    label: 'Approve revised plan',
    copy: 'Approve the revised plan',
    progressCopy: 'Auto is coordinating',
    instruction: 'Press **Approve** to run the plan you have reviewed.',
    progress: 'Auto starts a Codex implementer in payments-api and a tester against ledger-core.',
    result:
      'Auto coordinates the payments-api implementer and ledger-core tester; their results show one credit for repeated deliveries and passing checks.',
    beat: 0,
    dwellMs: 4500,
    isDimmed: false,
    isBlocked: isOtherControl,
    anchor: APPROVE,
    side: 'top',
    revealWhen: ({ root, state }) =>
      addressedOf({ state }) > 0 && hasElement({ root, selector: APPROVE }),
    doneWhen: hasCoordinated,
  },
];
