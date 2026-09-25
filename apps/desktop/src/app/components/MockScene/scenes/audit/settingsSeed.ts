import type {
  IsoDateTime,
  MountId,
  OverrideSettings,
  Project,
  ProjectId,
  SessionId,
  Workspace,
  WorkspaceId,
} from '@goodboy/types';
import type { ProviderDisplayInfo } from '../../../../../features/providers/providers';
import { useAppStore } from '../../../../../store';

export const SETTINGS_WORKSPACE_ID = 'mock-settings-workspace-harborline' as WorkspaceId;
const SETTINGS_NOW = '2026-09-22T10:12:00.000Z' as IsoDateTime;

export const SETTINGS_OVERRIDES: OverrideSettings = {
  defaultProviderId: 'anthropic',
  defaultWorkflowId: null,
  defaultBranchPrefix: 'hb',
  parallelEnabled: null,
  defaultVerbosity: 'normal',
  providerBindings: null,
  taskModels: {
    agent_naming: { providerId: 'codex', model: 'gpt-6-astra' },
  },
  roleModels: null,
  parallelAgents: true,
  providerPool: null,
  attributionFooter: true,
};

export const SETTINGS_WORKSPACE: Workspace = {
  id: SETTINGS_WORKSPACE_ID,
  name: 'Harborline',
  slug: 'harborline',
  profile: {
    roles: ['Tech Lead', 'Backend Engineer'],
    aboutWork:
      'Leads the payments platform team. Owns settlement correctness and the ledger schema.',
    workingRules: null,
    explainMore: ['Rust'],
  },
  overrides: SETTINGS_OVERRIDES,
  createdAt: SETTINGS_NOW,
  updatedAt: SETTINGS_NOW,
};

type ProjectParams = {
  readonly id: string;
  readonly name: string;
  readonly rootPath: string;
  readonly kind: Project['kind'];
  readonly description?: string;
  readonly isStarred?: boolean;
};

const makeProject = ({
  id,
  name,
  rootPath,
  kind,
  description,
  isStarred = false,
}: ProjectParams): Project => ({
  id: id as ProjectId,
  workspaceId: SETTINGS_WORKSPACE_ID,
  name,
  rootPath,
  kind,
  baseBranch: kind === 'repo' ? 'main' : null,
  description: description ?? null,
  ...(isStarred ? { starredAt: SETTINGS_NOW } : {}),
  overrides: SETTINGS_OVERRIDES,
  createdAt: SETTINGS_NOW,
  updatedAt: SETTINGS_NOW,
});

export const SETTINGS_PROJECTS: ReadonlyArray<Project> = [
  makeProject({
    id: 'mock-settings-ledger',
    name: 'ledger-core',
    rootPath: '/mock/harborline/ledger-core',
    kind: 'repo',
    description: 'Settles payments and writes the ledger',
    isStarred: true,
  }),
  makeProject({
    id: 'mock-settings-relay',
    name: 'notify-relay',
    rootPath: '/mock/harborline/notify-relay',
    kind: 'repo',
  }),
  makeProject({
    id: 'mock-settings-payments',
    name: 'payments-api',
    rootPath: '/mock/harborline/services/payments-api-with-a-long-folder-name',
    kind: 'repo',
    description: 'Public API in front of ledger-core and notify-relay',
    isStarred: true,
  }),
  makeProject({
    id: 'mock-settings-runbooks',
    name: 'runbooks',
    rootPath: '/mock/harborline/runbooks',
    kind: 'folder',
    description: 'On-call runbooks, plain folder',
  }),
];

const CAPABILITIES = {
  models: [],
  supportsTools: true,
  supportsStream: true,
  supportsCheapModel: true,
};

export const SETTINGS_PROVIDERS: ReadonlyArray<ProviderDisplayInfo> = [
  {
    id: 'anthropic',
    binary: 'claude',
    capabilities: CAPABILITIES,
    connection: 'connected',
    version: '2.1.260',
    identity: 'harborline-platform',
    label: 'Claude',
    error: null,
    docsUrl: 'https://docs.claude.com/en/docs/claude-code/overview',
  },
  {
    id: 'codex',
    binary: 'codex',
    capabilities: CAPABILITIES,
    connection: 'error',
    version: '0.58.0',
    identity: null,
    label: 'Codex',
    error: 'codex exited with status 1: config.toml could not be parsed',
    docsUrl: 'https://github.com/openai/codex#installation',
  },
  {
    id: 'cursor',
    binary: 'cursor-agent',
    capabilities: CAPABILITIES,
    connection: 'installed_disconnected',
    version: '2026.9.2',
    identity: null,
    label: 'Cursor',
    error: null,
    docsUrl: 'https://docs.cursor.com/en/cli/installation',
  },
  {
    id: 'gemini',
    binary: 'agy',
    capabilities: CAPABILITIES,
    connection: 'missing',
    version: null,
    identity: null,
    label: 'Gemini',
    error: null,
    docsUrl: 'https://antigravity.google/cli',
  },
];

export const seedSettingsBase = (): void => {
  useAppStore.setState({
    workspaces: [SETTINGS_WORKSPACE],
    currentWorkspaceId: SETTINGS_WORKSPACE_ID,
    projects: [...SETTINGS_PROJECTS],
    workspaceOverrides: { [SETTINGS_WORKSPACE_ID]: SETTINGS_OVERRIDES },
    providers: SETTINGS_PROVIDERS,
    refreshProviders: async () => undefined,
    detectedEditors: [
      { binary: 'code', label: 'VS Code' },
      { binary: 'cursor', label: 'Cursor' },
      { binary: 'zed', label: 'Zed' },
    ],
    loadDetectedEditors: async () => undefined,
    loadSetting: async () => 'code',
    saveSetting: async () => undefined,
    githubStatus: { mode: 'pat', available: true, user: 'harborline-bot', scopes: ['repo'] },
    refreshGithubStatus: async () => undefined,
    storageStats: {
      databaseBytes: 412_332_032,
      archivedSessionCount: 37,
      archivedTranscriptRows: 184_220,
      archivedTranscriptBytes: 96_468_992,
      archivedWorktrees: [
        {
          sessionId: 'mock-settings-archived-1' as SessionId,
          mountId: 'mock-settings-archived-mount-1' as MountId,
          repoPath: '/mock/harborline/ledger-core',
          worktreePath: '/mock/harborline/sessions/ledger-core-refund-retry',
          branch: 'hb/refund-retry',
          revision: 1,
          sizeBytes: 188_743_680,
        },
      ],
      retainedWorktrees: [],
    },
    storageStatsLoading: false,
    loadStorageStats: async () => undefined,
    orphanWorktrees: {
      [SETTINGS_WORKSPACE_ID]: [
        {
          path: '/mock/harborline/sessions/notify-relay-old-spike',
          name: 'notify-relay-old-spike',
          sizeBytes: 73_400_320,
          isRegistered: false,
        },
      ],
    },
    reconcileOrphanWorktrees: async () => undefined,
  });
};
