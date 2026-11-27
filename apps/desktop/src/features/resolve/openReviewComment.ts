import type { MountId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
import type { NavigateParams } from '../../store/slices/navigation/types';
import { commentBranchPlaceOf } from '../review/commentBranchPlaceOf';

type Params = {
  readonly navigate: (params: NavigateParams) => void;
  readonly sessionId: SessionId;
  readonly threadId: string | null;
  readonly mountId?: MountId | null;
  readonly mountPath?: string | null;
};

export const openReviewComment = ({
  navigate,
  sessionId,
  threadId,
  mountId = null,
  mountPath = null,
}: Params): void =>
  navigate({
    to: commentBranchPlaceOf({
      state: useAppStore.getState(),
      sessionId,
      threadId,
      mountId,
      mountPath,
    }),
    mode: 'replace',
    drawer: threadId === null ? null : { kind: 'conversation', sessionId, payload: { threadId } },
  });
