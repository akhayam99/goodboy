import type { Workspace, WorkspaceId } from '@goodboy/types';
import { WORKSPACE_ID as HARBORLINE_ID } from '../../../app/components/MockScene/scenes/BoardScene';

export const NORTHWIND_ID: WorkspaceId = JSON.parse(JSON.stringify('workspace-northwind'));

export const NORTHWIND_GOAL = 'Retry the failed Northwind invoice exports';

export const NORTHWIND_PROJECT_ID = 'project-northwind-ledger-core';

export const HARBORLINE_PROJECT_ID = 'project-harborline-payments-api';

export const HARBORLINE_GOAL = 'Stop retried webhooks from posting a second credit';

const NOW_MS = Date.parse('2026-10-20T09:00:00.000Z');

const NO_OVERRIDE_COLUMNS = {
  default_provider_id: null,
  default_branch_prefix: null,
  default_verbosity: null,
  provider_bindings: null,
  task_models: null,
  role_models: null,
  parallel_agents: null,
  provider_pool: null,
  attribution_footer: null,
};

export const NORTHWIND: Workspace = {
  id: NORTHWIND_ID,
  name: 'Northwind',
  slug: 'northwind',
  overrides: {
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
  },
  createdAt: JSON.parse(JSON.stringify('2026-09-01T09:00:00.000Z')),
  updatedAt: JSON.parse(JSON.stringify('2026-10-19T09:00:00.000Z')),
};

type RowsParams = {
  readonly sql: string;
  readonly params: ReadonlyArray<unknown>;
};

type Shelf = {
  readonly sessionId: string;
  readonly goal: string;
  readonly projectId: string;
  readonly projectName: string;
};

type RowParams = {
  readonly shelf: Shelf;
  readonly workspaceId: string;
};

const SHELVES: Readonly<Record<string, Shelf>> = {
  [NORTHWIND_ID]: {
    sessionId: 'session-northwind-invoice-exports',
    goal: NORTHWIND_GOAL,
    projectId: NORTHWIND_PROJECT_ID,
    projectName: 'ledger-core',
  },
  [HARBORLINE_ID]: {
    sessionId: 'session-harborline-webhook-credit',
    goal: HARBORLINE_GOAL,
    projectId: HARBORLINE_PROJECT_ID,
    projectName: 'payments-api',
  },
};

const sessionRow = ({ shelf, workspaceId }: RowParams) => ({
  id: shelf.sessionId,
  workspace_id: workspaceId,
  goal: shelf.goal,
  state_kind: 'idle',
  last_activity_at: NOW_MS,
  provider_default: 'claude',
  provider_allow_override: 0,
  provider_enabled: null,
  permission_mode: null,
  auto_run: 0,
  title_user_edited: 0,
  active_project_id: null,
  active_mount_id: null,
  archived_at: null,
  deleted_at: null,
  last_opened_at: null,
  verbosity: null,
  effort: null,
  model_override: null,
  provider_override: null,
  created_at: NOW_MS,
  updated_at: NOW_MS,
});

const projectRow = ({ shelf, workspaceId }: RowParams) => ({
  ...NO_OVERRIDE_COLUMNS,
  id: shelf.projectId,
  workspace_id: workspaceId,
  name: shelf.projectName,
  root_path: `~/code/${shelf.projectName}`,
  root_commit: null,
  remote_url: null,
  identity_checked_at: null,
  kind: 'repo',
  base_branch: null,
  description: null,
  starred_at: null,
  created_at: NOW_MS,
  updated_at: NOW_MS,
  disconnected_at: null,
  last_accessed_at: null,
  goodboy_ignore: null,
  goodboy_ignore_source: null,
  goodboy_ignore_checked_at: null,
});

export const workspaceRows = ({ sql, params }: RowsParams): ReadonlyArray<unknown> | null => {
  const workspaceId = params[0];
  if (typeof workspaceId !== 'string') {
    return null;
  }
  const shelf = SHELVES[workspaceId];
  if (shelf === undefined) {
    return null;
  }
  if (/FROM sessions WHERE workspace_id = \? AND archived_at IS NULL/.test(sql)) {
    return [sessionRow({ shelf, workspaceId })];
  }
  if (/FROM projects\s+WHERE workspace_id = \? AND disconnected_at IS NULL/.test(sql)) {
    return [projectRow({ shelf, workspaceId })];
  }
  if (/FROM session_external_tasks/.test(sql)) {
    return [];
  }
  return null;
};
