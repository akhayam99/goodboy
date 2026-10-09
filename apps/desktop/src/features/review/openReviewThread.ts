import type { MountId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
import { selectMountForPr } from '../../store/slices/github/mountForPr';
import {
  selectUnambiguousProjectMount,
  selectWritableMounts,
} from '../../store/slices/project-mounts/selectors';
import type { ReviewTargetOutcome } from '../../store/slices/review-navigation';
import { isNoteOnBranch, noteIdOfThread } from '../resolve/notes/noteThread';
import { openReview } from './openReview';
import { pullRequestNumberFromUrl } from './pullRequestNumberFromUrl';

type Params = {
  readonly sessionId: SessionId;
  readonly threadId: string;
  readonly prUrl?: string | null;
};

type State = ReturnType<typeof useAppStore.getState>;

type IdentityParams = {
  readonly state: State;
  readonly sessionId: SessionId;
  readonly threadId: string;
  readonly prUrl: string | null;
};

type MountParams = {
  readonly state: State;
  readonly sessionId: SessionId;
  readonly threadId: string;
  readonly prNumber: number;
};

const prNumberFor = ({ state, sessionId, threadId, prUrl }: IdentityParams): number | null => {
  const linked = prUrl === null ? null : pullRequestNumberFromUrl({ url: prUrl });
  const row =
    (state.sessionResolveThreads[sessionId] ?? []).find(
      (candidate) => candidate.threadId === threadId,
    ) ?? null;
  const attempt =
    (state.sessionResolveAttempts[sessionId] ?? []).find((candidate) =>
      candidate.threadIds.includes(threadId),
    ) ?? null;
  return (
    linked ??
    row?.prNumber ??
    attempt?.prNumber ??
    state.sessionSelectedPrNumber[sessionId] ??
    state.sessionGithub[sessionId]?.pr?.number ??
    null
  );
};

const mountIdFor = ({ state, sessionId, threadId, prNumber }: MountParams): MountId | null => {
  const projectId =
    (state.sessionResolveThreads[sessionId] ?? []).find(
      (candidate) => candidate.threadId === threadId,
    )?.projectId ?? null;
  const owning =
    projectId === null
      ? null
      : (selectUnambiguousProjectMount({ state, sessionId, projectId })?.mountId ?? null);
  return owning ?? selectMountForPr({ state, sessionId, prNumber });
};

const noteMountIdFor = ({
  state,
  sessionId,
  noteId,
}: {
  readonly state: State;
  readonly sessionId: SessionId;
  readonly noteId: string;
}): MountId | null => {
  const note = (state.diffComments[sessionId] ?? []).find((candidate) => candidate.id === noteId);
  if (note === undefined) {
    return null;
  }
  return (
    selectWritableMounts({ state, sessionId }).find((mount) =>
      isNoteOnBranch({ note, projectId: mount.projectId, branch: mount.branch }),
    )?.mountId ?? null
  );
};

export const openReviewThread = ({
  sessionId,
  threadId,
  prUrl = null,
}: Params): Promise<ReviewTargetOutcome> => {
  const state = useAppStore.getState();
  const noteId = noteIdOfThread({ threadId });
  if (noteId !== null) {
    const mountId = noteMountIdFor({ state, sessionId, noteId });
    return openReview({
      sessionId,
      destination:
        mountId === null
          ? { kind: 'notes', threadIds: [threadId] }
          : { kind: 'threads', mountId, threadIds: [threadId] },
    });
  }
  const prNumber = prNumberFor({ state, sessionId, threadId, prUrl });
  if (prNumber === null) {
    return Promise.resolve({ kind: 'unavailable', reason: 'no_pull_request' });
  }
  return openReview({
    sessionId,
    destination: {
      kind: 'thread',
      mountId: mountIdFor({ state, sessionId, threadId, prNumber }),
      prNumber,
      threadId,
    },
  });
};
