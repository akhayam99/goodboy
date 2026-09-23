import { useEffect, useState } from 'react';
import type { IsoDateTime, OverrideSettings, WorkspaceId } from '@goodboy/types';
import { SettingsStudio } from '../../../../features/settings/components/SettingsStudio';
import type { ProviderInfo } from '../../../../features/providers/providers';
import { useAppStore } from '../../../../store';
import { StudioFrame, mockWorkspace, seedStudioChrome } from './shellChrome';

const WORKSPACE_ID = 'mock-providers-workspace-cascadia' as WorkspaceId;

const CAPABILITIES = {
  models: [],
  supportsTools: true,
  supportsStream: true,
  supportsCheapModel: true,
};

const PROVIDERS: ReadonlyArray<ProviderInfo> = [
  {
    id: 'anthropic',
    binary: 'claude',
    capabilities: CAPABILITIES,
    connection: 'connected',
    version: '2.1.260',
    identity: 'cascadia-platform',
    label: 'Claude',
    error: null,
    docsUrl: 'https://docs.claude.com/en/docs/claude-code/overview',
  },
  {
    id: 'codex',
    binary: 'codex',
    capabilities: CAPABILITIES,
    connection: 'connected',
    version: '0.58.0',
    identity: 'cascadia-platform',
    label: 'Codex',
    error: null,
    docsUrl: 'https://github.com/openai/codex#installation',
  },
  {
    id: 'cursor',
    binary: 'cursor-agent',
    capabilities: CAPABILITIES,
    connection: 'connected',
    version: '2026.9.2',
    identity: 'cascadia-platform',
    label: 'Cursor',
    error: null,
    docsUrl: 'https://docs.cursor.com/en/cli/installation',
  },
  {
    id: 'gemini',
    binary: 'agy',
    capabilities: CAPABILITIES,
    connection: 'connected',
    version: '1.4.0',
    identity: 'cascadia-platform',
    label: 'Gemini',
    error: null,
    docsUrl: 'https://antigravity.google/cli',
  },
  {
    id: 'opencode',
    binary: 'opencode',
    capabilities: CAPABILITIES,
    connection: 'installed_disconnected',
    version: '0.9.1',
    identity: null,
    label: 'OpenCode',
    error: null,
    docsUrl: 'https://opencode.ai/docs',
  },
  {
    id: 'openrouter',
    binary: 'opencode',
    capabilities: CAPABILITIES,
    connection: 'missing',
    version: null,
    identity: null,
    label: 'OpenRouter',
    error: null,
    docsUrl: 'https://openrouter.ai/docs',
  },
  {
    id: 'moonshot',
    binary: 'opencode',
    capabilities: CAPABILITIES,
    connection: 'missing',
    version: null,
    identity: null,
    label: 'Moonshot',
    error: null,
    docsUrl: 'https://platform.moonshot.ai/docs',
  },
];

const WORKSPACE_OVERRIDES: OverrideSettings = {
  defaultProviderId: null,
  defaultWorkflowId: null,
  defaultBranchPrefix: null,
  parallelEnabled: null,
  defaultVerbosity: null,
  providerBindings: null,
  taskModels: {
    branch_naming: { providerId: 'codex', model: 'gpt-6-astra' },
    plan_generation: { providerId: 'cursor', model: 'composer-2.5-fast' },
    pr_draft: { providerId: 'anthropic', model: 'claude-sonnet-5' },
  },
  roleModels: null,
  parallelAgents: null,
  providerPool: null,
  attributionFooter: null,
};

const WORKSPACE = mockWorkspace({ id: WORKSPACE_ID, name: 'Cascadia' });

const seedProvidersScene = (): void => {
  seedStudioChrome();
  useAppStore.setState({
    workspaces: [WORKSPACE],
    currentWorkspaceId: WORKSPACE_ID,
    sessions: [],
    providers: PROVIDERS,
    workspaceOverrides: { [WORKSPACE_ID]: WORKSPACE_OVERRIDES },
    refreshProviders: async () => undefined,
  });
};

export const ProvidersScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedProvidersScene();
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <StudioFrame
      activeStudio={null}
      main={
        <SettingsStudio
          currentWorkspace={WORKSPACE}
          initialFocus={{ scope: 'providers' }}
          onClose={() => undefined}
        />
      }
    />
  );
};
