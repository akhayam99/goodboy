import { useShallow } from 'zustand/react/shallow';
import type { MountId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { mountReviewOf, type MountReview } from '../../mountReviewOf';

type Params = {
  readonly sessionId: SessionId;
  readonly mountId: MountId | null;
};

export const useMountReview = ({ sessionId, mountId }: Params): MountReview => {
  const kind = useAppStore((state) => mountReviewOf({ state, sessionId, mountId }).kind);
  const target = useAppStore((state) => mountReviewOf({ state, sessionId, mountId }).target);
  const choices = useAppStore(
    useShallow((state) => mountReviewOf({ state, sessionId, mountId }).choices),
  );
  const hostUrl = useAppStore((state) => mountReviewOf({ state, sessionId, mountId }).hostUrl);
  return { kind, target, choices, hostUrl };
};
