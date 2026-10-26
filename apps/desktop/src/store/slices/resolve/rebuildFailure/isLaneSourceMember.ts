import type { ResolveQueueItemWithThread } from '@goodboy/types';
import { rowBelongsToSource } from '../../review-source/rowBelongsToSource';
import type { LaneSource } from '../types';

type Params = {
  readonly entry: ResolveQueueItemWithThread;
  readonly source: LaneSource;
};

export const isLaneSourceMember = ({ entry, source }: Params): boolean =>
  source.kind === undefined ||
  rowBelongsToSource({
    row: entry.thread,
    entry: {
      kind: source.kind,
      projectId: source.projectId ?? null,
      number: source.prNumber ?? null,
    },
  });
