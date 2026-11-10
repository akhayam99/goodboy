export type DemoGroup = {
  readonly id: string;
  readonly title: string;
  readonly line: string;
  readonly outro: string;
};

export const DEMO_GROUPS = {
  bring: {
    id: 'bring',
    title: 'Bring your repositories',
    line: 'Put the code and its issue tracker together',
    outro: 'Harborline holds payments-api, ledger-core and notify-relay, with Linear connected.',
  },
  direction: {
    id: 'direction',
    title: 'Set the direction',
    line: 'Start from the issue and answer the decision that blocks work',
    outro: 'HBL-412 has a plan. Claude hit its limit and Codex finished it with your decision.',
  },
  guide: {
    id: 'guide',
    title: 'Guide the work',
    line: 'Improve one plan before agents implement it',
    outro: 'Plan v2 carries your test. One agent wrote the fix, another checked it.',
  },
  ship: {
    id: 'ship',
    title: 'Review and ship',
    line: "Accept a reviewer's requested change, publish it and reclaim space",
    outro: "nadia-p's thread is resolved, the branch is pushed and the old folders are gone.",
  },
} as const satisfies Readonly<Record<string, DemoGroup>>;
