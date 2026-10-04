import type {
  IntegrationBinding,
  IntegrationBindingId,
  IntegrationCredentialId,
  ProviderId,
} from '@goodboy/types';
import type { ProviderDisplayInfo } from '../../../../../features/providers/providers';
import { useAppStore } from '../../../../../store';
import { SettingsFrame } from './SettingsFrame';
import { SETTINGS_PROVIDERS, SETTINGS_WORKSPACE, SETTINGS_WORKSPACE_ID } from './settingsSeed';

const CAPABILITIES = {
  models: [],
  supportsTools: true,
  supportsStream: true,
  supportsCheapModel: true,
};

const provider = ({
  id,
  label,
}: {
  readonly id: ProviderId;
  readonly label: string;
}): ProviderDisplayInfo => ({
  id,
  binary: id,
  capabilities: CAPABILITIES,
  connection: 'installed_disconnected',
  version: '1.0.0',
  identity: null,
  label,
  error: null,
  docsUrl: 'https://example.invalid/provider-help',
});

const EXTRA_PROVIDERS: ReadonlyArray<ProviderDisplayInfo> = [
  provider({ id: 'opencode', label: 'OpenCode' }),
  provider({ id: 'openrouter', label: 'OpenRouter' }),
  provider({ id: 'moonshot', label: 'Moonshot' }),
];

const bindingBase = ({
  id,
  credentialId,
}: {
  readonly id: string;
  readonly credentialId: string;
}) => ({
  id: id as IntegrationBindingId,
  workspaceId: SETTINGS_WORKSPACE_ID,
  projectId: null,
  credentialId: credentialId as IntegrationCredentialId,
  createdAt: SETTINGS_WORKSPACE.createdAt,
  updatedAt: SETTINGS_WORKSPACE.updatedAt,
});

const BINDINGS: ReadonlyArray<IntegrationBinding> = [
  {
    ...bindingBase({ id: 'mock-home-linear', credentialId: 'mock-home-linear-credential' }),
    provider: 'linear',
    config: {
      workspaceUrlKey: 'harborline',
      viewerUserId: 'mock-viewer',
      viewerName: 'Platform lead',
    },
  },
  {
    ...bindingBase({ id: 'mock-home-gitlab', credentialId: 'mock-home-gitlab-credential' }),
    provider: 'gitlab',
    config: { userName: 'platform-lead', userId: '42', host: 'gitlab.northwind.dev' },
  },
];

const seedFullHome = (): void => {
  localStorage.setItem('goodboy:settings-last-page:v1', 'app:backup');
  const fullWorkspace = {
    ...SETTINGS_WORKSPACE,
    profile: {
      roles: ['Platform engineering lead', 'Distributed systems reviewer', 'Payments owner'],
      aboutWork: SETTINGS_WORKSPACE.profile?.aboutWork ?? null,
      workingRules: SETTINGS_WORKSPACE.profile?.workingRules ?? null,
      explainMore: SETTINGS_WORKSPACE.profile?.explainMore ?? [],
    },
  };
  useAppStore.setState((state) => ({
    updaterStatus: 'available',
    workspaces: state.workspaces.map((workspace) =>
      workspace.id === SETTINGS_WORKSPACE_ID ? fullWorkspace : workspace,
    ),
    providers: [
      ...SETTINGS_PROVIDERS.map((entry, index) =>
        index < 3 ? { ...entry, connection: 'connected' as const, error: null } : entry,
      ),
      ...EXTRA_PROVIDERS,
    ],
    workspaceIntegrations: { [SETTINGS_WORKSPACE_ID]: BINDINGS },
  }));
};

export const SettingsHomeFullScene = () => (
  <SettingsFrame focus={{ scope: 'home' }} seed={seedFullHome} />
);
