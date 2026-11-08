import type { PrComment } from '@goodboy/types';
import { botKeyOf } from './botKeyOf';

type Params = {
  readonly comments: ReadonlyArray<PrComment> | null;
  readonly botKey: string | null;
};

export const reviewHeadsOf = ({ comments, botKey }: Params): ReadonlyArray<PrComment> =>
  (comments ?? []).filter(
    (comment) =>
      comment.source === 'review' &&
      comment.inReplyToId === undefined &&
      (botKey === null || botKeyOf({ login: comment.author }) === botKey),
  );
