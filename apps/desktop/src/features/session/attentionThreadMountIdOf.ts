import type { MountId, ResolveThread, SessionAttentionReason, SessionId } from '@goodboy/types';
import {
  threadMountIdOf,
  type ThreadMountState,
} from '../../store/slices/review-source/threadMountIdOf';
import type { NotificationPlaceReason } from './notificationPlaceReason';

type FullMounts = NonNullable<ThreadMountState['sessionProjectMounts']>;

type NarrowMounts = Readonly<
  Record<
    string,
    ReadonlyArray<{
      readonly mountId: MountId;
      readonly worktreePath: string | null;
      readonly lastWorktreePath: string | null;
    }>
  >
>;

export type AttentionThreadState = Omit<
  ThreadMountState,
  'sessionProjectMounts' | 'sessionResolveThreads'
> & {
  readonly sessionResolveThreads?: Readonly<Record<string, ReadonlyArray<ResolveThread>>>;
  readonly sessionProjectMounts?: NarrowMounts;
};

type Reason = SessionAttentionReason | NotificationPlaceReason;

type Subject = 'note' | 'comment' | undefined;

type Params = {
  readonly state: AttentionThreadState;
  readonly sessionId: SessionId;
  readonly reason: Reason;
  readonly subject: Subject;
};

type ThreadParams = {
  readonly thread: ResolveThread;
  readonly reason: Reason;
  readonly subject: Subject;
};

const isAttentionThread = ({ thread, reason, subject }: ThreadParams): boolean => {
  const isNote = thread.originKind === 'diff_comment';
  const isPush = thread.stateReason?.startsWith('publication_failed:') === true;
  if (reason === 'push-failed') {
    return thread.state === 'failed' && isPush && !isNote;
  }
  if (subject !== undefined && isNote !== (subject === 'note')) {
    return false;
  }
  if (reason === 'fix-needs-you') {
    return thread.state === 'needs_answer';
  }
  return thread.state === 'failed' && !isPush;
};

export const attentionThreadMountIdOf = ({
  state,
  sessionId,
  reason,
  subject,
}: Params): MountId | null => {
  if (reason !== 'push-failed' && reason !== 'fix-needs-you' && reason !== 'fix-couldnt-fix') {
    return null;
  }
  const thread = (state.sessionResolveThreads?.[sessionId] ?? []).find((candidate) =>
    isAttentionThread({ thread: candidate, reason, subject }),
  );
  const mounts = [state.sessionProjectMounts].find((candidate): candidate is FullMounts =>
    Object.values(candidate ?? {}).every((list) => list.every((mount) => 'repoRoot' in mount)),
  );
  if (thread === undefined || mounts === undefined) {
    return null;
  }
  return threadMountIdOf({
    state: { ...state, sessionProjectMounts: mounts },
    sessionId,
    threadId: thread.threadId,
  });
};
