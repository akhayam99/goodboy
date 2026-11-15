import type { ConnectionToolId } from './connectionState';

export const TOOL_FEEDS: Readonly<Record<ConnectionToolId, ReadonlyArray<string>>> = {
  github: ['Pull requests', 'Reviews', 'Issues'],
  gitlab: ['Merge requests', 'Issues'],
  bitbucket: ['Pull requests'],
  linear: ['Issues as tasks'],
  jira: ['Issues as tasks'],
  sentry: ['Issues as tasks'],
  slack: ['Threads as tasks'],
};
