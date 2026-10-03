import type { WorkspaceId } from '@goodboy/types';
import type { Tone } from '@goodboy/ui';
import type { AppStore } from '../../../../store/store';
import { selectProviderAttention } from '../../../../store/slices/providers/selectProviderAttention';
import { selectSecurityFindingsAttention } from '../../../../store/slices/security-findings/selectSecurityFindingsAttention';
import { storageAttention } from '../../../../store/slices/storage/selectStorageAttention';
import { pluralize } from '../../../../shared/utils/pluralize';

export type RailSubtitles = {
  readonly generalText: string | undefined;
  readonly generalTone: Tone | undefined;
  readonly storageText: string | undefined;
  readonly storageTone: Tone | undefined;
  readonly securityFindingsText: string | undefined;
  readonly securityFindingsTone: Tone | undefined;
  readonly providersText: string | undefined;
  readonly providersTone: Tone | undefined;
  readonly workspaceText: string | undefined;
  readonly workspaceTone: Tone | undefined;
};

export type RailSubtitleState = Pick<
  AppStore,
  | 'updaterStatus'
  | 'storageFolders'
  | 'settings'
  | 'storageStats'
  | 'openSecurityFindings'
  | 'providers'
  | 'cliRequirements'
  | 'providerLimits'
  | 'projects'
  | 'projectGitStatus'
>;

type Params = {
  readonly state: RailSubtitleState;
  readonly workspaceId: WorkspaceId | null;
  readonly nowMs: number;
};

const missingFolderCount = ({
  state,
  workspaceId,
}: Pick<Params, 'state' | 'workspaceId'>): number => {
  if (workspaceId === null) {
    return 0;
  }
  return state.projects.filter(
    (project) =>
      project.workspaceId === workspaceId &&
      state.projectGitStatus[project.id]?.state === 'missing',
  ).length;
};

export const railSubtitles = ({ state, workspaceId, nowMs }: Params): RailSubtitles => {
  const storage = storageAttention({ state, nowMs });
  const storageText = storage?.label;
  const storageTone = storage?.tone;
  const securityFindingsText = selectSecurityFindingsAttention({ state, workspaceId }) ?? undefined;
  const providersText = selectProviderAttention({ state }) ?? undefined;
  const missing = missingFolderCount({ state, workspaceId });

  return {
    generalText: state.updaterStatus === 'available' ? 'Update available' : undefined,
    generalTone: state.updaterStatus === 'available' ? 'info' : undefined,
    storageText,
    storageTone,
    securityFindingsText,
    securityFindingsTone: securityFindingsText === undefined ? undefined : 'warning',
    providersText,
    providersTone: providersText === undefined ? undefined : 'warning',
    workspaceText: missing === 0 ? undefined : `${pluralize(missing, 'folder')} not found`,
    workspaceTone: missing === 0 ? undefined : 'warning',
  };
};
