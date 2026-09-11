import type { MountId, ProjectId, SessionId } from '@goodboy/types';
import { commitWriteDestination } from './commitWriteDestination';
import { findMountById } from './findMountById';
import { recoverSoleMount } from './recoverSoleMount';
import { selectSelectedMountId } from './selectedMountId';
import { writeDestinationPatch } from './writeDestinationPatch';
import type { GetFn, SetFn } from './types';

type ReleaseParams = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly released: ReadonlyArray<MountId>;
  readonly departedProjectId: ProjectId | null;
};

type RecordsParams = {
  readonly set: SetFn;
  readonly sessionId: SessionId;
  readonly departedProjectId: ProjectId | null;
};

const dropWorktreeRecords = ({ set, sessionId, departedProjectId }: RecordsParams): void => {
  if (departedProjectId === null) {
    return;
  }
  set((state) => {
    const records = state.sessionWorktreeRecords?.[sessionId];
    if (records === undefined) {
      return {};
    }
    return {
      sessionWorktreeRecords: {
        ...state.sessionWorktreeRecords,
        [sessionId]: records.filter((record) => record.projectId !== departedProjectId),
      },
    };
  });
};

export const releaseMountSelection = async ({
  set,
  get,
  sessionId,
  released,
  departedProjectId,
}: ReleaseParams): Promise<void> => {
  dropWorktreeRecords({ set, sessionId, departedProjectId });
  const remaining = (get().sessionProjectMounts[sessionId] ?? []).filter(
    (mount) => !released.includes(mount.mountId),
  );
  const selectedMountId = selectSelectedMountId({ state: get(), sessionId });
  const isSelectionReleased = selectedMountId !== null && released.includes(selectedMountId);
  if (!isSelectionReleased) {
    const held = findMountById({ mounts: remaining, mountId: selectedMountId });
    if (held !== null) {
      set((state) => writeDestinationPatch({ state, sessionId, mount: held }));
      return;
    }
    if (selectedMountId !== null || departedProjectId === null) {
      return;
    }
  }
  await commitWriteDestination({
    set,
    sessionId,
    mount: selectedMountId === null ? null : recoverSoleMount({ mounts: remaining }),
    previousSelection: isSelectionReleased ? 'released' : 'held',
  });
};
