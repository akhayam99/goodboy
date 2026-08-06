export const AREA_OPTIONS = [
  { value: 'board-sessions', label: 'Board and sessions' },
  { value: 'chat-agents', label: 'Chat and agents' },
  { value: 'workflows-plans', label: 'Workflows and plans' },
  { value: 'diff-files-terminal', label: 'Diff, files and terminal' },
  { value: 'reviews', label: 'Pull requests and reviews' },
  { value: 'integrations', label: 'Integrations' },
  { value: 'providers-models', label: 'Providers and models' },
  { value: 'budget-spend', label: 'Budget and spend' },
  { value: 'permissions-scripts', label: 'Permissions and scripts' },
  { value: 'notifications', label: 'Notifications' },
  { value: 'phone-companion', label: 'Phone companion' },
  { value: 'settings-onboarding', label: 'Settings, onboarding and the guide' },
  { value: 'startup-updates-data', label: 'Startup, updates and my data' },
  { value: 'something-else', label: 'Something else' },
] as const;

export type AreaValue = (typeof AREA_OPTIONS)[number]['value'];
