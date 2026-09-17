import type { MountId, SessionId } from '@goodboy/types';
import type { AppState } from '../../store/types';
import { selectSelectedMountId } from '../../store/slices/project-mounts/selectedMountId';
import { selectWritableMounts } from '../../store/slices/project-mounts/selectors';
import { FAN_OUT_MAX_CHILDREN } from '../../store/slices/workflows/scoutTree';

export const ARTIFACT_MOUNT_CAP = FAN_OUT_MAX_CHILDREN;

export type ArtifactMountOption = Readonly<{
  mountId: MountId;
  mountName: string;
  branch: string;
  baseBranch: string | null;
  worktreePath: string;
}>;

type SessionParams = Readonly<{
  state: Pick<
    AppState,
    'sessions' | 'sessionMounts' | 'sessionProjectMounts' | 'sessionActiveMount'
  >;
  sessionId: SessionId;
}>;

export const selectArtifactMountOptions = ({
  state,
  sessionId,
}: SessionParams): ReadonlyArray<ArtifactMountOption> =>
  selectWritableMounts({ state, sessionId })
    .filter((mount) => mount.worktreePath.length > 0)
    .map((mount) => ({
      mountId: mount.mountId,
      mountName: mount.mountName,
      branch: mount.branch,
      baseBranch: mount.baseBranch,
      worktreePath: mount.worktreePath,
    }));

export const artifactMountOptionsKey = ({ state, sessionId }: SessionParams): string =>
  selectArtifactMountOptions({ state, sessionId })
    .map((option) => `${option.mountId}:${option.mountName}:${option.branch}`)
    .join('|');

type DefaultParams = Readonly<{
  options: ReadonlyArray<ArtifactMountOption>;
  selectedMountId: MountId | null;
}>;

export const defaultArtifactMountIds = ({
  options,
  selectedMountId,
}: DefaultParams): ReadonlyArray<MountId> => {
  if (options.length === 0) {
    return [];
  }
  if (options.length === 1) {
    return options.map((option) => option.mountId);
  }
  const selected = options.find((option) => option.mountId === selectedMountId) ?? null;
  if (selected !== null) {
    return [selected.mountId];
  }
  return options.slice(0, ARTIFACT_MOUNT_CAP).map((option) => option.mountId);
};

export const selectDefaultArtifactMountIds = ({
  state,
  sessionId,
}: SessionParams): ReadonlyArray<MountId> =>
  defaultArtifactMountIds({
    options: selectArtifactMountOptions({ state, sessionId }),
    selectedMountId: selectSelectedMountId({ state, sessionId }),
  });

type ToggleParams = Readonly<{
  mountIds: ReadonlyArray<MountId>;
  mountId: MountId;
}>;

export const toggleArtifactMountId = ({
  mountIds,
  mountId,
}: ToggleParams): ReadonlyArray<MountId> => {
  if (mountIds.includes(mountId)) {
    return mountIds.filter((candidate) => candidate !== mountId);
  }
  if (mountIds.length >= ARTIFACT_MOUNT_CAP) {
    return mountIds;
  }
  return [...mountIds, mountId];
};

type ResolveParams = Readonly<{
  state: Pick<
    AppState,
    'sessions' | 'sessionMounts' | 'sessionProjectMounts' | 'sessionActiveMount'
  >;
  sessionId: SessionId;
  mountIds: ReadonlyArray<MountId>;
}>;

export const resolveArtifactMounts = ({
  state,
  sessionId,
  mountIds,
}: ResolveParams): ReadonlyArray<ArtifactMountOption> => {
  const options = selectArtifactMountOptions({ state, sessionId });
  if (mountIds.length === 0) {
    return [];
  }
  return mountIds
    .flatMap((mountId) => {
      const option = options.find((candidate) => candidate.mountId === mountId) ?? null;
      return option === null ? [] : [option];
    })
    .slice(0, ARTIFACT_MOUNT_CAP);
};
