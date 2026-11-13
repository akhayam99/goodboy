import type { ActionRun } from './types';

type Params = {
  readonly runs: Readonly<Record<string, ActionRun>>;
  readonly sessionId: string;
};

export const withoutSessionRuns = ({
  runs,
  sessionId,
}: Params): Readonly<Record<string, ActionRun>> =>
  Object.fromEntries(Object.entries(runs).filter(([, run]) => run.sessionId !== sessionId));
