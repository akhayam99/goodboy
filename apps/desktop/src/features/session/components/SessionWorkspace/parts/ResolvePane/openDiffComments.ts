import type { DiffComment } from '@goodboy/types';

type Params = {
  readonly comments: ReadonlyArray<DiffComment>;
};

export const openDiffComments = ({ comments }: Params): ReadonlyArray<DiffComment> =>
  comments.filter(
    (comment) => comment.status === 'open' && comment.consumedByAgentId === undefined,
  );
