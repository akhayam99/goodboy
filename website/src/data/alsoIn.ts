export type AlsoInRow = {
  readonly title: string;
  readonly line: string;
  readonly anchor: string;
};

export const ALSO_IN: readonly AlsoInRow[] = [
  {
    title: 'Several repos in one task',
    line: 'One task can cover several repos, each on its own branch',
    anchor: 'workspace-and-projects',
  },
  {
    title: 'Review and pull requests',
    line: 'Read the diff, leave notes and post replies an agent drafted',
    anchor: 'review-resolve-and-pull-requests',
  },
  {
    title: 'Rewrite history',
    line: 'Fold, reorder or drop commits, with conflicts predicted first',
    anchor: 'branch-history',
  },
  {
    title: 'Workflows',
    line: 'Save a goal as steps and let an orchestrator run them',
    anchor: 'workflows',
  },
  {
    title: 'Inbox',
    line: 'Start a task from an issue, a pull request, a Slack thread or a Sentry error',
    anchor: 'inbox-and-your-tools',
  },
  {
    title: 'Plans, reports and wireframes',
    line: 'Drafted by an agent and kept with the task',
    anchor: 'plans-reports-and-wireframes',
  },
  {
    title: 'Notifications and search',
    line: 'One list for what changed, one field to find anything',
    anchor: 'switch-between-tasks',
  },
  {
    title: 'Limits and cost',
    line: 'What your Claude and Codex plans have left, and a monthly cap per provider',
    anchor: 'providers-limits-and-cost',
  },
  {
    title: 'Storage',
    line: 'See what sits on disk and free what can go',
    anchor: 'storage',
  },
  {
    title: 'Backup and updates',
    line: 'A full copy of your data before an update changes it',
    anchor: 'security-backup-and-updates',
  },
];
