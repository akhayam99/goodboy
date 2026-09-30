import type { SessionId } from '@goodboy/types';
import { activeReviewSourceOf } from '../review-source/activeReviewSource';
import type { GetFn } from './types';

export type PublicationTarget = Readonly<{
  repo: string | null;
  prNumber: number;
  prUrl: string | null;
}>;

type Params = { readonly get: GetFn; readonly sessionId: SessionId };

export const publicationTarget = ({ get, sessionId }: Params): PublicationTarget => {
  const source = activeReviewSourceOf({ state: get(), sessionId });
  return {
    repo: source?.repo ?? null,
    prNumber: source?.prNumber ?? 0,
    prUrl: source?.url ?? null,
  };
};
