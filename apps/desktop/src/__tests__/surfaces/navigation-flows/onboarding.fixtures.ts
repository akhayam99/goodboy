import type { GitRepoCheck } from '@goodboy/types';
import {
  agentHandlers,
  agentStatus,
} from '../../../features/onboarding/OnboardingWizard/testing/agentHandlers';

export const CODE_FOLDER = '/mock/Code';

export const HARBORLINE_FOLDER = `${CODE_FOLDER}/harborline`;

export const LEDGER_CORE_FOLDER = `${HARBORLINE_FOLDER}/ledger-core`;

export const CLONED_FOLDER = '/mock/Developer/ledger-core';

const CLONED_CHECK: GitRepoCheck = {
  isRepo: true,
  rootPath: CLONED_FOLDER,
  resolvedPath: CLONED_FOLDER,
  defaultBranch: 'main',
  error: null,
  errorKind: null,
};

const AGENTS = agentHandlers({ signedIn: ['anthropic'], claudeVersion: '2.1.280' });

const AGENT_COMMANDS: Readonly<Record<string, unknown>> = AGENTS;

type AnswerFn = (args: unknown) => unknown;

const isAnswerFn = (value: unknown): value is AnswerFn => typeof value === 'function';

const NOT_FOUND: GitRepoCheck = {
  isRepo: false,
  rootPath: null,
  resolvedPath: null,
  defaultBranch: null,
  error: 'path does not exist',
  errorKind: 'not_found',
};

const HARBORLINE_CHECK: GitRepoCheck = {
  isRepo: false,
  rootPath: null,
  resolvedPath: HARBORLINE_FOLDER,
  defaultBranch: null,
  error: 'not a git repository',
  errorKind: 'not_a_repository',
};

const pathOf = (args: unknown): string =>
  typeof args === 'object' && args !== null && 'path' in args ? String(args.path) : '';

type HandlerParams = {
  readonly args: unknown;
};

const FOLDER_COMMANDS: Readonly<Record<string, (params: HandlerParams) => unknown>> = {
  validate_git_repo: ({ args }) => {
    if (pathOf(args) === CLONED_FOLDER) {
      return CLONED_CHECK;
    }
    return pathOf(args).startsWith(CODE_FOLDER)
      ? { ...HARBORLINE_CHECK, resolvedPath: pathOf(args) }
      : NOT_FOUND;
  },
  clone_probe: () => ({ route: 'git', host: 'github', name: 'ledger-core' }),
  clone_repository: () => ({ path: CLONED_FOLDER }),
  clone_cancel: () => null,
  clone_free_destination: () => null,
  scan_child_repos: ({ args }) => {
    if (pathOf(args) === HARBORLINE_FOLDER) {
      return [{ name: 'ledger-core', path: LEDGER_CORE_FOLDER, defaultBranch: 'main' }];
    }
    if (pathOf(args) === CODE_FOLDER) {
      return [
        { name: 'notify-relay', path: `${CODE_FOLDER}/notify-relay`, defaultBranch: 'main' },
        { name: 'payments-api', path: `${CODE_FOLDER}/payments-api`, defaultBranch: 'main' },
      ];
    }
    return [];
  },
  repo_identity: () => ({ rootCommits: [], remoteUrl: null }),
  open_privacy_settings: () => null,
  read_folder_signals: () => null,
  turn_list_live: () => [],
  workflow_list: () => [],
  step_def_list: () => [],
  budget_rule_list: () => [],
  budget_alerts_list: () => [],
  workspaces_attention: () => [],
  workspaces_with_unread: () => [],
  get_workspace_overrides: () => null,
  patch_workspace_overrides: () => null,
  project_git_status: () => ({
    state: 'ready',
    branch: 'main',
    headSubject: 'Add the ledger export endpoint',
    upstreamDistance: { kind: 'known', ahead: 0, behind: 0 },
    workingTree: { kind: 'known', staged: 0, unstaged: 0, untracked: 0, unmerged: 0, changed: 0 },
    upstream: 'origin/main',
    inProgress: null,
  }),
  repo_base_divergence: () => ({
    state: 'up-to-date',
    base: 'main',
    upstream: 'origin/main',
    ahead: 0,
    behind: 0,
    checkoutBranch: 'main',
    uncommitted: 0,
    message: null,
  }),
  gh_status: () => ({ mode: 'absent', available: false }),
  last_crash_claim: () => null,
  log_provider_standing: () => null,
  log_render_crash: () => null,
  window_heartbeat: () => null,
  refresh_opencode_status: () => agentStatus({ id: 'opencode', binary: 'opencode' }),
};

type CommandParams = {
  readonly command: string;
  readonly args: unknown;
};

export type OnboardingAnswer =
  { readonly isHandled: false } | { readonly isHandled: true; readonly value: unknown };

export const onboardingAnswer = ({ command, args }: CommandParams): OnboardingAnswer => {
  const folder = FOLDER_COMMANDS[command];
  if (folder !== undefined) {
    return { isHandled: true, value: folder({ args }) };
  }
  const agent = AGENT_COMMANDS[command];
  if (agent === undefined) {
    return { isHandled: false };
  }
  return { isHandled: true, value: isAnswerFn(agent) ? agent(args) : agent };
};

export const dialogModuleMock = () => ({
  open: async () => HARBORLINE_FOLDER,
});
