import type { ResolveAttempt, ResolveQueueItemWithThread } from '@goodboy/types';
import type { AppStore } from '../../../../../store/store';
import type { DemoHint, HintProbe } from './demoHintTypes';
import { hasElement } from './hasElement';

type StateParams = {
  readonly state: AppStore;
};

type RootParams = {
  readonly root: Document;
};

const HANDLER_ROW = '[role="treeitem"][data-tree-row="src/webhooks/applyWebhook.ts"]';
const COMMENT = 'button[data-thread-id]';
const CURRENT_COMMENT = 'button[data-thread-id][aria-current="true"]';
const LINE_NOTE = '[data-file-path="src/webhooks/applyWebhook.ts"] button[data-gutter="new:13"]';
const FIX = 'button[data-review-verb="reviewComment.draft"]';
const START_FIX = '[data-demo-anchor="resolve-start"]';
const KEEP = 'button[data-review-verb="reviewComment.accept"]';
const PUSH = 'button[data-branch-secondary="review.push"]';
const STORAGE_REMOVE = '[data-demo-anchor="storage-remove"]';
const STORAGE_CONFIRM = 'button[data-confirm-action="true"]';

const isHandlerOpen = ({ root }: RootParams): boolean =>
  root.querySelector(HANDLER_ROW)?.getAttribute('aria-selected') === 'true';

const noteCountOf = ({ state }: StateParams): number =>
  Object.values(state.diffComments).flat().length;

const itemsOf = ({ state }: StateParams): ReadonlyArray<ResolveQueueItemWithThread> =>
  Object.values(state.sessionResolveQueueItems).flat();

type EntryParams = {
  readonly entry: ResolveQueueItemWithThread;
};

const isDrafted = ({ entry }: EntryParams): boolean =>
  entry.thread.stage === 'proposed' && (entry.thread.replyDraft ?? '').trim().length > 0;

const attemptsOf = ({ state }: StateParams): ReadonlyArray<ResolveAttempt> =>
  Object.values(state.sessionResolveAttempts).flat();

const hasDraftedFix = ({ state, start }: HintProbe): boolean => {
  const before = new Set(attemptsOf({ state: start }).map((attempt) => attempt.id));
  const drafted = new Set(
    itemsOf({ state }).flatMap((entry) => (isDrafted({ entry }) ? [entry.thread.threadId] : [])),
  );
  return attemptsOf({ state }).some(
    (attempt) =>
      !before.has(attempt.id) &&
      attempt.phase === 'finished' &&
      attempt.threadIds.some((threadId) => drafted.has(threadId)),
  );
};

const readyRowOf = ({ state }: StateParams): string | null => {
  const ready = itemsOf({ state })
    .filter((entry) => isDrafted({ entry }))
    .sort((left, right) => right.thread.updatedAt - left.thread.updatedAt)[0];
  return ready === undefined
    ? null
    : `${COMMENT}[data-thread-id="${CSS.escape(ready.thread.threadId)}"]`;
};

type KeepParams = StateParams & RootParams;

const keepAnchorOf = ({ state, root }: KeepParams): string | null => {
  if (hasElement({ root, selector: KEEP })) {
    return KEEP;
  }
  return readyRowOf({ state });
};

const acceptedCountOf = ({ state }: StateParams): number =>
  itemsOf({ state }).filter((entry) => entry.item.approvalState === 'accepted').length;

export const REVIEW_HINTS: ReadonlyArray<DemoHint> = [
  {
    id: 'diff-file',
    label: 'Open the handler diff',
    copy: 'Open this file',
    instruction: 'Open applyWebhook.ts to read what changed before it is pushed.',
    result: 'applyWebhook.ts opened: the credit is now checked inside the transaction.',
    beat: 0,
    anchor: `${HANDLER_ROW} > button`,
    focus: 'nav[aria-label="Changed files"]',
    side: 'left',
    revealWhen: ({ root }) =>
      hasElement({ root, selector: HANDLER_ROW }) && !isHandlerOpen({ root }),
    doneWhen: ({ root }) => isHandlerOpen({ root }),
  },
  {
    id: 'diff-note',
    label: 'Leave a note',
    copy: 'Click a line number',
    progressCopy: 'Write the note, then Add note',
    instruction: 'Click a line number to leave a note on that line of code.',
    result: 'The note is saved on line 13 of applyWebhook.ts.',
    progress: 'Write your note, then press Add note.',
    beat: 0,
    dwellMs: 4500,
    isDimmed: false,
    anchor: LINE_NOTE,
    revealWhen: ({ root }) => hasElement({ root, selector: LINE_NOTE }),
    doneWhen: ({ state, start }) => noteCountOf({ state }) > noteCountOf({ state: start }),
  },
  {
    id: 'resolve-pick',
    label: 'Open a review comment',
    copy: 'Open the comment from nadia-p',
    instruction: 'Open the comment from nadia-p to read it next to the code it is about.',
    result: 'The comment opened next to the code it is about.',
    beat: 1,
    isDimmed: false,
    anchor: 'button[data-thread-id="PRRT_thread_retry_constant"]',
    revealWhen: ({ root }) =>
      hasElement({ root, selector: COMMENT }) && !hasElement({ root, selector: CURRENT_COMMENT }),
    doneWhen: ({ root }) => hasElement({ root, selector: CURRENT_COMMENT }),
  },
  {
    id: 'resolve-fix',
    label: 'Hand it to an agent',
    copy: 'Ask an agent to fix it',
    instruction: 'Ask an agent to draft a fix for this comment instead of editing by hand.',
    result: 'The fix drawer is open: an agent will change the code for this comment.',
    beat: 1,
    anchor: FIX,
    side: 'top',
    revealWhen: ({ state, root }) =>
      state.drawer?.kind !== 'fix-comments' && hasElement({ root, selector: FIX }),
    doneWhen: ({ state }) => state.drawer?.kind === 'fix-comments',
  },
  {
    id: 'resolve-start',
    label: 'Start the fix',
    copy: 'Press Start fix',
    instruction: 'Press Start fix: the agent changes the code and drafts a reply to the reviewer.',
    result: 'The fix is ready, with a reply drafted for the reviewer.',
    progress: 'The agent is changing the code and drafting a reply for the reviewer.',
    beat: 1,
    anchor: START_FIX,
    side: 'top',
    revealWhen: ({ root }) => hasElement({ root, selector: START_FIX }),
    doneWhen: hasDraftedFix,
  },
  {
    id: 'resolve-keep',
    label: 'Apply the fix',
    copy: 'Press Apply fix',
    instruction:
      'Open the comment with the drafted reply, then press Apply fix if it looks right to you.',
    result: 'The fix is applied to the branch and ready to push.',
    beat: 1,
    isDimmed: false,
    anchor: keepAnchorOf,
    side: 'top',
    revealWhen: ({ state, root }) => {
      const anchor = keepAnchorOf({ state, root });
      return anchor !== null && hasElement({ root, selector: anchor });
    },
    doneWhen: ({ state, start }) => acceptedCountOf({ state }) > acceptedCountOf({ state: start }),
  },
  {
    id: 'review-push',
    label: 'Push the fix',
    copy: 'Press Push',
    instruction: 'Press Push: the fix goes to the pull request branch, so the reviewer sees it.',
    result: 'The fix is pushed to the pull request branch, so the reviewer sees it.',
    beat: 1,
    dwellMs: 4500,
    anchor: PUSH,
    side: 'right',
    isSideLocked: true,
    revealWhen: ({ root }) => hasElement({ root, selector: PUSH }),
    doneWhen: ({ isAnchorClicked }) => isAnchorClicked,
  },
  {
    id: 'review-storage',
    label: 'Free the worktree folders',
    copy: 'Remove the 3 safe folders',
    progressCopy: 'Confirm the removal',
    instruction:
      'In Settings, Storage, press Remove 3 safe folders: three older Harborline branches are merged, so their folders are safe to free.',
    result: 'The 3 folders are removed and their space is back. The branches stay.',
    progress: 'Press Remove to confirm: the branches stay and only the folders go.',
    beat: 2,
    anchor: ({ root }) =>
      hasElement({ root, selector: STORAGE_CONFIRM }) ? STORAGE_CONFIRM : STORAGE_REMOVE,
    side: 'bottom',
    revealWhen: ({ root }) =>
      hasElement({ root, selector: STORAGE_REMOVE }) ||
      hasElement({ root, selector: STORAGE_CONFIRM }),
    doneWhen: ({ state }) => (state.storageOutcome?.removed ?? 0) > 0,
  },
];
