import type { MountId, SessionId } from '@goodboy/types';
import { branchPlace } from '../../store/slices/navigation/place';
import type { BranchTab, Place } from '../../store/slices/navigation/types';
import {
  selectDisplayedMount,
  selectWritableMounts,
} from '../../store/slices/project-mounts/selectors';
import type { DiffFocus } from '../../store/slices/session-view/types';
import {
  threadMountIdOf,
  type ThreadMountState,
} from '../../store/slices/review-source/threadMountIdOf';

export type CommentBranchState = Parameters<typeof selectDisplayedMount>[0]['state'] &
  ThreadMountState;

type PathParams = {
  readonly state: CommentBranchState;
  readonly sessionId: SessionId;
  readonly threadId: string | null;
  readonly mountId?: MountId | null;
  readonly mountPath?: string | null;
};

type Params = PathParams & {
  readonly tab?: BranchTab;
  readonly focus?: DiffFocus | null;
};

type OwnParams = {
  readonly state: CommentBranchState;
  readonly sessionId: SessionId;
  readonly mountId: MountId;
};

const pathOfMount = ({ state, sessionId, mountId }: OwnParams): string | null =>
  selectWritableMounts({ state, sessionId }).find((mount) => mount.mountId === mountId)
    ?.worktreePath ?? null;

export const commentBranchPathOf = ({
  state,
  sessionId,
  threadId,
  mountId = null,
  mountPath = null,
}: PathParams): string | null => {
  const named = mountId === null ? null : pathOfMount({ state, sessionId, mountId });
  if (named !== null) {
    return named;
  }
  if (mountPath !== null) {
    return mountPath;
  }
  const ownerId = threadId === null ? null : threadMountIdOf({ state, sessionId, threadId });
  const owner = ownerId === null ? null : pathOfMount({ state, sessionId, mountId: ownerId });
  return owner ?? selectDisplayedMount({ state, sessionId })?.worktreePath ?? null;
};

export const commentBranchPlaceOf = ({ tab = 'comments', focus = null, ...rest }: Params): Place =>
  branchPlace({
    sessionId: rest.sessionId,
    mountPath: commentBranchPathOf(rest),
    tab,
    threadId: rest.threadId,
    focus,
  });
