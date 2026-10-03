import {
  AFTER_MERGE_RULES,
  parseProviderPolicy,
  parseWorkflowRulesText,
  REPLY_VOICES,
  RESOLVE_COMMIT_STYLES,
} from '@goodboy/types';
import type {
  AfterMergeRule,
  OverrideSettings,
  ProviderBindings,
  ProviderId,
  ProviderPolicy,
  ReplyVoice,
  ResolveCommitStyle,
  RoleModelPreferences,
  TaskModelPreferences,
  VerbosityLevel,
} from '@goodboy/types';
import { isJsonArray, isJsonRecord, parseJsonColumn } from '../shared/parseJsonColumn';

export type OverrideRow = {
  readonly default_provider_id: string | null;
  readonly default_branch_prefix: string | null;
  readonly default_verbosity: string | null;
  readonly provider_bindings: string | null;
  readonly task_models: string | null;
  readonly role_models: string | null;
  readonly parallel_agents: number | null;
  readonly provider_pool: string | null;
  readonly attribution_footer: number | null;
  readonly reply_voice?: string | null;
  readonly reply_style_note?: string | null;
  readonly reply_template_fixed?: string | null;
  readonly reply_template_no_change?: string | null;
  readonly resolve_on_github?: number | null;
  readonly resolve_commit_style?: string | null;
  readonly after_merge?: string | null;
  readonly default_branch_template?: string | null;
  readonly workflow_rules?: string | null;
};

export const REPLY_SETTING_COLUMNS =
  'reply_voice, reply_style_note, reply_template_fixed, reply_template_no_change, resolve_on_github, resolve_commit_style';

export const replySettingValues = ({
  overrides,
}: {
  readonly overrides: OverrideSettings;
}): ReadonlyArray<string | number | null> => [
  overrides.replyVoice,
  overrides.replyStyleNote,
  overrides.replyTemplateFixed,
  overrides.replyTemplateNoChange,
  overrides.resolveOnGithub === null ? null : overrides.resolveOnGithub ? 1 : 0,
  overrides.resolveCommitStyle,
];

const REPLY_VOICE_SET: ReadonlySet<string> = new Set(REPLY_VOICES);
const COMMIT_STYLE_SET: ReadonlySet<string> = new Set(RESOLVE_COMMIT_STYLES);
const AFTER_MERGE_SET: ReadonlySet<string> = new Set(AFTER_MERGE_RULES);

const replyVoiceOf = ({ raw }: ParseJsonParams): ReplyVoice | null =>
  raw !== null && REPLY_VOICE_SET.has(raw) ? (raw as ReplyVoice) : null;

const commitStyleOf = ({ raw }: ParseJsonParams): ResolveCommitStyle | null =>
  raw !== null && COMMIT_STYLE_SET.has(raw) ? (raw as ResolveCommitStyle) : null;

const afterMergeOf = ({ raw }: ParseJsonParams): AfterMergeRule | null =>
  raw !== null && AFTER_MERGE_SET.has(raw) ? (raw as AfterMergeRule) : null;

type ParseJsonParams = {
  readonly raw: string | null;
};

const isProviderBindings = (value: unknown): value is ProviderBindings => isJsonRecord(value);

const isTaskModelPreferences = (value: unknown): value is TaskModelPreferences =>
  isJsonRecord(value);

const isRoleModelPreferences = (value: unknown): value is RoleModelPreferences =>
  isJsonRecord(value);

type ProviderPoolParams = ParseJsonParams & {
  readonly defaultProviderId: string | null;
};

const parseProviderPool = ({
  raw,
  defaultProviderId,
}: ProviderPoolParams): ProviderPolicy | null => {
  const parsed = parseJsonColumn<ReadonlyArray<unknown> | null>({
    value: raw,
    isValid: isJsonArray,
    fallback: null,
  });
  return parseProviderPolicy({ value: parsed, defaultProviderId });
};

type Params = {
  readonly row: OverrideRow;
};

export const overridesFromRow = ({ row }: Params): OverrideSettings => ({
  defaultProviderId: row.default_provider_id as ProviderId | null,
  defaultBranchPrefix: row.default_branch_prefix,
  defaultBranchTemplate: row.default_branch_template ?? null,
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
  providerPool: parseProviderPool({
    raw: row.provider_pool,
    defaultProviderId: row.default_provider_id,
  }),
  attributionFooter: row.attribution_footer == null ? null : row.attribution_footer !== 0,
  replyVoice: replyVoiceOf({ raw: row.reply_voice ?? null }),
  replyStyleNote: row.reply_style_note ?? null,
  replyTemplateFixed: row.reply_template_fixed ?? null,
  replyTemplateNoChange: row.reply_template_no_change ?? null,
  resolveOnGithub: row.resolve_on_github == null ? null : row.resolve_on_github !== 0,
  resolveCommitStyle: commitStyleOf({ raw: row.resolve_commit_style ?? null }),
  afterMerge: afterMergeOf({ raw: row.after_merge ?? null }),
  workflowRules: parseWorkflowRulesText({ text: row.workflow_rules }),
});
