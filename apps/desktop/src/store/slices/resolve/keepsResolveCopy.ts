import type { ResolveAttempt, ResolveThread } from '@goodboy/types';
import { hasLaunchTurns } from './launchTurns';
import { attemptsOfLaunch, launchKeyOf } from './resolveLaunch';

type Params = {
  readonly attempt: ResolveAttempt;
  readonly attempts: ReadonlyArray<ResolveAttempt>;
  readonly rows: ReadonlyArray<ResolveThread>;
};

export const keepsResolveCopy = ({ attempt, attempts, rows }: Params): boolean => {
  if (hasLaunchTurns({ launchId: launchKeyOf({ attempt }) })) {
    return true;
  }
  const launch = attemptsOfLaunch({ attempts, launchKey: launchKeyOf({ attempt }) }).filter(
    (item) => item.agentId === attempt.agentId,
  );
  if (launch.some((item) => item.phase === 'queued' || item.phase === 'running')) {
    return true;
  }
  const ids = new Set(launch.map((item) => item.id));
  return rows.some(
    (row) =>
      row.activeAttemptId !== null && ids.has(row.activeAttemptId) && row.state === 'needs_answer',
  );
};
