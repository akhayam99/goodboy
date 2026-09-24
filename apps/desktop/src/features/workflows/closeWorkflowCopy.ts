export const CLOSE_WORKFLOW_COPY = {
  label: 'Close workflow',
  hint: 'End this run and keep what it wrote',
  title: 'Close this workflow?',
  description:
    'Steps that have not run are skipped and the one in flight stops. Everything already written stays. Add a step to pick the run up again.',
} as const satisfies Record<string, string>;
