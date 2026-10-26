import { OVERRIDE_COLUMNS } from '@goodboy/types';
import type { OverrideColumn, OverrideSettings, WorkspaceId } from '@goodboy/types';
import type { Database } from '../client';

type ColumnValue = string | number | null;

type MapParams = {
  readonly value: Readonly<Record<string, unknown>> | null | undefined;
};

const mapText = ({ value }: MapParams): string | null =>
  value != null && Object.keys(value).length > 0 ? JSON.stringify(value) : null;

type FlagParams = {
  readonly isOn: boolean | null;
};

const flagColumn = ({ isOn }: FlagParams): number | null => {
  if (isOn === null) {
    return null;
  }
  return isOn ? 1 : 0;
};

type ValuesParams = {
  readonly overrides: OverrideSettings;
};

const columnValues = ({ overrides }: ValuesParams): ReadonlyArray<ColumnValue> => {
  const byColumn = {
    default_provider_id: overrides.defaultProviderId,
    default_branch_prefix: overrides.defaultBranchPrefix,
    default_verbosity: overrides.defaultVerbosity,
    provider_bindings: mapText({ value: overrides.providerBindings }),
    task_models: mapText({ value: overrides.taskModels }),
    role_models: mapText({ value: overrides.roleModels }),
    parallel_agents: flagColumn({ isOn: overrides.parallelAgents }),
    provider_pool: overrides.providerPool === null ? null : JSON.stringify(overrides.providerPool),
    attribution_footer: flagColumn({ isOn: overrides.attributionFooter }),
    reply_voice: overrides.replyVoice,
    reply_style_note: overrides.replyStyleNote,
    reply_template_fixed: overrides.replyTemplateFixed,
    reply_template_no_change: overrides.replyTemplateNoChange,
    resolve_on_github: flagColumn({ isOn: overrides.resolveOnGithub }),
    resolve_commit_style: overrides.resolveCommitStyle,
    after_merge: overrides.afterMerge,
    default_branch_template: overrides.defaultBranchTemplate,
    workflow_rules:
      overrides.workflowRules == null ? null : JSON.stringify(overrides.workflowRules),
  } satisfies Readonly<Record<OverrideColumn, ColumnValue>>;
  return OVERRIDE_COLUMNS.map((column) => byColumn[column]);
};

type Params = {
  readonly db: Database;
  readonly workspaceId: WorkspaceId;
  readonly overrides: OverrideSettings;
};

export const seedWorkspaceOverrides = async ({
  db,
  workspaceId,
  overrides,
}: Params): Promise<void> => {
  const assignments = OVERRIDE_COLUMNS.map((column) => `${column} = ?`).join(', ');
  await db.execute(`UPDATE workspaces SET ${assignments}, updated_at = ? WHERE id = ?`, [
    ...columnValues({ overrides }),
    Date.now(),
    workspaceId,
  ]);
};
