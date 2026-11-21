import type { NextMove } from './types';

type Params = {
  readonly move: NextMove;
};

export const settledTextOf = ({ move }: Params): string => {
  if (move.kind === 'rerun-check') {
    return `${move.payload.checkName} passed on rerun`;
  }
  if (move.kind === 'run-failing-test') {
    return `${move.payload.checkName} passed`;
  }
  if (move.kind === 'fix-checks') {
    return 'Checks passed';
  }
  if (move.kind === 'next-script') {
    return `${move.payload.scriptName} finished`;
  }
  if (move.kind === 'merge-pr') {
    return `#${move.payload.prNumber} merged`;
  }
  if (move.kind === 'unmount-folder') {
    return `${move.payload.projectName} removed`;
  }
  if (move.kind === 'close-worktree') {
    return 'Worktree removed';
  }
  if (move.kind === 'ask-agent') {
    return `${move.payload.agentLabel} answered`;
  }
  if (move.kind === 'mount-project') {
    return `${move.payload.projectName} added`;
  }
  return 'Done';
};
