export type DemoGroup = {
  readonly id: string;
  readonly title: string;
  readonly line: string;
  readonly isOptional?: boolean;
};

export const DEMO_GROUPS = {
  setup: {
    id: 'setup',
    title: 'Set up',
    line: 'Prepare your agents and a workspace, then start a first task',
    isOptional: true,
  },
  agent: {
    id: 'agent',
    title: 'Work with an agent',
    line: 'Send, answer a question and continue with another model',
  },
  orchestrate: {
    id: 'orchestrate',
    title: 'Orchestrate',
    line: 'Plan with Auto or run a saved workflow',
  },
  find: {
    id: 'find',
    title: 'Find work and results',
    line: 'Open a session that needs you and find its saved report',
  },
  review: {
    id: 'review',
    title: 'Review and ship',
    line: 'Inspect a change, prepare a review fix to publish and free the old folders',
  },
} as const satisfies Readonly<Record<string, DemoGroup>>;
