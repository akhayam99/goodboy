import type { DiffComment, MountId, ResolveThread, SessionMount } from '@goodboy/types';
import { noteIdOfThread } from './notes/noteThread';

type Params = {
  readonly thread: Pick<ResolveThread, 'threadId' | 'originKind' | 'diffCommentId'>;
  readonly notes: ReadonlyArray<DiffComment>;
  readonly mounts: ReadonlyArray<Pick<SessionMount, 'id' | 'projectId' | 'branch' | 'isAttached'>>;
  readonly sourceMountId: MountId | null;
};

export const commentMountIdOf = ({
  thread,
  notes,
  mounts,
  sourceMountId,
}: Params): MountId | null => {
  const attached = mounts.filter((mount) => mount.isAttached);
  if (thread.originKind !== 'diff_comment') {
    return sourceMountId;
  }
  const noteId = thread.diffCommentId ?? noteIdOfThread({ threadId: thread.threadId });
  const note = notes.find((candidate) => candidate.id === noteId) ?? null;
  const match = attached.find(
    (mount) =>
      note !== null &&
      note.branch !== undefined &&
      mount.branch === note.branch &&
      (note.projectId === undefined || mount.projectId === note.projectId),
  );
  if (match !== undefined) {
    return match.id;
  }
  const [only] = attached;
  return attached.length === 1 && only !== undefined ? only.id : null;
};
