import type { IntegrationBindingProvider } from '@goodboy/types';

export type ToolUse = 'pullRequests' | 'reviews' | 'mergeRequests' | 'issues' | 'threads';

export type ToolUseCounts = Readonly<
  Partial<Record<IntegrationBindingProvider, Readonly<Partial<Record<ToolUse, number>>>>>
>;

export const TOOL_USES: Readonly<Record<IntegrationBindingProvider, ReadonlyArray<ToolUse>>> = {
  github: ['pullRequests', 'reviews', 'issues'],
  gitlab: ['mergeRequests', 'issues'],
  bitbucket: ['pullRequests'],
  linear: ['issues'],
  jira: ['issues'],
  sentry: ['issues'],
  slack: ['threads'],
};
