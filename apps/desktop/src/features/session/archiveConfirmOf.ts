import type { ActionConfirm } from '../actions/types';

type Params = {
  readonly sessionCount: number;
  readonly runningAgentCount: number;
};

type CountParams = {
  readonly count: number;
};

const sessionsWord = ({ count }: CountParams): string =>
  count === 1 ? 'session' : `${count} sessions`;

const keptOf = ({ count }: CountParams): string =>
  `Branches, worktrees and history stay on disk, and Restore brings ${count === 1 ? 'it' : 'them'} back.`;

const runningOf = ({ sessionCount, runningAgentCount }: Params): string => {
  const agents = runningAgentCount === 1 ? 'agent is' : 'agents are';
  const keeps = runningAgentCount === 1 ? 'keeps' : 'keep';
  const place = sessionCount === 1 ? 'this session' : 'these sessions';
  const after = sessionCount === 1 ? 'it' : 'them';
  return `${runningAgentCount} ${agents} still running in ${place} and ${keeps} running after you archive ${after}.`;
};

export const archiveConfirmOf = ({ sessionCount, runningAgentCount }: Params): ActionConfirm => {
  const kept = keptOf({ count: sessionCount });
  const subject = sessionsWord({ count: sessionCount });
  return {
    title: `Archive ${subject}?`,
    description:
      runningAgentCount === 0 ? kept : `${runningOf({ sessionCount, runningAgentCount })} ${kept}`,
    confirmLabel: `Archive ${subject}`,
    role: 'alert',
  };
};
