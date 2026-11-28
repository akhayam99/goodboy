import { useCallback } from 'react';
import type { MountId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { openReviewComment } from '../../openReviewComment';

type Params = {
  readonly sessionId: SessionId;
  readonly mountId: MountId | null;
};

type OpenParams = {
  readonly threadId: string | null;
};

export const useOpenReviewComment = ({ sessionId, mountId }: Params) => {
  const navigate = useAppStore((s) => s.navigate);
  return useCallback(
    ({ threadId }: OpenParams): void =>
      openReviewComment({ navigate, sessionId, threadId, mountId }),
    [mountId, navigate, sessionId],
  );
};
