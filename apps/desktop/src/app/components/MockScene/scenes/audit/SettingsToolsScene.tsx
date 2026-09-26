import type {
  IntegrationBinding,
  IntegrationBindingId,
  IntegrationCredentialId,
} from '@goodboy/types';
import type { IntegrationGlyphProvider } from '../../../../../features/integrations/components/IntegrationGlyph';
import { useAppStore } from '../../../../../store';
import { SettingsFrame } from './SettingsFrame';
import { SETTINGS_WORKSPACE_ID } from './settingsSeed';
import { sceneParam } from './sceneParams';
import { sceneClock } from '../../sceneClock';

const clock = sceneClock({ anchor: '2026-09-22T10:12:00.000Z' });

const AT = clock.iso({ at: '2026-09-20T08:00:00.000Z' });

const BINDINGS: ReadonlyArray<IntegrationBinding> = [
  {
    id: 'mock-settings-binding-linear' as IntegrationBindingId,
    workspaceId: SETTINGS_WORKSPACE_ID,
    projectId: null,
    credentialId: 'mock-settings-cred-linear' as IntegrationCredentialId,
    createdAt: AT,
    updatedAt: AT,
    provider: 'linear',
    config: {
      workspaceUrlKey: 'harborline',
      viewerUserId: 'mock-viewer',
      viewerName: 'Platform lead',
    },
  },
  {
    id: 'mock-settings-binding-gitlab' as IntegrationBindingId,
    workspaceId: SETTINGS_WORKSPACE_ID,
    projectId: null,
    credentialId: 'mock-settings-cred-gitlab' as IntegrationCredentialId,
    createdAt: AT,
    updatedAt: AT,
    provider: 'gitlab',
    config: { userName: 'platform-lead', userId: '42', host: 'gitlab.northwind.dev' },
  },
];

const TOOLS: ReadonlyArray<IntegrationGlyphProvider> = [
  'bitbucket',
  'github',
  'gitlab',
  'jira',
  'linear',
  'sentry',
  'slack',
];

type ToolParams = {
  readonly value: string | null;
};

const toolOf = ({ value }: ToolParams): IntegrationGlyphProvider | undefined =>
  TOOLS.find((tool) => tool === value);

const TOOL = toolOf({ value: sceneParam({ key: 'tool' }) });

const seedTools = (): void => {
  useAppStore.setState({
    workspaceIntegrations: { [SETTINGS_WORKSPACE_ID]: BINDINGS },
    integrationCredentials: [],
  });
};

export const SettingsToolsScene = () => (
  <SettingsFrame focus={{ scope: 'tools', tool: TOOL }} seed={seedTools} />
);
