import type { MountId, SessionId } from '@goodboy/types';
import {
  selectedReviewEntryOf,
  type ReviewSourceSelectionState,
} from '../../../store/slices/review-source/activeReviewSource';
import type { AppState } from '../../../store/types';

type Params = {
  readonly state: ReviewSourceSelectionState & Pick<AppState, 'sessionMounts'>;
  readonly sessionId: SessionId;
  readonly mountId: MountId | null;
};

export type CommentRequest = Readonly<{
  branch: string | null;
  prNumber: number | null;
  prUrl: string | null;
}>;

export const commentRequestOf = ({ state, sessionId, mountId }: Params): CommentRequest => {
  const entry = selectedReviewEntryOf({ state, sessionId, mountId });
  const mount =
    mountId === null
      ? undefined
      : (state.sessionMounts[sessionId] ?? []).find((candidate) => candidate.id === mountId);
  return {
    branch: mount?.branch ?? null,
    prNumber: entry?.number ?? null,
    prUrl: entry?.url ?? null,
  };
};
