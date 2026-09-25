import type { ConversationThread } from './types';

type Params = {
  readonly threads: ReadonlyArray<ConversationThread>;
};

export const countMessages = ({ threads }: Params): number =>
  threads.reduce((sum, thread) => sum + 1 + thread.replies.length, 0);
