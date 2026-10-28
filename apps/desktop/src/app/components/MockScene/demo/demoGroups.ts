export type DemoGroup = {
  readonly id: string;
  readonly title: string;
  readonly line: string;
};

export const DEMO_GROUPS = {
  bring: {
    id: 'bring',
    title: 'Bring your repositories',
    line: 'Put the code and its issue tracker together',
  },
  direction: {
    id: 'direction',
    title: 'Set the direction',
    line: 'Start from the issue and answer the decision that blocks work',
  },
  guide: {
    id: 'guide',
    title: 'Guide the work',
    line: 'Improve one plan before agents implement it',
  },
  ship: {
    id: 'ship',
    title: 'Review and ship',
    line: "Accept a reviewer's requested change, publish it and reclaim space",
  },
} as const satisfies Readonly<Record<string, DemoGroup>>;
