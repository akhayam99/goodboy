export const REVIEW_LAUNCH_LABEL = {
  fix: 'Fix',
  selectRow: 'Select the comment by',
  clearSelection: 'Clear',
  selectionBar: 'Selected comments',
  strip: 'Fix launch',
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

export type LaunchNoun = 'comment' | 'note';

export const launchTitle = ({
  count,
  noun = 'comment',
}: {
  readonly count: number;
  readonly noun?: LaunchNoun;
}): string => {
  if (noun === 'note') {
    return count === 1 ? 'Fix 1 note' : `Fix ${count} notes, one agent each`;
  }
  return count === 1 ? 'Fix this comment' : `Fix ${count} comments, one agent each`;
};

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

export const fixSelectedLabel = ({ count }: { readonly count: number }): string =>
  count === 1 ? 'Fix' : `Fix ${count} separately`;
