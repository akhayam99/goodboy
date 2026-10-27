import { getSetting, setSetting } from '@goodboy/db';
import { type ProviderId, type WorkspaceId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { useAppStore } from '../../../store';
import { isProviderId } from '@goodboy/types/helpers';

const SETTING_DEFAULT_AGENT = 'agents.default';

export const loadDefaultAgent = async (): Promise<ProviderId | null> => {
  const raw = await getSetting(tauriDatabase, SETTING_DEFAULT_AGENT);
  return raw !== null && isProviderId(raw) ? raw : null;
};

type SaveParams = {
  readonly providerId: ProviderId;
};

export const saveDefaultAgent = ({ providerId }: SaveParams): Promise<void> =>
  setSetting(tauriDatabase, SETTING_DEFAULT_AGENT, providerId);

type ApplyParams = {
  readonly workspaceId: WorkspaceId;
};

export const applyDefaultAgent = async ({ workspaceId }: ApplyParams): Promise<void> => {
  const providerId = await loadDefaultAgent();
  if (providerId === null) {
    return;
  }
  const state = useAppStore.getState();
  if ((state.workspaceOverrides[workspaceId]?.defaultProviderId ?? null) !== null) {
    return;
  }
  await state.patchWorkspaceOverrides({ workspaceId, patch: { defaultProviderId: providerId } });
};
