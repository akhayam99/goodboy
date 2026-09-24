import { PROVIDER_IDS } from '@goodboy/types';
import type {
  OverrideSettings,
  ProviderBindings,
  ProviderId,
  RoleModelPreferences,
  TaskModelPreferences,
  VerbosityLevel,
  WorkflowId,
} from '@goodboy/types';
import { isJsonArray, isJsonRecord, parseJsonColumn } from '../shared/parseJsonColumn';

export type OverrideRow = {
  readonly default_provider_id: string | null;
  readonly default_workflow_id: string | null;
  readonly default_branch_prefix: string | null;
  readonly parallel_enabled: number | null;
  readonly default_verbosity: string | null;
  readonly provider_bindings: string | null;
  readonly task_models: string | null;
  readonly role_models: string | null;
  readonly parallel_agents: number | null;
  readonly provider_pool: string | null;
  readonly attribution_footer: number | null;
  readonly invocation_global_limit?: number | null;
  readonly invocation_provider_limit?: number | null;
  readonly invocation_heavyweight_limit?: number | null;
};

type ParseJsonParams = {
  readonly raw: string | null;
};

const isProviderBindings = (value: unknown): value is ProviderBindings => isJsonRecord(value);

const isTaskModelPreferences = (value: unknown): value is TaskModelPreferences =>
  isJsonRecord(value);

const isRoleModelPreferences = (value: unknown): value is RoleModelPreferences =>
  isJsonRecord(value);

const PROVIDER_ID_SET: ReadonlySet<string> = new Set(PROVIDER_IDS);

const parseProviderPool = ({ raw }: ParseJsonParams): ReadonlyArray<ProviderId> | null => {
  const parsed = parseJsonColumn<ReadonlyArray<unknown> | null>({
    value: raw,
    isValid: isJsonArray,
    fallback: null,
  });
  if (parsed === null) {
    return null;
  }
  const providerPool: ProviderId[] = [];
  for (const value of parsed) {
    if (typeof value !== 'string' || PROVIDER_ID_SET.has(value) === false) {
      return null;
    }
    providerPool.push(value as ProviderId);
  }
  return providerPool;
};

type Params = {
  readonly row: OverrideRow;
};

export const overridesFromRow = ({ row }: Params): OverrideSettings => ({
  defaultProviderId: row.default_provider_id as ProviderId | null,
  defaultWorkflowId: row.default_workflow_id as WorkflowId | null,
  defaultBranchPrefix: row.default_branch_prefix,
  parallelEnabled: row.parallel_enabled === null ? null : row.parallel_enabled !== 0,
  defaultVerbosity: row.default_verbosity as VerbosityLevel | null,
  providerBindings: parseJsonColumn<ProviderBindings | null>({
    value: row.provider_bindings,
    isValid: isProviderBindings,
    fallback: null,
  }),
  taskModels: parseJsonColumn<TaskModelPreferences | null>({
    value: row.task_models,
    isValid: isTaskModelPreferences,
    fallback: null,
  }),
  roleModels: parseJsonColumn<RoleModelPreferences | null>({
    value: row.role_models,
    isValid: isRoleModelPreferences,
    fallback: null,
  }),
  parallelAgents: row.parallel_agents === null ? null : row.parallel_agents !== 0,
  providerPool: parseProviderPool({ raw: row.provider_pool }),
  attributionFooter: row.attribution_footer == null ? null : row.attribution_footer !== 0,
  invocationGlobalLimit: row.invocation_global_limit ?? null,
  invocationProviderLimit: row.invocation_provider_limit ?? null,
  invocationHeavyweightLimit: row.invocation_heavyweight_limit ?? null,
});
