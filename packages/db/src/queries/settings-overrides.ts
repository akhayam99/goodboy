import type {
  OverrideSettings,
  ProviderBindings,
  ProviderId,
  RoleModelPreferences,
  TaskModelPreferences,
  VerbosityLevel,
  WorkflowId,
  WorkspaceId,
} from '@goodboy/types';
import type { Database } from '../client';

type WorkspaceOverrideRow = {
  default_provider_id: string | null;
  default_workflow_id: string | null;
  default_branch_prefix: string | null;
  parallel_enabled: number | null;
  default_verbosity: string | null;
  provider_bindings: string | null;
  task_models: string | null;
  role_models: string | null;
  parallel_agents: number | null;
  provider_pool: string | null;
};

function parseBindings(raw: string | null): ProviderBindings | null {
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as ProviderBindings;
  } catch {
    return null;
  }
}

function serializeBindings(bindings: ProviderBindings | null): string | null {
  return bindings && Object.keys(bindings).length > 0 ? JSON.stringify(bindings) : null;
}

function parseTaskModels(raw: string | null): TaskModelPreferences | null {
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as TaskModelPreferences;
  } catch {
    return null;
  }
}

function serializeTaskModels(taskModels: TaskModelPreferences | null): string | null {
  return taskModels && Object.keys(taskModels).length > 0 ? JSON.stringify(taskModels) : null;
}

function parseRoleModels(raw: string | null): RoleModelPreferences | null {
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as RoleModelPreferences;
  } catch {
    return null;
  }
}

function serializeRoleModels(roleModels: RoleModelPreferences | null): string | null {
  return roleModels && Object.keys(roleModels).length > 0 ? JSON.stringify(roleModels) : null;
}

type RawProviderPool = {
  readonly raw: string | null;
};

const parseProviderPool = ({ raw }: RawProviderPool): ReadonlyArray<ProviderId> | undefined => {
  if (raw == null) {
    return undefined;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return undefined;
    }
    const providers: ProviderId[] = [];
    for (const value of parsed) {
      switch (value) {
        case 'anthropic':
        case 'cursor':
        case 'codex':
        case 'gemini':
          providers.push(value);
          break;
        default:
          return undefined;
      }
    }
    return providers;
  } catch {
    return undefined;
  }
};

type ProviderPool = {
  readonly enabledProviders: ReadonlyArray<ProviderId> | undefined;
};

const serializeProviderPool = ({ enabledProviders }: ProviderPool): string | null =>
  enabledProviders == null ? null : JSON.stringify(enabledProviders);

function workspaceRowToOverride(row: WorkspaceOverrideRow): OverrideSettings {
  return {
    defaultProviderId: row.default_provider_id as ProviderId | null,
    defaultWorkflowId: row.default_workflow_id as WorkflowId | null,
    defaultBranchPrefix: row.default_branch_prefix,
    parallelEnabled: row.parallel_enabled === null ? null : row.parallel_enabled !== 0,
    defaultVerbosity: row.default_verbosity as VerbosityLevel | null,
    providerBindings: parseBindings(row.provider_bindings),
    taskModels: parseTaskModels(row.task_models),
    roleModels: parseRoleModels(row.role_models),
    parallelAgents: row.parallel_agents === null ? null : row.parallel_agents !== 0,
    enabledProviders: parseProviderPool({ raw: row.provider_pool }),
  };
}

export const getWorkspaceOverrides = async (
  db: Database,
  workspaceId: WorkspaceId,
): Promise<OverrideSettings | null> => {
  const rows = await db.select<WorkspaceOverrideRow>(
    `SELECT default_provider_id, default_workflow_id, default_branch_prefix, parallel_enabled, default_verbosity, provider_bindings, task_models, role_models, parallel_agents, provider_pool
     FROM workspaces WHERE id = ?`,
    [workspaceId],
  );
  const row = rows[0];
  return row ? workspaceRowToOverride(row) : null;
};

export const setWorkspaceOverrides = async (
  db: Database,
  workspaceId: WorkspaceId,
  overrides: OverrideSettings,
): Promise<void> => {
  await db.execute(
    `UPDATE workspaces
     SET default_provider_id = ?,
         default_workflow_id = ?,
         default_branch_prefix = ?,
         parallel_enabled = ?,
         default_verbosity = ?,
         provider_bindings = ?,
         task_models = ?,
         role_models = ?,
         parallel_agents = ?,
         provider_pool = ?,
         updated_at = ?
     WHERE id = ?`,
    [
      overrides.defaultProviderId,
      overrides.defaultWorkflowId,
      overrides.defaultBranchPrefix,
      overrides.parallelEnabled === null ? null : overrides.parallelEnabled ? 1 : 0,
      overrides.defaultVerbosity,
      serializeBindings(overrides.providerBindings),
      serializeTaskModels(overrides.taskModels),
      serializeRoleModels(overrides.roleModels),
      overrides.parallelAgents === null ? null : overrides.parallelAgents ? 1 : 0,
      serializeProviderPool({ enabledProviders: overrides.enabledProviders }),
      Date.now(),
      workspaceId,
    ],
  );
};
