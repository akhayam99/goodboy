export type GlossaryEntry = {
  readonly term: string;
  readonly definition: string;
};

export const GLOSSARY = {
  workflow: {
    term: 'Workflow',
    definition:
      'Several agents that run in order. Each one starts from what the last one left, and the whole run grows as one tree in Activity.',
  },
  orchestrated: {
    term: 'Orchestrated',
    definition:
      'Goodboy picks one agent at a time. After each one finishes, it reads the result and decides the next, or ends the run.',
  },
  artifact: {
    term: 'Artifact',
    definition:
      'Something an agent writes for you to keep: a plan, a report or a wireframe. It stays in Artifacts after the agent is done.',
  },
} as const satisfies Record<string, GlossaryEntry>;

export type GlossaryTermId = keyof typeof GLOSSARY;
