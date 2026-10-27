import type { MountId, SessionId } from '@goodboy/types';
import { activeReviewSourceOf } from '../../review-source/activeReviewSource';
import type { GetFn } from '../types';

export type PublicationTarget = Readonly<{
  repo: string | null;
  prNumber: number;
  prUrl: string | null;
}>;

type Params = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly mountId: MountId | null;
};

export const publicationTarget = ({ get, sessionId, mountId }: Params): PublicationTarget => {
  const source = activeReviewSourceOf({ state: get(), sessionId, mountId });
  return {
    repo: source?.repo ?? null,
    prNumber: source?.prNumber ?? 0,
    prUrl: source?.url ?? null,
  };
};
