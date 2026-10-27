import { mockWindows } from '@tauri-apps/api/mocks';
import {
  brandId,
  type IntegrationBinding,
  type IntegrationBindingId,
  type IntegrationCredentialId,
  type Project,
  type ProjectId,
  type ProviderId,
  type Workspace,
  type WorkspaceId,
} from '@goodboy/types';
import {
  buildProviderList,
  type AuthState,
  type ProviderStatus,
  type ProviderStatuses,
} from '../../../../../features/providers/providers';
import type { LinearIssue } from '../../../../../features/integrations/linear/client';
import { SETTING_NEW_PROJECT_PARENT } from '../../../../../features/settings/settings';
import { IDLE_CONNECT, INITIAL_CONNECT_MAP } from '../../../../../store/slices/providers/types';
import { useAppStore } from '../../../../../store';
import type { AppStore } from '../../../../../store/store';
import { sceneClock } from '../../sceneClock';
import { installSceneDatabase } from '../sceneDatabase';
import { setupSceneAnswer } from './setupSceneAnswer';
import { startSampleScout } from './startSampleScout';
import { sampleScoutRuns } from './sampleScoutRuns';

export type WizardSceneAgents = 'ready' | 'signin' | 'none' | 'error';

export type WizardSceneWorkspace = 'none' | 'repo' | 'folder';

export const WIZARD_SCENE_AGENTS: ReadonlyArray<WizardSceneAgents> = [
  'ready',
  'signin',
  'none',
  'error',
];

export const WIZARD_SCENE_WORKSPACES: ReadonlyArray<WizardSceneWorkspace> = [
  'none',
  'repo',
  'folder',
];

export const SETTLED_MOTION =
  '*, *::before, *::after { animation-duration: 0s !important; animation-delay: 0s !important; transition: none !important; }';

const clock = sceneClock({ anchor: '2026-10-17T09:00:00.000Z' });
const NOW = clock.iso({ at: '2026-10-17T09:00:00.000Z' });

const CODE = '/mock/Code';

const OVERRIDES = {
  defaultProviderId: null,
  defaultBranchPrefix: null,
  defaultVerbosity: null,
  providerBindings: null,
  taskModels: null,
  roleModels: null,
  parallelAgents: null,
  providerPool: null,
  attributionFooter: null,
  replyVoice: null,
  replyStyleNote: null,
  replyTemplateFixed: null,
  replyTemplateNoChange: null,
  resolveOnGithub: null,
  resolveCommitStyle: null,
  afterMerge: null,
  defaultBranchTemplate: null,
};

const ACME_WEB: Workspace = {
  id: brandId<WorkspaceId>({ value: 'mock-workspace-acme-web' }),
  name: 'Acme web',
  slug: 'acme-web',
  overrides: OVERRIDES,
  createdAt: NOW,
  updatedAt: NOW,
};

const ACME_DOCS: Workspace = {
  ...ACME_WEB,
  id: brandId<WorkspaceId>({ value: 'mock-workspace-acme-docs' }),
  name: 'Acme docs',
  slug: 'acme-docs',
};

const ACME_WEB_FOLDER: Project = {
  id: brandId<ProjectId>({ value: 'mock-project-acme-web' }),
  workspaceId: ACME_WEB.id,
  name: 'acme-web',
  rootPath: `${CODE}/acme-web`,
  kind: 'repo',
  baseBranch: 'main',
  overrides: OVERRIDES,
  createdAt: NOW,
  updatedAt: NOW,
};

const ACME_DOCS_FOLDER: Project = {
  ...ACME_WEB_FOLDER,
  id: brandId<ProjectId>({ value: 'mock-project-acme-docs' }),
  workspaceId: ACME_DOCS.id,
  name: 'acme-docs',
  rootPath: `${CODE}/acme-docs`,
  kind: 'folder',
  baseBranch: null,
};

const LINEAR_BINDING: IntegrationBinding = {
  id: brandId<IntegrationBindingId>({ value: 'mock-binding-acme-linear' }),
  workspaceId: ACME_WEB.id,
  projectId: null,
  credentialId: brandId<IntegrationCredentialId>({ value: 'mock-credential-acme-linear' }),
  provider: 'linear',
  config: {
    workspaceUrlKey: 'harborline',
    viewerUserId: 'mock-linear-dana',
    viewerName: 'Dana R.',
  },
  createdAt: NOW,
  updatedAt: NOW,
};

type IssueParams = {
  readonly id: string;
  readonly title: string;
};

const linearIssue = ({ id, title }: IssueParams): LinearIssue => ({
  id: `mock-linear-${id}`,
  identifier: id,
  title,
  description: null,
  url: `https://example.invalid/linear/${id}`,
  state: { name: 'Todo', type: 'unstarted' },
  team: { key: 'HBL' },
  updatedAt: NOW,
});

const LINEAR_ISSUES: ReadonlyArray<LinearIssue> = [
  linearIssue({ id: 'HBL-412', title: 'Retried webhooks post a second credit' }),
  linearIssue({ id: 'HBL-409', title: 'Settlement export rounds a cent off' }),
  linearIssue({ id: 'HBL-397', title: 'Rotate the processor signing secret' }),
];

type StatusParams = {
  readonly id: string;
  readonly binary: string;
  readonly version?: string;
  readonly error?: string;
  readonly errorKind?: ProviderStatus['errorKind'];
};

const status = ({ id, binary, version, error, errorKind }: StatusParams): ProviderStatus => ({
  id,
  binary,
  available: version !== undefined,
  version: version ?? null,
  error: error ?? null,
  errorKind: errorKind ?? null,
});

const missing = ({ id, binary }: StatusParams): ProviderStatus =>
  status({ id, binary, error: 'not found', errorKind: 'notFound' });

const CLAUDE_READY = status({
  id: 'anthropic',
  binary: 'claude',
  version: '2.1.280 (Claude Code)',
});
const CODEX_FOUND = status({ id: 'codex', binary: 'codex', version: 'codex-cli 0.62.0' });

type Agents = {
  readonly statuses: ProviderStatuses;
  readonly auth: Partial<Record<ProviderId, AuthState>>;
};

const SIGNED_IN: AuthState = { state: 'connected', identity: 'dana@harborline.dev' };
const SIGNED_OUT: AuthState = { state: 'disconnected', identity: null };

const NO_API: Pick<ProviderStatuses, 'opencode' | 'openrouter' | 'moonshot'> = {
  opencode: missing({ id: 'opencode', binary: 'opencode' }),
  openrouter: missing({ id: 'openrouter', binary: 'opencode' }),
  moonshot: missing({ id: 'moonshot', binary: 'opencode' }),
};

const BASE_AGENTS: Agents = {
  statuses: {
    anthropic: CLAUDE_READY,
    codex: CODEX_FOUND,
    cursor: missing({ id: 'cursor', binary: 'cursor-agent' }),
    gemini: missing({ id: 'gemini', binary: 'agy' }),
    ...NO_API,
  },
  auth: { anthropic: SIGNED_IN, codex: SIGNED_OUT },
};

type AgentsParams = {
  readonly agents: WizardSceneAgents;
};

const agentsFor = ({ agents }: AgentsParams): Agents => {
  if (agents === 'none') {
    return {
      statuses: {
        ...BASE_AGENTS.statuses,
        anthropic: missing({ id: 'anthropic', binary: 'claude' }),
        codex: missing({ id: 'codex', binary: 'codex' }),
      },
      auth: {},
    };
  }
  if (agents === 'error') {
    return {
      statuses: {
        ...BASE_AGENTS.statuses,
        codex: status({
          id: 'codex',
          binary: 'codex',
          error: 'error: config.toml line 12: expected a value after "model ="',
          errorKind: 'exit',
        }),
      },
      auth: { anthropic: SIGNED_IN },
    };
  }
  return BASE_AGENTS;
};

type Seeded = {
  readonly workspace: Workspace | null;
  readonly folders: ReadonlyArray<Project>;
};

const SEEDED: Readonly<Record<WizardSceneWorkspace, Seeded>> = {
  none: { workspace: null, folders: [] },
  repo: { workspace: ACME_WEB, folders: [ACME_WEB_FOLDER] },
  folder: { workspace: ACME_DOCS, folders: [ACME_DOCS_FOLDER] },
};

type SeedParams = AgentsParams & {
  readonly ws: WizardSceneWorkspace;
  readonly hasLinear: boolean;
};

export const seedWizardScene = ({ agents, ws, hasLinear }: SeedParams): Seeded => {
  sampleScoutRuns.cancel();
  const detected = agentsFor({ agents });
  const seeded = SEEDED[ws];
  const { workspace } = seeded;
  installSceneDatabase({
    fallback: ({ command, payload }) => {
      switch (command) {
        case 'worktree_remote_url':
          return 'git@github.com:harborline/payments-api.git';
        case 'linear_fetch_assigned_issues':
          return LINEAR_ISSUES;
        default:
          return setupSceneAnswer({ command, payload });
      }
    },
  });
  mockWindows('main');
  useAppStore.setState({
    hydrated: true,
    workspaces: workspace === null ? [] : [workspace],
    currentWorkspaceId: workspace?.id ?? null,
    projects: seeded.folders,
    workspaceIntegrations:
      workspace === null ? {} : { [workspace.id]: hasLinear ? [LINEAR_BINDING] : [] },
    workspaceOverrides: {},
    settings: { ...useAppStore.getState().settings, [SETTING_NEW_PROJECT_PARENT]: CODE },
    githubStatus: { mode: 'gh-cli', available: true, user: 'dana-r', scopes: ['repo'] },
    providerStatus: detected.statuses.anthropic,
    codexStatus: detected.statuses.codex,
    cursorStatus: detected.statuses.cursor,
    geminiStatus: detected.statuses.gemini,
    authResults: detected.auth,
    providers: buildProviderList(detected.statuses, detected.auth, new Set()),
    providerConnect:
      agents === 'signin'
        ? {
            ...INITIAL_CONNECT_MAP,
            codex: {
              ...IDLE_CONNECT,
              phase: 'working',
              step: 'login',
              command: 'codex login',
              authUrl: 'https://example.invalid/codex/sign-in',
            },
          }
        : INITIAL_CONNECT_MAP,
    probeAgent: async () => undefined,
    refreshProviders: async () => undefined,
    connectProvider: (async (providerId) => {
      if (detected.statuses[providerId]?.available !== true) {
        return;
      }
      const authResults = { ...useAppStore.getState().authResults, [providerId]: SIGNED_IN };
      useAppStore.setState({
        authResults,
        providers: buildProviderList(detected.statuses, authResults, new Set()),
      });
    }) satisfies AppStore['connectProvider'],
    cancelProviderConnect: async () => undefined,
    refreshGithubStatus: async () => undefined,
    setCurrentWorkspace: (async (id) =>
      useAppStore.setState({ currentWorkspaceId: id })) satisfies AppStore['setCurrentWorkspace'],
    startSessionFromDraft: startSampleScout,
    openSessionDraft: () => {
      const state = useAppStore.getState();
      const workspaceId = state.currentWorkspaceId;
      if (workspaceId === null) {
        return;
      }
      const goal = state.sessionDrafts[workspaceId]?.workflowGoal ?? '';
      void startSampleScout({
        workspaceId,
        start: { kind: 'scout', agentKind: 'scout', focus: goal, prompt: goal, routing: null },
      });
    },
  });
  return seeded;
};
