import { useEffect, useState } from 'react';
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
import { WizardFrame } from '../../../../../features/onboarding/OnboardingWizard/WizardFrame';
import type { WizardStepId } from '../../../../../features/onboarding/OnboardingWizard/wizardSteps';
import {
  buildProviderList,
  type AuthState,
  type ProviderStatus,
  type ProviderStatuses,
} from '../../../../../features/providers/providers';
import type { LinearIssue } from '../../../../../features/integrations/linear/client';
import { IDLE_CONNECT, INITIAL_CONNECT_MAP } from '../../../../../store/slices/providers/types';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import { useAppStore } from '../../../../../store';
import { sceneClock } from '../../sceneClock';
import { mockSceneIpc } from '../mockSceneIpc';

export type WizardSceneState =
  | 'welcome'
  | 'agents-ready'
  | 'agents-signin'
  | 'agents-none'
  | 'agents-error'
  | 'tools-github'
  | 'tools-linear'
  | 'tools-nogit'
  | 'first-ask'
  | 'first-task';

type Props = {
  readonly state: WizardSceneState;
  readonly theme: 'dark' | 'light';
};

const clock = sceneClock({ anchor: '2026-10-17T09:00:00.000Z' });
const NOW = clock.iso({ at: '2026-10-17T09:00:00.000Z' });

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
  rootPath: '/mock/Code/acme-web',
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
  rootPath: '/mock/Code/acme-docs',
  kind: 'folder',
  baseBranch: null,
};

const LINEAR_BINDING: IntegrationBinding = {
  id: brandId<IntegrationBindingId>({ value: 'mock-binding-acme-linear' }),
  workspaceId: ACME_WEB.id,
  projectId: null,
  credentialId: brandId<IntegrationCredentialId>({ value: 'mock-credential-acme-linear' }),
  provider: 'linear',
  config: { workspaceUrlKey: 'acme', viewerUserId: 'mock-linear-dana', viewerName: 'Dana K.' },
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
  team: { key: 'ACM' },
  updatedAt: NOW,
});

const LINEAR_ISSUES: ReadonlyArray<LinearIssue> = [
  linearIssue({ id: 'ACM-112', title: 'Checkout submits twice on a slow network' }),
  linearIssue({ id: 'ACM-108', title: 'Dark mode loses the focus ring on inputs' }),
  linearIssue({ id: 'ACM-97', title: 'Cache the pricing table for an hour' }),
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

const SIGNED_IN: AuthState = { state: 'connected', identity: 'dana@northwind.dev' };
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

const agentsFor = ({ state }: Pick<Props, 'state'>): Agents => {
  if (state === 'agents-none') {
    return {
      statuses: {
        ...BASE_AGENTS.statuses,
        anthropic: missing({ id: 'anthropic', binary: 'claude' }),
        codex: missing({ id: 'codex', binary: 'codex' }),
      },
      auth: {},
    };
  }
  if (state === 'agents-error') {
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

const STEP_OF: Readonly<Record<WizardSceneState, WizardStepId>> = {
  welcome: 'welcome',
  'agents-ready': 'agents',
  'agents-signin': 'agents',
  'agents-none': 'agents',
  'agents-error': 'agents',
  'tools-github': 'tools',
  'tools-linear': 'tools',
  'tools-nogit': 'tools',
  'first-ask': 'first-session',
  'first-task': 'first-session',
};

const seed = ({ state }: Pick<Props, 'state'>): void => {
  const agents = agentsFor({ state });
  const isNoGit = state === 'tools-nogit';
  const workspace = isNoGit ? ACME_DOCS : ACME_WEB;
  const folder = isNoGit ? ACME_DOCS_FOLDER : ACME_WEB_FOLDER;
  const hasLinear = state === 'first-ask' || state === 'first-task';
  mockSceneIpc((command) => {
    switch (command) {
      case 'worktree_remote_url':
        return 'git@github.com:acme/acme-web.git';
      case 'linear_fetch_assigned_issues':
        return LINEAR_ISSUES;
      default:
        return null;
    }
  });
  useAppStore.setState({
    hydrated: true,
    workspaces: [workspace],
    currentWorkspaceId: workspace.id,
    projects: [folder],
    workspaceIntegrations: { [workspace.id]: hasLinear ? [LINEAR_BINDING] : [] },
    workspaceOverrides: {},
    githubStatus: { mode: 'gh-cli', available: true, user: 'acme-bot', scopes: ['repo'] },
    providerStatus: agents.statuses.anthropic,
    codexStatus: agents.statuses.codex,
    cursorStatus: agents.statuses.cursor,
    geminiStatus: agents.statuses.gemini,
    authResults: agents.auth,
    providers: buildProviderList(agents.statuses, agents.auth, new Set()),
    providerConnect:
      state === 'agents-signin'
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
    connectProvider: async () => undefined,
    cancelProviderConnect: async () => undefined,
    refreshGithubStatus: async () => undefined,
  });
};

type ClickParams = {
  readonly name: string;
};

const clickButton = ({ name }: ClickParams): void => {
  const button = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
    (candidate) => candidate.getAttribute('aria-label') === name || candidate.textContent === name,
  );
  button?.click();
};

const FOLLOW_UP: Partial<Readonly<Record<WizardSceneState, string>>> = {
  'tools-linear': 'Connect Linear',
  'agents-error': 'Output',
  'first-task': 'Pick up an issue',
};

const SETTLED_MOTION =
  '*, *::before, *::after { animation-duration: 0s !important; animation-delay: 0s !important; transition: none !important; }';

export const WizardStepScene = ({ state, theme }: Props) => {
  const [isReady, setIsReady] = useState(false);
  const step = STEP_OF[state];
  const isNoGit = state === 'tools-nogit';

  useEffect(() => {
    applyDocumentTheme({ theme });
    seed({ state });
    setIsReady(true);
  }, [state, theme]);

  useEffect(() => {
    const name = FOLLOW_UP[state];
    if (!isReady || name === undefined) {
      return;
    }
    const timer = window.setTimeout(() => clickButton({ name }), 300);
    return () => window.clearTimeout(timer);
  }, [isReady, state]);

  if (!isReady) {
    return null;
  }
  const workspace = step === 'welcome' || step === 'agents' ? null : isNoGit ? ACME_DOCS : ACME_WEB;
  const projects = workspace === null ? [] : [isNoGit ? ACME_DOCS_FOLDER : ACME_WEB_FOLDER];
  return (
    <>
      <style>{SETTLED_MOTION}</style>
      <WizardFrame
        mode="full"
        start={step === 'welcome' ? null : step}
        providersConnected={1}
        hasWorkspace={workspace !== null}
        workspace={workspace}
        workspaceId={workspace?.id ?? null}
        projectCount={projects.length}
        projects={projects}
        onClose={() => undefined}
      />
    </>
  );
};
