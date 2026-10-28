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
    result: 'The agent adds the test and presents its diff with a drafted reply.',
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
    instruction: 'Press **Apply fix** to accept the test and reply you have reviewed.',
    result: 'The fix is applied locally and marked ready to push; the host thread remains open.',
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
    instruction: "Press **Rebase** beside the behind-main status to bring in main's newer changes.",
    result:
      'The branch rebases cleanly, and the result reads **Rebased on main** with **Origin still has the old copy**.',
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
    instruction:
      'Press **Force push** in the prepared confirmation to publish the rebased branch and accepted review fix.',
    result:
      "The push succeeds, the drafted reply is published, and nadia-p's thread moves to **Done**.",
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
    instruction:
      "Press **Remove** in Storage's confirmation to reclaim the three older Harborline worktree folders.",
    result:
      "Storage names the folders removed and the space reclaimed; their branches remain, and the active task's worktree stays in use.",
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
