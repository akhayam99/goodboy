import type { AppStore } from '../../../../../store/store';
import { STORY_REVIEW_SESSION_ID } from '../../scenes/story/storyReviewSeed';
import type { DemoHint } from './demoHintTypes';
import { hasElement } from './hasElement';
import { isOtherControl } from './isOtherControl';

type StateParams = {
  readonly state: AppStore;
};

const START_FIX = '[data-demo-anchor="resolve-start"]';
const APPLY_FIX = 'button[data-review-verb="reviewComment.accept"]';
const REBASE = 'button[data-worktree-verb="mount.rebase"]';
const CONFIRM = 'button[data-confirm-action="true"]';
const STORAGE_REMOVE = '[data-demo-anchor="storage-remove"]';

const itemsOf = ({ state }: StateParams) =>
  state.sessionResolveQueueItems[STORY_REVIEW_SESSION_ID] ?? [];

const hasDraftedReply = ({ state }: StateParams): boolean =>
  itemsOf({ state }).some(
    (entry) =>
      entry.thread.stage === 'proposed' && (entry.thread.replyDraft ?? '').trim().length > 0,
  );

const acceptedOf = ({ state }: StateParams): number =>
  itemsOf({ state }).filter((entry) => entry.item.approvalState === 'accepted').length;

const hasClosedThread = ({ state }: StateParams): boolean =>
  itemsOf({ state }).some((entry) => entry.thread.state === 'closed');

export const SHIP_HINTS: ReadonlyArray<DemoHint> = [
  {
    id: 'fix-start',
    label: 'Start review fix',
    copy: 'Start the review fix',
    progressCopy: 'The agent is fixing it',
    instruction: "Press **Start fix** to address nadia-p's request for a restart regression test.",
    progress: 'The agent is adding the test and drafting a reply to nadia-p.',
    result: "The agent wrote nadia-p's test and drafted a reply for you to review.",
    beat: 0,
    isDimmed: false,
    isBlocked: isOtherControl,
    anchor: START_FIX,
    side: 'top',
    revealWhen: ({ root }) => hasElement({ root, selector: START_FIX }),
    doneWhen: hasDraftedReply,
  },
  {
    id: 'fix-apply',
    label: 'Apply review fix',
    copy: 'Apply the reviewed fix',
    instruction: 'Press **Apply fix** to accept the test and the reply.',
    result: "The test is in your branch. nadia-p's thread stays open until you push.",
    beat: 0,
    isDimmed: false,
    isBlocked: isOtherControl,
    anchor: APPLY_FIX,
    side: 'top',
    revealWhen: ({ root }) => hasElement({ root, selector: APPLY_FIX }),
    doneWhen: ({ state, start }) => acceptedOf({ state }) > acceptedOf({ state: start }),
  },
  {
    id: 'fix-rebase',
    label: 'Rebase on main',
    copy: 'Bring in the latest changes',
    instruction: "Press **Rebase** to bring main's newer commits under your branch.",
    result: 'Your branch now sits on the latest main, and a backup was kept.',
    beat: 0,
    dwellMs: 4500,
    isDimmed: false,
    isBlocked: isOtherControl,
    anchor: REBASE,
    side: 'right',
    isSideLocked: true,
    revealWhen: ({ root }) => hasElement({ root, selector: REBASE }),
    doneWhen: ({ state, start }) =>
      Object.keys(state.historyRuns).length > Object.keys(start.historyRuns).length,
  },
  {
    id: 'fix-push',
    label: 'Push reviewed fix',
    copy: 'Confirm the push',
    instruction: 'Press **Force push** to publish the rebased branch with your fix.',
    result: "Pushed. nadia-p's thread is resolved.",
    beat: 0,
    dwellMs: 4500,
    isDimmed: false,
    isBlocked: isOtherControl,
    anchor: CONFIRM,
    side: 'bottom',
    isSideLocked: true,
    revealWhen: ({ root }) => hasElement({ root, selector: CONFIRM }),
    doneWhen: hasClosedThread,
  },
  {
    id: 'storage-remove',
    label: 'Free old folders',
    copy: 'Remove the old folders',
    instruction: 'Press **Remove** to free the three older Harborline folders.',
    result: 'The three old folders are gone and the space is yours again. Branches stay.',
    beat: 1,
    dwellMs: 4500,
    isDimmed: false,
    isBlocked: isOtherControl,
    anchor: ({ root }) =>
      hasElement({ root, selector: CONFIRM })
        ? CONFIRM
        : hasElement({ root, selector: STORAGE_REMOVE })
          ? STORAGE_REMOVE
          : null,
    side: 'bottom',
    revealWhen: ({ root }) =>
      hasElement({ root, selector: CONFIRM }) || hasElement({ root, selector: STORAGE_REMOVE }),
    doneWhen: ({ state }) => (state.storageOutcome?.removed ?? 0) > 0,
  },
];
