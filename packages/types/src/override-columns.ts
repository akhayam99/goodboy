import type { OverrideSettings } from './settings';

export const OVERRIDE_COLUMNS = [
  'default_provider_id',
  'default_branch_prefix',
  'default_verbosity',
  'provider_bindings',
  'task_models',
  'role_models',
  'parallel_agents',
  'provider_pool',
  'attribution_footer',
  'reply_voice',
  'reply_style_note',
  'reply_template_fixed',
  'reply_template_no_change',
  'resolve_on_github',
  'resolve_commit_style',
  'after_merge',
  'default_branch_template',
  'workflow_rules',
] as const;

export type OverrideColumn = (typeof OVERRIDE_COLUMNS)[number];

export const OVERRIDE_COLUMN_OF_KEY = {
  defaultProviderId: 'default_provider_id',
  defaultBranchPrefix: 'default_branch_prefix',
  defaultVerbosity: 'default_verbosity',
  providerBindings: 'provider_bindings',
  taskModels: 'task_models',
  roleModels: 'role_models',
  parallelAgents: 'parallel_agents',
  providerPool: 'provider_pool',
  attributionFooter: 'attribution_footer',
  replyVoice: 'reply_voice',
  replyStyleNote: 'reply_style_note',
  replyTemplateFixed: 'reply_template_fixed',
  replyTemplateNoChange: 'reply_template_no_change',
  resolveOnGithub: 'resolve_on_github',
  resolveCommitStyle: 'resolve_commit_style',
  afterMerge: 'after_merge',
  defaultBranchTemplate: 'default_branch_template',
  workflowRules: 'workflow_rules',
} as const satisfies Readonly<Record<keyof OverrideSettings, OverrideColumn>>;
