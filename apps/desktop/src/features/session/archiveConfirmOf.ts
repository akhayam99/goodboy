import type { ActionConfirm } from '../actions/types';

type Params = {
  readonly sessionCount: number;
  readonly runningAgentCount: number;
};

type CountParams = {
  readonly count: number;
};

const agentsWord = ({ count }: CountParams): string =>
  count === 1 ? '1 agent' : `${count} agents`;

const keptOf = ({ count }: CountParams): string =>
  `Branches, worktrees and history stay on disk, and Restore brings ${count === 1 ? 'it' : 'them'} back.`;

export const archiveConfirmOf = ({
  sessionCount,
  runningAgentCount,
}: Params): ActionConfirm | null => {
  if (runningAgentCount === 0) {
    return null;
  }
  const agents = agentsWord({ count: runningAgentCount });
  const isOne = runningAgentCount === 1;
  const stops = isOne
    ? 'Archive stops it first and keeps what it wrote.'
    : 'Archive stops them first and keeps what they wrote.';
  return {
    title: `Stop ${agents} and archive?`,
    description: `${stops} ${keptOf({ count: sessionCount })}`,
    confirmLabel: `Stop ${agents} and archive`,
    role: 'alert',
  };
};
