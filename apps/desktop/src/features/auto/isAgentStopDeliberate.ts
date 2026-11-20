import type { AutoOutcome } from '@goodboy/db';
import type { Agent } from '@goodboy/types';

type Params = {
  readonly status: Agent['status'] | undefined;
  readonly outcome: AutoOutcome | null;
};

export const isAgentStopDeliberate = ({ status, outcome }: Params): boolean =>
  status === 'stopped' && outcome !== 'timed_out';
