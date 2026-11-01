import type { ResolveStage, ResolveThread } from '@goodboy/types';
import { isFixableThread } from './fixableComments';
import { isOpenThread } from './isOpenThread';

export type CommentsCount = {
  readonly unresolved: number;
  readonly needsYou: number;
  readonly fixable: number;
  readonly newCount: number;
};

type Params = {
  readonly threads: ReadonlyArray<
    Pick<ResolveThread, 'threadId' | 'stage' | 'state' | 'stateReason'>
  >;
  readonly newThreadIds?: ReadonlySet<string>;
};

const NO_THREADS: ReadonlySet<string> = new Set<string>();

const NEEDS_YOU: ReadonlySet<ResolveStage> = new Set<ResolveStage>([
  'asking',
  'proposed',
  'failed',
]);

export const commentsCountOf = ({ threads, newThreadIds = NO_THREADS }: Params): CommentsCount => ({
  unresolved: threads.filter((thread) => isOpenThread({ thread })).length,
  needsYou: threads.filter((thread) => NEEDS_YOU.has(thread.stage)).length,
  fixable: threads.filter((thread) => isFixableThread({ thread })).length,
  newCount: threads.filter(
    (thread) => isOpenThread({ thread }) && newThreadIds.has(thread.threadId),
  ).length,
});
