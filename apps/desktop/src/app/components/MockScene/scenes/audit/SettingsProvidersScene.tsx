import { legacyHiddenModels, withModelsVisible } from '@goodboy/core';
import { PROVIDER_IDS, type ProviderId, type RoleModelPreferences } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { SETTING_HIDDEN_MODELS } from '../../../../../features/settings/settings';
import { SettingsFrame } from './SettingsFrame';
import { sceneParam } from './sceneParams';
import { seedPolicyScene } from '../providerPolicySeed';
import { SETTINGS_WORKSPACE_ID } from './settingsSeed';

type ProviderParams = {
  readonly value: string | null;
};

const providerOf = ({ value }: ProviderParams): ProviderId | undefined =>
  PROVIDER_IDS.find((id) => id === value);

const PROVIDER = providerOf({ value: sceneParam({ key: 'provider' }) });

const HIDDEN_KEY = sceneParam({ key: 'hidden' });

const seedHidden = () => {
  if (HIDDEN_KEY === null) {
    return;
  }
  const hidden = withModelsVisible({
    provider: 'anthropic',
    hidden: legacyHiddenModels(),
    keys: [HIDDEN_KEY],
    visible: false,
  });
  useAppStore.setState((state) => ({
    settings: { ...state.settings, [SETTING_HIDDEN_MODELS]: JSON.stringify(hidden) },
  }));
};

const HAS_NEW_PROVIDER = sceneParam({ key: 'new' }) === '1';

const ROLES = sceneParam({ key: 'roles' });

const PLANNER_SET: RoleModelPreferences = {
  planner: {
    providerId: 'anthropic',
    model: 'claude-opus-5-5',
    effort: 'high',
    models: [
      { providerId: 'anthropic', model: 'claude-opus-5-5' },
      { providerId: 'codex', model: 'gpt-6.1-sol' },
      { providerId: 'anthropic', model: 'claude-sonnet-5-5' },
    ],
  },
};

const RETIRED_SET: RoleModelPreferences = {
  planner: {
    providerId: 'anthropic',
    model: 'claude-opus-5-5',
    effort: 'high',
    models: [
      { providerId: 'anthropic', model: 'claude-opus-5-5' },
      { providerId: 'codex', model: 'gpt-6.1-sol' },
      { providerId: 'anthropic', model: 'claude-fable-1' },
    ],
  },
};

const seedRoleSets = () => {
  const roleModels = ROLES === 'set' ? PLANNER_SET : ROLES === 'retired' ? RETIRED_SET : null;
  if (roleModels === null) {
    return;
  }
  useAppStore.setState((state) => {
    const current = state.workspaceOverrides[SETTINGS_WORKSPACE_ID];
    if (current === undefined) {
      return {};
    }
    return {
      workspaceOverrides: {
        ...state.workspaceOverrides,
        [SETTINGS_WORKSPACE_ID]: { ...current, roleModels, parallelAgents: true },
      },
    };
  });
};

const seedScene = () => {
  seedPolicyScene({ workspaceId: SETTINGS_WORKSPACE_ID, hasNewProvider: HAS_NEW_PROVIDER });
  seedHidden();
  seedRoleSets();
};

export const SettingsProvidersScene = () => (
  <SettingsFrame focus={{ scope: 'providers', provider: PROVIDER }} seed={seedScene} />
);
