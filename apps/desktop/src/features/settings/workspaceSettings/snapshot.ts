import type { OverrideSettings, WorkspaceId, WorkspaceProfile } from '@goodboy/types';
import type { AppStore } from '../../../store/store';
import type { WorkspaceOverridesPatch } from '../../../store/slices/overrides/patchWorkspaceOverrides';
import { normalizeWorkspaceProfile } from '../../../shared/utils/normalizeWorkspaceProfile';
import { pickerModeOf, type PickerMode } from '../../permissions/modeCopy';
import { editPostedReplyKey } from '../../resolve/editPostedReplySetting';

export type WorkspaceSettingsSnapshot = {
  readonly overrides: OverrideSettings | null;
  readonly profile: WorkspaceProfile;
  readonly permissionMode: PickerMode | null;
  readonly editPostedReply: string | null;
};

export type WorkspaceSettingsWrite = {
  readonly overrides: WorkspaceOverridesPatch;
  readonly profile: Partial<WorkspaceProfile>;
  readonly permissionMode: PickerMode | null;
  readonly editPostedReply: string | null;
};

const EMPTY_WRITE: WorkspaceSettingsWrite = {
  overrides: {},
  profile: {},
  permissionMode: null,
  editPostedReply: null,
};

export const mergeWrites = ({
  writes,
}: {
  readonly writes: ReadonlyArray<Partial<WorkspaceSettingsWrite>>;
}): WorkspaceSettingsWrite =>
  writes.reduce<WorkspaceSettingsWrite>(
    (merged, write) => ({
      overrides: { ...merged.overrides, ...write.overrides },
      profile: { ...merged.profile, ...write.profile },
      permissionMode: write.permissionMode ?? merged.permissionMode,
      editPostedReply: write.editPostedReply ?? merged.editPostedReply,
    }),
    EMPTY_WRITE,
  );

export type SnapshotState = Pick<AppStore, 'workspaces' | 'workspaceOverrides' | 'settings'>;

export const workspaceSettingsSnapshot = ({
  state,
  workspaceId,
}: {
  readonly state: SnapshotState;
  readonly workspaceId: WorkspaceId;
}): WorkspaceSettingsSnapshot => {
  const workspace = state.workspaces.find((candidate) => candidate.id === workspaceId);
  const mode = workspace?.defaultPermissionMode;
  return {
    overrides: state.workspaceOverrides[workspaceId] ?? null,
    profile: normalizeWorkspaceProfile({ profile: workspace?.profile }),
    permissionMode: mode == null ? null : pickerModeOf({ mode }),
    editPostedReply: state.settings[editPostedReplyKey({ workspaceId })] ?? null,
  };
};
