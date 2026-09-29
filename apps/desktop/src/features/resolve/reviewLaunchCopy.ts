export const REVIEW_LAUNCH_LABEL = {
  fix: 'Fix',
  strip: 'Fix launch',
  model: 'Model',
  commit: 'Commit',
  commitStyle: 'Commit style',
  newCommit: 'New commit',
  fixup: 'Fixup of the original',
  hintPlaceholder: 'Anything the agents should know? Optional',
  hintLabel: 'Notes for the agents',
  remembered: 'Remembered for this session',
  cancel: 'Cancel',
  close: 'Close',
} as const;

export const launchTitle = ({ count }: { readonly count: number }): string =>
  count === 1 ? 'Fix this comment' : `Fix ${count} comments, one agent each`;

export const launchStartLabel = ({ count }: { readonly count: number }): string =>
  count === 1 ? 'Start' : `Start ${count} agents`;

export const launchFactLine = ({
  count,
  limit,
}: {
  readonly count: number;
  readonly limit: number;
}): string =>
  count === 1
    ? 'One agent, working on its own copy of the branch'
    : `${count} agents · up to ${limit} run at once · each works on its own copy of the branch`;

export const startedLine = ({
  count,
  modelName,
}: {
  readonly count: number;
  readonly modelName: string;
}): string => `${count} ${count === 1 ? 'agent' : 'agents'} started on ${modelName}`;
