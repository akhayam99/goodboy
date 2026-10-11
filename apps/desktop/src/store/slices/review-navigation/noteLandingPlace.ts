import type { SessionId } from '@goodboy/types';
import { noteIdOfThread } from '../../../features/resolve/notes/noteThread';
import type { AppStore } from '../../store';
import { branchPlace } from '../navigation/place';
import { sessionPullRequestOf } from '../review-source/sessionPullRequestOf';

type Params = {
  readonly state: AppStore;
  readonly sessionId: SessionId;
  readonly mountPath: string | null;
  readonly threadId: string | null;
};

export const noteLandingPlace = ({ state, sessionId, mountPath, threadId }: Params) => {
  if (sessionPullRequestOf({ state, sessionId }) !== null) {
    return branchPlace({ sessionId, mountPath, tab: 'comments', threadId });
  }
  const noteId = threadId === null ? null : noteIdOfThread({ threadId });
  const note =
    noteId === null
      ? null
      : ((state.diffComments[sessionId] ?? []).find((candidate) => candidate.id === noteId) ??
        null);
  return branchPlace({
    sessionId,
    mountPath,
    tab: 'files',
    threadId,
    focus: note === null ? null : { kind: 'branch', path: note.filePath, threadId: note.id },
  });
};
