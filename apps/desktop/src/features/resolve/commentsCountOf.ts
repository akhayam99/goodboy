import type { ResolveStage, ResolveThread } from '@goodboy/types';
import { isFixableThread } from './fixableComments';

export type CommentsCount = {
  readonly unresolved: number;
  readonly needsYou: number;
  readonly fixable: number;
};

type Params = {
  readonly threads: ReadonlyArray<Pick<ResolveThread, 'stage' | 'state' | 'stateReason'>>;
};

const NEEDS_YOU: ReadonlySet<ResolveStage> = new Set<ResolveStage>([
  'asking',
  'proposed',
  'failed',
]);

const SETTLED: ReadonlySet<ResolveStage> = new Set<ResolveStage>(['resolved', 'parked']);

export const commentsCountOf = ({ threads }: Params): CommentsCount => ({
  unresolved: threads.filter((thread) => !SETTLED.has(thread.stage)).length,
  needsYou: threads.filter((thread) => NEEDS_YOU.has(thread.stage)).length,
  fixable: threads.filter((thread) => isFixableThread({ thread })).length,
});
