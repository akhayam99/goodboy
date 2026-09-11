export type AgentFormRole = {
  readonly label: string;
  readonly hint?: string;
};

export const AGENT_FORM_GRAMMAR = {
  role: {
    label: 'Role',
    fixedHint: 'Fixed by where you started this agent',
  },
  instructions: {
    label: 'Instructions',
    optional: 'optional',
    ariaLabel: 'Agent instructions',
    placeholder: 'What to emphasize, what to avoid. Leave empty and the agent decides.',
  },
  routing: {
    label: 'Routing',
    ariaLabel: 'Agent routing',
  },
} as const;
