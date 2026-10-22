type CountParams = {
  readonly count: number;
};

type NumberParams = {
  readonly number: number;
};

type NameParams = {
  readonly name: string;
};

export const RUN_ROUTE_COPY = {
  label: 'Start a run',
  fromPreset: ({ name }: NameParams) => `Start a run from ${name}`,
  placeholder: 'Describe what you want done. Auto picks how to run it.',
  hint: 'Auto picks a plan, one agent or a preset. Type ~ or @.',
  start: 'Start',
  starting: 'Starting',
  discard: 'Discard',
  retry: 'Retry',
  failed: "Couldn't start the run",
  shapes: {
    plan: 'A plan with steps',
    lead: 'One agent that starts what it needs',
  },
  closeness: {
    follow: 'Follow the preset',
    adapt: 'Adapt as it goes',
  },
  why: {
    picked: 'you picked it',
    yourDefault: 'your default',
    matches: 'Your ask matches the preset',
    taskWithEnd: 'A task with an end',
    acrossProjects: ({ count }: CountParams) => `A task with an end, across ${count} projects`,
    pullRequest: ({ number }: NumberParams) => `Fixes on pull request #${number}`,
    oneFile: 'One file to look at',
    questionOrCheck: 'A question or a check, and no preset fits',
    unsure: 'Not sure yet: one agent first',
  },
} as const;
