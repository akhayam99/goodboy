import type { AppStore } from '../../../../../store/store';
import { IMPLEMENTER_ID } from '../../scenes/u24/autoSceneSeed';
import { STORY_ROOT_ID, STORY_SESSION_ID } from '../../scenes/story/storyWorld';
import type { BlockParams, DemoHint } from './demoHintTypes';
import { hasElement } from './hasElement';
import { isOtherControl } from './isOtherControl';
import { replayAnchorOf } from './replayAnchorOf';

type StateParams = {
  readonly state: AppStore;
};

type RootParams = {
  readonly root: Document;
};

type OwnParams = {
  readonly root: Document;
  readonly own: string;
};

const PLAN_OPEN = 'button[data-testid="plan-row-open"]';
const COMPOSER = '[data-testid="plan-comment-composer"]';
const ADD_COMMENT = `${COMPOSER} button[data-variant="primary"]`;
const SEND = '[data-testid="plan-bar-send"]';
const APPROVE = '[data-testid="auto-plan-toolbar"] button[data-variant="primary"]';
const APPROVAL_PREFIX = 'Approved plan v';

const commentsOf = ({ state }: StateParams) => state.artifactComments[STORY_SESSION_ID] ?? [];

const addressedOf = ({ state }: StateParams): number =>
  commentsOf({ state }).filter((comment) => comment.status === 'addressed').length;

const draftsOf = ({ state }: StateParams): number =>
  commentsOf({ state }).filter((comment) => comment.status === 'draft').length;

const approvalsOf = ({ state }: StateParams): number =>
  (state.transcripts[STORY_ROOT_ID] ?? []).filter(
    (event) => event.kind === 'user_text' && event.text.startsWith(APPROVAL_PREFIX),
  ).length;

const hasCommented = ({ state }: StateParams): boolean => commentsOf({ state }).length > 0;

const hasCoordinated = ({ state }: StateParams): boolean => {
  const delegations = (state.autoTreeViews[STORY_SESSION_ID] ?? []).flatMap(
    (view) => view.delegations,
  );
  return (
    approvalsOf({ state }) > 0 &&
    state.agentTurnState[STORY_ROOT_ID]?.kind === 'idle' &&
    delegations.some(
      (delegation) => delegation.childAgentId === IMPLEMENTER_ID && delegation.state === 'settled',
    )
  );
};

const recoveryOf = ({ root }: RootParams): string | null =>
  replayAnchorOf({ root }) ?? (hasElement({ root, selector: PLAN_OPEN }) ? PLAN_OPEN : null);

const anchorOrRecovery = ({ root, own }: OwnParams): string | null =>
  hasElement({ root, selector: own }) ? own : recoveryOf({ root });

const isOtherThanPlanRow = ({ target }: BlockParams): boolean =>
  target.closest(PLAN_OPEN) === null && isOtherControl({ target });

export const GUIDE_HINTS: ReadonlyArray<DemoHint> = [
  {
    id: 'plan-open',
    label: 'View plan',
    copy: 'Open the plan',
    instruction: "Press the plan's title to read what it will change.",
    result: 'The plan is open: a fix in payments-api, checked against ledger-core.',
    beat: 0,
    isDimmed: false,
    isBlocked: isOtherControl,
    anchor: PLAN_OPEN,
    side: 'left',
    isSideLocked: true,
    revealWhen: ({ root }) => hasElement({ root, selector: PLAN_OPEN }),
    doneWhen: ({ state }) => state.drawer?.kind === 'artifact-document' || hasCommented({ state }),
  },
  {
    id: 'plan-mark',
    label: 'Mark the test',
    copy: 'Comment on the test line',
    instruction: 'Press **Comment** on the test paragraph to point out a missing case.',
    result: 'Your comment is started, with the missing retry case already written in.',
    beat: 0,
    isDimmed: false,
    isBlocked: isOtherThanPlanRow,
    anchor: ({ root }) => recoveryOf({ root }),
    side: 'top',
    isSideLocked: true,
    revealWhen: ({ root, state }) => recoveryOf({ root }) !== null || hasCommented({ state }),
    doneWhen: ({ root, state }) =>
      hasElement({ root, selector: COMPOSER }) || hasCommented({ state }),
  },
  {
    id: 'plan-comment',
    label: 'Add concurrent retries',
    copy: 'Add the prepared comment',
    instruction: 'Press **Add comment** to attach it to that line of the plan.',
    result: 'Your comment is attached to the test line, ready to send.',
    beat: 0,
    isDimmed: false,
    isBlocked: isOtherThanPlanRow,
    anchor: ({ root }) => anchorOrRecovery({ root, own: ADD_COMMENT }),
    side: 'left',
    isSideLocked: true,
    revealWhen: ({ root, state }) =>
      anchorOrRecovery({ root, own: ADD_COMMENT }) !== null || hasCommented({ state }),
    doneWhen: ({ state }) => hasCommented({ state }),
  },
  {
    id: 'plan-send',
    label: 'Send to planner',
    copy: 'Send your comment',
    progressCopy: 'Codex is revising the plan',
    instruction: 'Press **Send to planner** to ask Codex to update the plan.',
    progress: 'Codex is updating the plan with the simultaneous-retry test.',
    result: 'Your comment is in plan v2, marked **Addressed**.',
    beat: 0,
    dwellMs: 4500,
    isDimmed: false,
    isBlocked: isOtherThanPlanRow,
    anchor: ({ root, state }) =>
      draftsOf({ state }) > 0 ? anchorOrRecovery({ root, own: SEND }) : SEND,
    side: 'left',
    isSideLocked: true,
    revealWhen: ({ root, state }) =>
      hasElement({ root, selector: SEND }) ||
      (draftsOf({ state }) > 0 && recoveryOf({ root }) !== null) ||
      addressedOf({ state }) > 0,
    doneWhen: ({ state }) => addressedOf({ state }) > 0,
  },
  {
    id: 'plan-approve',
    label: 'Approve revised plan',
    copy: 'Approve the revised plan',
    progressCopy: 'Auto is coordinating',
    instruction: 'Press **Approve and start Build** to run the plan you have reviewed.',
    progress: 'Auto starts a Codex implementer in payments-api and a tester against ledger-core.',
    result: 'Plan approved. One agent wrote the fix, another ran the checks, and they passed.',
    beat: 0,
    dwellMs: 4500,
    isDimmed: false,
    isBlocked: isOtherThanPlanRow,
    anchor: ({ root, state }) =>
      approvalsOf({ state }) === 0 ? anchorOrRecovery({ root, own: APPROVE }) : APPROVE,
    side: 'bottom',
    isSideLocked: true,
    revealWhen: ({ root, state }) =>
      approvalsOf({ state }) > 0 ||
      (addressedOf({ state }) > 0 && anchorOrRecovery({ root, own: APPROVE }) !== null),
    doneWhen: hasCoordinated,
  },
];
