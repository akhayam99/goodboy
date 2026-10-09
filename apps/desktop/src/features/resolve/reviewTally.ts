import type { ResolveQueueRow } from './buildResolveQueueRows';
import { resolveWordOfState, type ResolveWord } from './commentProjection';
import { isPushFailure, reviewCommentStateOf } from './reviewCommentState';

export type ReviewTally = {
  readonly needsYou: number;
  readonly question: number;
  readonly toReview: number;
  readonly pushFailed: number;
  readonly couldntFix: number;
  readonly working: number;
  readonly readyToPush: number;
  readonly done: number;
  readonly leftOpen: number;
  readonly open: number;
  readonly fixable: number;
};

export const reviewTallyOfWords = ({
  words,
}: {
  readonly words: ReadonlyArray<ResolveWord>;
}): ReviewTally => {
  const count = (word: ResolveWord): number =>
    words.filter((candidate) => candidate === word).length;
  const question = count('question');
  const toReview = count('to_review');
  const pushFailed = count('push_failed');
  const couldntFix = count('couldnt_fix');
  const open = count('open');
  return {
    needsYou: question + toReview + pushFailed + couldntFix,
    question,
    toReview,
    pushFailed,
    couldntFix,
    working: count('working'),
    readyToPush: count('ready'),
    done: count('done'),
    leftOpen: count('left_open'),
    open,
    fixable: open + couldntFix,
  };
};

const resolveWordOfRow = ({ row }: { readonly row: ResolveQueueRow }): ResolveWord =>
  resolveWordOfState({
    state: reviewCommentStateOf({ row }),
    isPushFailure: isPushFailure({ row }),
  });

const isFixableWord = ({ word }: { readonly word: ResolveWord }): boolean =>
  word === 'open' || word === 'couldnt_fix';

export const fixableThreadIdsOf = ({
  rows,
}: {
  readonly rows: ReadonlyArray<ResolveQueueRow>;
}): ReadonlyArray<string> =>
  rows.flatMap((row) =>
    isFixableWord({ word: resolveWordOfRow({ row }) }) ? [row.thread.threadId] : [],
  );

export const reviewTallyOf = ({
  rows,
}: {
  readonly rows: ReadonlyArray<ResolveQueueRow>;
}): ReviewTally => reviewTallyOfWords({ words: rows.map((row) => resolveWordOfRow({ row })) });

export const reviewTallyParts = ({
  tally,
}: {
  readonly tally: ReviewTally;
}): ReadonlyArray<string> => [
  ...(tally.needsYou > 0 ? [`${tally.needsYou} need you`] : []),
  ...(tally.working > 0 ? [`${tally.working} working`] : []),
  ...(tally.readyToPush > 0 ? [`${tally.readyToPush} ready to push`] : []),
];
