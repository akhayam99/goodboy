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

type SinceParams = StateParams & {
  readonly start: AppStore;
};

const isNewFixRunning = ({ state, start }: SinceParams): boolean => {
  const before = new Set(attemptsOf({ state: start }).map((attempt) => attempt.id));
  return attemptsOf({ state }).some(
    (attempt) => attempt.phase === 'running' && !before.has(attempt.id),
  );
};

const hasFinishedFix = ({ state }: StateParams): boolean =>
  attemptsOf({ state }).some((attempt) => attempt.phase === 'finished');

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

const isDraftedRowOpen = ({ state, root }: StateParams & RootParams): boolean => {
  const open = root.querySelector(CURRENT_COMMENT)?.getAttribute('data-thread-id') ?? null;
  return (
    open !== null &&
    itemsOf({ state }).some((entry) => entry.thread.threadId === open && isDrafted({ entry }))
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
    copy: 'Start with this file',
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
    copy: 'Leave a note',
    instruction: 'Click a line number to leave a note on that line of code.',
    result: 'The note is saved on that line and goes to the review queue.',
    beat: 0,
    anchor: LINE_NOTE,
    revealWhen: ({ root }) => hasElement({ root, selector: LINE_NOTE }),
    doneWhen: ({ state, start }) => noteCountOf({ state }) > noteCountOf({ state: start }),
  },
  {
    id: 'resolve-pick',
    label: 'Open a review comment',
    copy: 'Read it in context',
    instruction: 'Open this review comment to read it next to the code it is about.',
    result: 'The comment opened next to the code it is about.',
    beat: 1,
    anchor: 'button[data-thread-id="PRRT_thread_retry_constant"]',
    revealWhen: ({ root }) =>
      hasElement({ root, selector: COMMENT }) && !hasElement({ root, selector: CURRENT_COMMENT }),
    doneWhen: ({ root }) => hasElement({ root, selector: CURRENT_COMMENT }),
  },
  {
    id: 'resolve-fix',
    label: 'Hand it to an agent',
    copy: 'Hand it to an agent',
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
    copy: 'Let it work',
    instruction: 'Press Start fix: the agent changes the code and drafts a reply to the reviewer.',
    result: 'The fix is ready, with a reply drafted for the reviewer.',
    beat: 1,
    anchor: START_FIX,
    side: 'top',
    revealWhen: ({ root }) => hasElement({ root, selector: START_FIX }),
    doneWhen: hasDraftedFix,
  },
  {
    id: 'resolve-read',
    label: 'Read the drafted reply',
    copy: 'A fix is ready',
    instruction: 'Open a fixed comment to read the reply the agent drafted for the reviewer.',
    result: 'The drafted reply is open: nothing goes to the reviewer until you keep it.',
    beat: 1,
    anchor: ({ state }) => readyRowOf({ state }),
    side: 'right',
    revealWhen: ({ state, start, root }) => {
      const anchor = readyRowOf({ state });
      return (
        hasFinishedFix({ state }) &&
        !isNewFixRunning({ state, start }) &&
        anchor !== null &&
        hasElement({ root, selector: anchor })
      );
    },
    doneWhen: isDraftedRowOpen,
  },
  {
    id: 'resolve-keep',
    label: 'Keep the fix',
    copy: 'Your call',
    instruction: 'Read the drafted reply, then keep the fix if it looks right to you.',
    result: 'The fix is kept and ready to push.',
    beat: 1,
    anchor: keepAnchorOf,
    side: 'top',
    revealWhen: ({ state, root }) => {
      const anchor = keepAnchorOf({ state, root });
      return anchor !== null && hasElement({ root, selector: anchor });
    },
    doneWhen: ({ state, start }) => acceptedCountOf({ state }) > acceptedCountOf({ state: start }),
  },
];
