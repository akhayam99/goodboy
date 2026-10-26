import type { OverrideSettings } from '@goodboy/types';

export type OverrideLevel = 'project' | 'session';

export const OVERRIDE_REACH = {
  defaultProviderId: ['project', 'session'],
  defaultBranchPrefix: ['project', 'session'],
  defaultBranchTemplate: ['project'],
  defaultVerbosity: ['project', 'session'],
  providerBindings: ['project', 'session'],
  taskModels: ['session'],
  roleModels: ['session'],
  parallelAgents: ['project', 'session'],
  providerPool: ['project', 'session'],
  attributionFooter: [],
  replyVoice: [],
  replyStyleNote: [],
  replyTemplateFixed: [],
  replyTemplateNoChange: [],
  resolveOnGithub: [],
  resolveCommitStyle: [],
  afterMerge: ['project'],
  workflowRules: [],
} as const satisfies Readonly<Record<keyof OverrideSettings, ReadonlyArray<OverrideLevel>>>;
