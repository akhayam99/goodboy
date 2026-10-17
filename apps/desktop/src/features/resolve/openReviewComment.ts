import type { SessionId } from '@goodboy/types';
import { branchPlace } from '../../store/slices/navigation/place';
import type { NavigateParams } from '../../store/slices/navigation/types';

type Params = {
  readonly navigate: (params: NavigateParams) => void;
  readonly sessionId: SessionId;
  readonly threadId: string | null;
};

export const openReviewComment = ({ navigate, sessionId, threadId }: Params): void =>
  navigate({
    to: branchPlace({ sessionId, tab: 'comments', threadId }),
    mode: 'replace',
    drawer: threadId === null ? null : { kind: 'conversation', sessionId, payload: { threadId } },
  });
