import type { InboxSource } from './InboxSource';

export const INBOX_SOURCES: readonly InboxSource[] = [
  { id: 'github', name: 'GitHub', count: 9 },
  { id: 'linear', name: 'Linear', count: 8 },
  { id: 'jira', name: 'Jira', count: 3 },
  { id: 'sentry', name: 'Sentry', count: 4 },
  { id: 'slack', name: 'Slack', count: 2 },
];
