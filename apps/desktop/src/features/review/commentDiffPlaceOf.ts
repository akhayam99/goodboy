import type { SessionId } from '@goodboy/types';
import type { Place } from '../../store/slices/navigation/types';
import { diffThreadIdOf } from '../diff/lib/threadIds';
import { commentBranchPlaceOf, type CommentBranchState } from './commentBranchPlaceOf';

type Params = {
  readonly state: CommentBranchState;
  readonly sessionId: SessionId;
  readonly threadId: string;
  readonly path: string;
};

export const commentDiffPlaceOf = ({ state, sessionId, threadId, path }: Params): Place =>
  commentBranchPlaceOf({
    state,
    sessionId,
    tab: 'files',
    threadId,
    focus: { kind: 'branch', path, threadId: diffThreadIdOf({ threadId }) },
  });
