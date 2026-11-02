import { SettingsFrame } from '../audit/SettingsFrame';
import { SETTINGS_WORKSPACE_ID } from '../audit/settingsSeed';
import { useAppStore } from '../../../../../store';
import { RULES_PROVIDERS, rulesProviderLimits } from '../audit/workflowRulesSeed';
import { OVERRIDES } from '../flow-audit/fixtures';

const noop = () => undefined;

const seedRunDefaults = (): void => {
  useAppStore.setState({
    providers: RULES_PROVIDERS,
    refreshProviders: async () => undefined,
    providerLimits: rulesProviderLimits(),
    loadPhaseTemplates: async () => undefined,
    loadStepLibrary: async () => undefined,
    setWorkflowStudioVisible: noop,
    workspaceOverrides: {
      [SETTINGS_WORKSPACE_ID]: {
        ...OVERRIDES,
        providerPool: [
          { id: 'anthropic', state: 'on' },
          { id: 'codex', state: 'on' },
          { id: 'cursor', state: 'backup' },
          { id: 'gemini', state: 'off' },
        ],
      },
    },
  });
};

export const RunDefaultsLinkScene = () => (
  <SettingsFrame focus={{ scope: 'workspace', section: 'general' }} seed={seedRunDefaults} />
);
